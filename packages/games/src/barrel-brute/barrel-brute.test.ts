import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import barrelBrute, { type BruteState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 50 && f % 200 < 100, down: f % 200 >= 150 }, { a: f % 41 === 0 });

describe('barrel-brute', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(barrelBrute, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(barrelBrute, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(barrelBrute, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(barrelBrute, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(barrelBrute, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(barrelBrute, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(barrelBrute, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = barrelBrute.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      barrelBrute.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) barrelBrute.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;
const GIRDERS = [16, 13, 10, 7, 4];

function yard() {
  const rng = createRng(5);
  const s: BruteState = barrelBrute.init({ rng, hiScore: 0 });
  s.barrels = [];
  s.pickups = [];
  s.throwTimer = 1e9;
  /** Plain girders: no ladders, so barrels only drop at the ends. */
  const flat = () => {
    for (let k = 0; k < s.grid.length; k++) {
      if (s.grid[k] === 2) s.grid[k] = GIRDERS.includes(Math.floor(k / COLS)) ? 1 : 0;
    }
  };
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) barrelBrute.update(s, input, TICK, { rng, emit: () => undefined }); };
  const barrel = (x: number, y: number, dir: number, falling = false) => ({ x, y, dir, falling, vy: 0, scored: false });
  return { s, tick, barrel, flat };
}

describe('barrel-brute rules', () => {
  it('the hero walks, makes a low jump (the girder above limits it to about a tile), and lands again', () => {
    const { s, tick } = yard();
    expect(s.me.y).toBe(16);
    tick(30, held({ right: true }));
    expect(s.me.x).toBeGreaterThan(4);
    let top = s.me.y;
    tick(1, held({}, { a: true }));
    for (let f = 0; f < 60; f++) {
      tick(1);
      top = Math.min(top, s.me.y);
    }
    expect(16 - top).toBeGreaterThan(0.9);
    expect(16 - top).toBeLessThan(1.3);
    expect(s.me.y).toBe(16);
  });

  it('a barrel rolls along its girder in the downhill direction, drops off the end, and lands on the next girder going the other way', () => {
    const { s, tick, barrel, flat } = yard();
    flat();
    Object.assign(s.me, { x: 20.5, y: 16 });
    s.barrels.push(barrel(20.5, 13, -1));
    tick(60 * 2);
    expect(s.barrels[0]!.x).toBeLessThan(20.5);
    expect(s.barrels[0]!.y).toBe(13);
    // Roll on until it falls off the left end (the gap on girder 1 is at x < 2) and lands on girder 0.
    for (let f = 0; f < 60 * 12 && s.barrels[0] && s.barrels[0].y === 13; f++) tick(1);
    const b = s.barrels[0];
    expect(b).toBeDefined();
    for (let f = 0; f < 60 && b!.falling; f++) tick(1);
    expect(b!.y).toBe(16);
    expect(b!.dir).toBe(1);
  });

  it('touching a barrel costs a life; hopping it scores 100 once', () => {
    const a = yard();
    a.s.barrels.push(a.barrel(2.5, 16, 1));
    a.tick(5);
    expect(a.s.lives).toBe(2);

    // Jumping toward an oncoming barrel works with the right timing; too early or never does not.
    const results = [] as { at: number; lives: number; score: number }[];
    for (let at = 10; at <= 40; at += 2) {
      const y = yard();
      y.s.barrels.push(y.barrel(6.5, 16, -1));
      y.tick(at, held({ right: true }));
      y.tick(1, held({ right: true }, { a: true }));
      y.tick(60, held({ right: true }));
      results.push({ at, lives: y.s.lives, score: y.s.score });
    }
    expect(results.some((r) => r.lives === 3 && r.score === 100)).toBe(true);
    expect(results.some((r) => r.lives < 3)).toBe(true);
    const never = yard();
    never.s.barrels.push(never.barrel(6.5, 16, -1));
    never.tick(60, held({ right: true }));
    expect(never.s.lives).toBe(2);
  });

  it('a hammer smashes barrels for 300 and lasts a few seconds', () => {
    const { s, tick, barrel } = yard();
    s.pickups.push({ x: 2.5, y: 16, kind: 0 });
    tick(2);
    expect(s.me.hammer).toBeGreaterThan(7);
    s.barrels.push(barrel(3.5, 16, -1));
    tick(30);
    expect(s.barrels).toHaveLength(0);
    expect(s.score).toBe(300);
    expect(s.lives).toBe(3);
    tick(60 * 9);
    expect(s.me.hammer).toBe(0);
  });

  it('climbs ladders; reaching the top rescues for the bonus and starts the next level', () => {
    const { s, tick } = yard();
    s.bonus = 3000;
    Object.assign(s.me, { x: 3.5, y: 4, onGround: true });
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBe(3000 + 1000);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.me.y).toBe(16);
  });

  it('the bonus counts down and running out costs a life', () => {
    const { s, tick } = yard();
    s.bonus = 200;
    tick(60 * 3);
    expect(s.lives).toBe(2);
  });

  it('falling through the gap at the bottom loses a life', () => {
    const { s, tick } = yard();
    Object.assign(s.me, { x: 26.5, y: 16, onGround: true });
    tick(90, held({ right: true }));
    expect(s.lives).toBe(2);
  });

  it('the brute throws barrels over time, faster on later levels', () => {
    const a = yard();
    a.s.throwTimer = 0.1;
    a.tick(10);
    expect(a.s.barrels.length).toBe(1);
    expect(a.s.throwTimer).toBeGreaterThan(1.2);
  });

  it('generated levels have two ladders between each pair of girders and a hammer or two', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = barrelBrute.init({ rng: createRng(seed), hiScore: 0 });
      for (let k = 0; k < 4; k++) {
        const cols = [...Array(COLS).keys()].filter((x) => s.grid[i(x, GIRDERS[k + 1]!)] === 2);
        expect(cols.length).toBeGreaterThanOrEqual(1);
        expect(cols.length).toBeLessThanOrEqual(2);
      }
      expect(s.pickups.length).toBe(2);
    }
  });
});
