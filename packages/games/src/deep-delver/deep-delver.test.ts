import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import deepDelver, { type DelverState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, down: f % 200 >= 150 && f % 200 < 190 }, { b: f % 45 === 0, a: f % 400 === 399 });

describe('deep-delver', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(deepDelver, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(deepDelver, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(deepDelver, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(deepDelver, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(deepDelver, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(deepDelver, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(deepDelver, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = deepDelver.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      deepDelver.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) deepDelver.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 26;
const i = (x: number, y: number) => y * COLS + x;
const floorRow = (t: number) => (t + 1) * 5 - 1;

function cave() {
  const rng = createRng(5);
  const s: DelverState = deepDelver.init({ rng, hiScore: 0 });
  s.bats = [];
  s.spiders = [];
  s.items = [];
  s.me.invuln = 0;
  s.me.air = 100;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) deepDelver.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}
const jump = held({}, { b: true });

/** Column of the rope in tier t's floor. */
const ropeCol = (s: DelverState, t: number) => [...Array(COLS).keys()].find((x) => s.grid[i(x, floorRow(t))] === 2)!;

describe('deep-delver rules', () => {
  it('a normal jump and landing is harmless', () => {
    const { s, tick } = cave();
    tick(1, jump);
    tick(60);
    expect(s.lives).toBe(3);
    expect(s.me.y).toBe(floorRow(0));
  });

  it('a short drop is survived, but a fall of more than three tiles is fatal', () => {
    const short = cave();
    // Make a 3-tile step: remove floor tiles so the hero drops one tier... only 3 rows below.
    short.s.grid[i(10, floorRow(0))] = 0;
    for (let y = floorRow(0) + 1; y < floorRow(0) + 4; y++) short.s.grid[i(10, y)] = 0;
    short.s.grid[i(10, floorRow(0) + 3)] = 1;
    Object.assign(short.s.me, { x: 10.5, y: floorRow(0), onGround: true, peak: floorRow(0) });
    short.s.grid[i(10, floorRow(0))] = 0;
    short.tick(80);
    expect(short.s.lives).toBe(3);

    const long = cave();
    const hx = ropeCol(long.s, 0) + 1; // the open half of the hole: a five-row drop
    expect(long.s.grid[i(hx, floorRow(0))]).toBe(0);
    Object.assign(long.s.me, { x: hx + 0.5, y: floorRow(0), onGround: true, peak: floorRow(0) });
    long.tick(80);
    expect(long.s.lives).toBe(2);
  });

  it('the rope can be climbed down to the next tier safely', () => {
    const { s, tick } = cave();
    const rc = ropeCol(s, 0);
    Object.assign(s.me, { x: rc + 0.5, y: floorRow(0), onGround: true, peak: floorRow(0) });
    tick(200, held({ down: true }));
    expect(s.me.y).toBe(floorRow(1));
    expect(s.lives).toBe(3);
  });

  it('air drains over time, air capsules refill it, and running out costs a life', () => {
    const { s, tick } = cave();
    tick(60 * 5);
    expect(s.me.air).toBeLessThan(90);
    s.me.air = 30;
    s.items.push({ x: 2.7, y: floorRow(0) - 0.6, kind: 'air' });
    tick(3);
    expect(s.me.air).toBeGreaterThan(60);
    s.me.air = 0.05;
    tick(10);
    expect(s.lives).toBe(2);
    tick(150);
    expect(s.me.alive).toBe(true);
    expect(s.me.air).toBeGreaterThan(95);
  });

  it('treasure scores 500 and flares are topped up', () => {
    const { s, tick } = cave();
    s.items.push({ x: 2.7, y: floorRow(0) - 0.6, kind: 'treasure' }, { x: 2.7, y: floorRow(0) - 0.6, kind: 'flare' });
    const flares = s.me.flares;
    tick(3);
    expect(s.score).toBe(500);
    expect(s.me.flares).toBe(flares + 2);
  });

  it('bats and spiders cost a life on contact', () => {
    const a = cave();
    a.s.bats.push({ x: 2.6, y: floorRow(0) - 1, dir: 0, t: 0 });
    a.tick(5);
    expect(a.s.lives).toBe(2);
    const b = cave();
    const rc = ropeCol(b.s, 0);
    b.s.spiders.push({ x: rc + 0.5, y: floorRow(0) + 2, dir: 0, top: floorRow(0) + 1.5, bottom: floorRow(1) - 1 });
    Object.assign(b.s.me, { x: rc + 0.5, y: floorRow(0) + 2.8, onGround: false, climbing: true });
    b.tick(3);
    expect(b.s.lives).toBe(2);
  });

  it('after 70 seconds a ghost appears and hunts you; a flare drives it off for a while', () => {
    const a = cave();
    a.s.me.air = 1e9;
    a.tick(60 * 69);
    expect(a.s.ghost.on).toBe(false);
    a.tick(60 * 2);
    expect(a.s.ghost.on).toBe(true);
    a.tick(60 * 30);
    expect(a.s.lives).toBeLessThan(3);

    const b = cave();
    b.s.me.air = 1e9;
    b.s.clock = 70;
    b.tick(2);
    Object.assign(b.s.ghost, { x: b.s.me.x + 3, y: b.s.me.y - 1 });
    const d0 = Math.abs(b.s.ghost.x - b.s.me.x);
    b.tick(1, held({}, { a: true }));
    expect(b.s.ghost.scared).toBeGreaterThan(5);
    b.tick(60 * 2);
    expect(Math.abs(b.s.ghost.x - b.s.me.x)).toBeGreaterThan(d0);
    expect(b.s.me.flares).toBe(3);
  });

  it('reaching the exit on the bottom tier pays a bonus and opens a deeper cave', () => {
    const { s, tick } = cave();
    const bottom = floorRow(s.tiers - 1);
    Object.assign(s.me, { x: s.exit.x, y: bottom, onGround: true, peak: bottom });
    s.me.air = 50;
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(2000 + 49 * 20); // plus the air you have left
    expect(s.score).toBeLessThanOrEqual(2000 + 50 * 20);
    const tiers = s.tiers;
    tick(150);
    expect(s.level).toBe(2);
    expect(s.tiers).toBeGreaterThan(tiers);
  });

  it('every cave has a rope down from each tier, with the open half of the hole beside it', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = deepDelver.init({ rng: createRng(seed), hiScore: 0 });
      for (let t = 0; t < s.tiers - 1; t++) {
        const rc = ropeCol(s, t);
        expect(s.grid[i(rc + 1, floorRow(t))]).toBe(0);
        for (let y = floorRow(t); y < floorRow(t + 1); y++) expect(s.grid[i(rc, y)]).toBe(2);
      }
    }
  });
});
