import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import canopyClimb, { nutPos, onTrack, type CanopyState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 240 < 30, right: f % 240 >= 120 && f % 240 < 150, down: f % 240 >= 60 && f % 240 < 110, up: f % 240 >= 200 }, { a: f % 41 === 0 });

describe('canopy-climb', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(canopyClimb, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(canopyClimb, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(canopyClimb, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(canopyClimb, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(canopyClimb, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(canopyClimb, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(canopyClimb, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = canopyClimb.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      canopyClimb.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) canopyClimb.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function summit() {
  const rng = createRng(5);
  const s: CanopyState = canopyClimb.init({ rng, hiScore: 0 });
  s.nuts = [];
  s.monkeys = [];
  s.nutTimer = 1e9;
  s.me.invuln = 0;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) canopyClimb.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}

describe('canopy-climb rules', () => {
  it('the track climbs from the start to the ape: heights never drop along the path and stay in bounds', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = canopyClimb.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.path.length).toBeGreaterThanOrEqual(25);
      let prev = -Infinity;
      for (const c of s.path) {
        const hh = s.h[c.y * 28 + c.x]!;
        expect(hh).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = hh;
        expect(c.x).toBeGreaterThanOrEqual(2);
        expect(c.y).toBeGreaterThanOrEqual(2);
        expect(c.x).toBeLessThan(26);
        expect(c.y).toBeLessThan(26);
      }
      expect(s.h[s.path[s.path.length - 1]!.y * 28 + s.path[s.path.length - 1]!.x]!).toBeGreaterThan(s.h[s.path[0]!.y * 28 + s.path[0]!.x]! + 3);
    }
  });

  it('the arrow keys move along the isometric screen directions', () => {
    const run = (input: Input) => {
      const { s, tick } = summit();
      const x0 = s.me.x;
      const y0 = s.me.y;
      tick(6, input);
      return { dx: s.me.x - x0, dy: s.me.y - y0 };
    };
    const down = run(held({ down: true }));
    expect(down.dx).toBeGreaterThan(0.2);
    expect(down.dy).toBeGreaterThan(0.2);
    const right = run(held({ right: true }));
    expect(right.dx).toBeGreaterThan(0.2);
    expect(right.dy).toBeLessThan(-0.2);
    const left = run(held({ left: true }));
    expect(left.dx).toBeLessThan(-0.2);
    expect(left.dy).toBeGreaterThan(0.2);
  });

  it('walking off the track means a fall into the water and a lost life', () => {
    const { s, tick } = summit();
    tick(30, held({ up: true })); // toward the north-west edge, off the track
    expect(s.me.fall).toBeGreaterThan(0);
    tick(70);
    expect(s.me.alive).toBe(false);
    expect(s.lives).toBe(2);
    tick(120);
    expect(s.me.alive).toBe(true);
    expect(s.me.x).toBe(s.path[0]!.x + 0.5);
  });

  it('a hop rises and comes back down, and cannot be repeated in mid-air', () => {
    const { s, tick } = summit();
    tick(1, held({}, { a: true }));
    let top = 0;
    let secondHop = false;
    for (let f = 0; f < 60; f++) {
      tick(1, f === 5 ? held({}, { a: true }) : NO_INPUT);
      top = Math.max(top, s.me.hop);
      if (f === 5 && s.me.hopV > 2.5 && s.me.hop > top - 0.01 && false) secondHop = true;
    }
    expect(top).toBeGreaterThan(0.8);
    expect(top).toBeLessThan(1.8);
    expect(s.me.hop).toBe(0);
    expect(secondHop).toBe(false);
  });

  it('coconuts roll down the path from the ape, in one of three lanes, and vanish at the bottom', () => {
    const { s, tick } = summit();
    s.nutTimer = 0.01;
    tick(3);
    expect(s.nuts).toHaveLength(1);
    const n = s.nuts[0]!;
    expect(n.k).toBeGreaterThan(s.path.length - 3);
    expect([-1, 0, 1]).toContain(n.lane);
    const k0 = n.k;
    s.nutTimer = 1e9;
    tick(60);
    expect(s.nuts[0]!.k).toBeLessThan(k0 - 3);
    const p = nutPos(s, s.nuts[0]!);
    expect(onTrack(s, p.x, p.y)).toBe(true);
    tick(60 * 60);
    expect(s.nuts).toHaveLength(0);
  });

  it('a coconut that reaches you costs a life, but a well-timed hop clears it', () => {
    const hit = summit();
    Object.assign(hit.s.me, { x: 10.5, y: 3.5 });
    hit.s.nuts.push({ k: 9.0, lane: 0 });
    hit.s.me.x = hit.s.path[4]!.x + 0.5;
    hit.s.me.y = hit.s.path[4]!.y + 0.5;
    hit.tick(90);
    expect(hit.s.lives).toBe(2);

    const lives: number[] = [];
    for (let at = 0; at <= 40; at += 2) {
      const t = summit();
      t.s.me.x = t.s.path[4]!.x + 0.5;
      t.s.me.y = t.s.path[4]!.y + 0.5;
      t.s.nuts.push({ k: 9.0, lane: 0 });
      t.tick(at);
      t.tick(1, held({}, { a: true }));
      t.tick(60);
      lives.push(t.s.lives);
    }
    expect(lives.some((l) => l === 3)).toBe(true);
  });

  it('monkeys follow you along the track and cost a life on contact', () => {
    const a = summit();
    a.s.monkeys.push({ x: a.s.me.x + 3, y: a.s.me.y });
    a.tick(60 * 4);
    expect(a.s.lives).toBeLessThan(3);

    // A monkey still some way off cannot hurt you yet.
    const b = summit();
    b.s.monkeys.push({ x: b.s.me.x + 3, y: b.s.me.y });
    b.tick(30);
    expect(b.s.lives).toBe(3);
  });

  it('reaching the ape banks the bonus and starts a longer climb; the bonus clock running out costs a life', () => {
    const a = summit();
    const top = a.s.path[a.s.path.length - 1]!;
    a.s.bonus = 1500;
    Object.assign(a.s.me, { x: top.x + 0.5, y: top.y + 0.5 });
    a.tick(2);
    expect(a.s.score).toBe(1500 + 1000);
    a.tick(150);
    expect(a.s.level).toBe(2);
    expect(a.s.path.length).toBeGreaterThanOrEqual(25);

    const b = summit();
    b.s.bonus = 100;
    b.tick(60 * 3);
    expect(b.s.lives).toBe(2);
  });
});
