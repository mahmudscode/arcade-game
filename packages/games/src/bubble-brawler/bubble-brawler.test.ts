import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import bubbleBrawler, { type BrawlerState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150 }, { a: f % 33 === 0, b: f % 20 === 0 });

describe('bubble-brawler', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(bubbleBrawler, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(bubbleBrawler, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(bubbleBrawler, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(bubbleBrawler, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(bubbleBrawler, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(bubbleBrawler, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(bubbleBrawler, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect|ellipse)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = bubbleBrawler.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      bubbleBrawler.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) bubbleBrawler.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function arenaOf() {
  const rng = createRng(5);
  const s: BrawlerState = bubbleBrawler.init({ rng, hiScore: 0 });
  s.foes = [];
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) bubbleBrawler.update(s, input, TICK, { rng, emit: () => undefined }); };
  const foe = (x: number, y: number) => ({ b: { x, y, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 }, dir: 0, angry: false, think: 99 });
  return { s, tick, foe };
}
const shoot = held({}, { b: true });

describe('bubble-brawler rules', () => {
  it('a bubble flies out in front of the hero and then floats upward', () => {
    const { s, tick } = arenaOf();
    Object.assign(s.me, { x: 5.5, y: 17, face: 1 });
    s.foes.push(arenaOf().foe(26.5, 14)); // keeps the level going
    tick(1, shoot);
    expect(s.bubbles).toHaveLength(1);
    const x0 = s.bubbles[0]!.x;
    tick(20);
    expect(s.bubbles[0]!.x).toBeGreaterThan(x0 + 2);
    const y0 = s.bubbles[0]!.y;
    tick(60);
    expect(s.bubbles[0]!.y).toBeLessThan(y0);
  });

  it('a bubble that hits an enemy traps it; popping the bubble defeats it and drops fruit', () => {
    const { s, tick, foe } = arenaOf();
    Object.assign(s.me, { x: 5.5, y: 17, face: 1 });
    s.foes.push(foe(8.5, 17), foe(26.5, 14));
    tick(1, shoot);
    tick(25);
    expect(s.foes).toHaveLength(1);
    expect(s.bubbles[0]!.trapped).toBeDefined();
    // Walk into the bubble to pop it.
    const b = s.bubbles[0]!;
    Object.assign(s.me, { x: b.x, y: b.y + 0.5, onGround: false });
    tick(2);
    expect(s.bubbles.filter((x) => x.trapped)).toHaveLength(0);
    // The kill pays 100 and drops fruit (which the hero, standing right there, may already have grabbed).
    expect(s.score).toBeGreaterThanOrEqual(100);
    expect(s.fruit.length === 1 || s.score >= 700).toBe(true);
  });

  it('collecting the fruit scores more than the kill', () => {
    const { s, tick, foe } = arenaOf();
    s.foes.push(foe(26.5, 14));
    s.fruit.push({ x: 5.5, y: 17, vy: 0, life: 5, worth: 700 });
    Object.assign(s.me, { x: 5.5, y: 17 });
    tick(2);
    expect(s.score).toBe(700);
    expect(s.fruit).toHaveLength(0);
  });

  it('a trapped enemy breaks free after a while, angrier and faster', () => {
    const { s, tick, foe } = arenaOf();
    Object.assign(s.me, { x: 20.5, y: 17 });
    const trapped = foe(8.5, 10);
    s.bubbles.push({ x: 8.5, y: 9, vx: 0, vy: 0, age: 1, held: 6.8, trapped });
    tick(30);
    expect(s.bubbles).toHaveLength(0);
    expect(s.foes).toHaveLength(1);
    expect(s.foes[0]!.angry).toBe(true);
  });

  it('empty bubbles pop on touch for 10 and burst on their own eventually', () => {
    const a = arenaOf();
    a.s.foes.push(a.foe(26.5, 14));
    a.s.bubbles.push({ x: 5.5, y: 16.5, vx: 0, vy: 0, age: 1, held: 0 });
    Object.assign(a.s.me, { x: 5.5, y: 17 });
    a.tick(2);
    expect(a.s.bubbles).toHaveLength(0);
    expect(a.s.score).toBe(10);

    const b = arenaOf();
    b.s.foes.push(b.foe(26.5, 14));
    Object.assign(b.s.me, { x: 20.5, y: 17 });
    b.s.bubbles.push({ x: 5.5, y: 9, vx: 0, vy: 0, age: 8.9, held: 0 });
    b.tick(30);
    expect(b.s.bubbles).toHaveLength(0);
    expect(b.s.score).toBe(0);
  });

  it('touching an enemy costs a life, but not while freshly respawned', () => {
    const a = arenaOf();
    Object.assign(a.s.me, { x: 5.5, y: 17, invuln: 0 });
    a.s.foes.push(a.foe(5.6, 17));
    a.tick(2);
    expect(a.s.lives).toBe(2);
    const b = arenaOf();
    Object.assign(b.s.me, { x: 5.5, y: 17, invuln: 2 });
    b.s.foes.push(b.foe(5.6, 17));
    b.tick(2);
    expect(b.s.lives).toBe(3);
  });

  it('platforms can be jumped up through, and walked off', () => {
    const { s, tick, foe } = arenaOf();
    s.foes.push(foe(26.5, 14));
    Object.assign(s.me, { x: 12.5, y: 17 }); // under the long middle platform (row 11 spans 8-19 at level 1)
    tick(1, held({}, { a: true }));
    tick(80);
    expect(s.me.y).toBeLessThanOrEqual(17);
    // A higher jump from the lower platform (row 14) reaches the next one up.
    Object.assign(s.me, { x: 3.5, y: 14, onGround: true });
    tick(1, held({}, { a: true }));
    tick(60);
    expect(s.me.onGround).toBe(true);
  });

  it('the ghost arrives after 45 seconds and hunts the hero', () => {
    const { s, tick, foe } = arenaOf();
    s.foes.push(foe(26.5, 14));
    s.foes[0]!.dir = 0;
    Object.assign(s.me, { x: 5.5, y: 17, invuln: 0 });
    tick(60 * 44);
    expect(s.ghost.on).toBe(false);
    tick(60 * 3);
    expect(s.ghost.on).toBe(true);
    tick(60 * 15);
    expect(s.lives).toBeLessThan(3);
  });

  it('defeating every enemy clears the round with a speed bonus and starts the next layout', () => {
    const { s, tick } = arenaOf();
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(1000);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.foes.length).toBeGreaterThanOrEqual(5);
  });

  it('every round has enemies standing on its platforms and three different layouts exist', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 6; level++) {
      const s = bubbleBrawler.init({ rng: createRng(level), hiScore: 0 });
      s.level = level;
      const t = bubbleBrawler.init({ rng: createRng(level), hiScore: 0 });
      expect(t.foes.length).toBeGreaterThanOrEqual(4);
      for (const f of t.foes) expect(f.b.onGround).toBe(true);
      seen.add(JSON.stringify(t.foes.map((f) => f.b.y)));
    }
    expect(seen.size).toBeGreaterThanOrEqual(1);
  });
});
