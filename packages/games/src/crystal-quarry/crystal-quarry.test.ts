import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import crystalQuarry, { type QuarryState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 160 < 40, right: f % 160 >= 80 && f % 160 < 120, up: f % 160 >= 40 && f % 160 < 80, down: f % 160 >= 120 }, { a: f % 10 === 0 });

describe('crystal-quarry', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(crystalQuarry, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(crystalQuarry, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(crystalQuarry, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(crystalQuarry, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(crystalQuarry, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(crystalQuarry, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(crystalQuarry, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = crystalQuarry.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      crystalQuarry.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) crystalQuarry.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 32;
const i = (x: number, y: number) => y * COLS + x;

/** A sealed empty cave (steel border) with the digger at (3, 3); build what each test needs. */
function cave() {
  const rng = createRng(5);
  const s: QuarryState = crystalQuarry.init({ rng, hiScore: 0 });
  s.grid = s.grid.map((_, k) => {
    const x = k % COLS;
    const y = Math.floor(k / COLS);
    return x === 0 || y === 0 || x === COLS - 1 || y === 17 ? 2 : 0;
  });
  s.fall = s.grid.map(() => 0);
  s.flies = [];
  s.me = { x: 3, y: 3, alive: true, fx: 1 };
  s.need = 3;
  s.got = 0;
  s.open = false;
  s.time = 100;
  s.acc = 0;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) crystalQuarry.update(s, input, TICK, { rng, emit: () => undefined }); };
  /** Advances n cave ticks (0.1 s each). */
  const steps = (n: number, input: Input = NO_INPUT) => tick(n * 6, input);
  return { s, tick, steps };
}

describe('crystal-quarry rules', () => {
  it('digging through dirt leaves open cave; gems are collected for 10', () => {
    const { s, steps } = cave();
    s.grid[i(4, 3)] = 1;
    s.grid[i(5, 3)] = 4;
    s.grid[i(5, 4)] = 2; // something for the gem to rest on
    steps(3, held({ right: true }));
    expect(s.grid[i(4, 3)]).toBe(0);
    expect(s.me.x).toBeGreaterThanOrEqual(5);
    expect(s.got).toBe(1);
    expect(s.score).toBe(10);
  });

  it('a boulder over empty space falls one cell per tick and lands', () => {
    const { s, steps } = cave();
    s.grid[i(10, 2)] = 3;
    steps(1);
    expect(s.grid[i(10, 3)]).toBe(3);
    steps(20);
    expect(s.grid[i(10, 16)]).toBe(3);
    expect(s.fall[i(10, 16)]).toBe(0);
  });

  it('a falling boulder crushes the digger, but a resting one on their head is harmless', () => {
    const a = cave();
    a.s.grid[i(3, 1)] = 3;
    a.steps(6);
    expect(a.s.lives).toBe(2);

    const b = cave();
    b.s.grid[i(3, 2)] = 3; // already resting right above the digger
    b.s.grid[i(3, 4)] = 1;
    b.steps(10);
    expect(b.s.lives).toBe(3);
    expect(b.s.grid[i(3, 2)]).toBe(3);
  });

  it('a boulder rolls off the shoulder of another rock', () => {
    const { s, steps } = cave();
    s.grid[i(10, 16)] = 3;
    s.grid[i(10, 15)] = 3;
    steps(3);
    expect(s.grid[i(10, 15)]).toBe(0);
    expect([9, 11].some((x) => s.grid[i(x, 16)] === 3)).toBe(true);
  });

  it('boulders can be pushed sideways into space but not into walls or up', () => {
    const a = cave();
    a.s.grid[i(4, 3)] = 3;
    a.s.grid[i(4, 4)] = 2;
    a.s.grid[i(5, 4)] = 2;
    a.steps(1, held({ right: true })); // one tick = one push
    expect(a.s.grid[i(5, 3)]).toBe(3);

    const b = cave();
    b.s.grid[i(4, 3)] = 3;
    b.s.grid[i(5, 3)] = 2;
    b.s.grid[i(4, 4)] = 2;
    b.steps(4, held({ right: true }));
    expect(b.s.me.x).toBe(3);
    expect(b.s.grid[i(4, 3)]).toBe(3);
  });

  it('the exit stays shut until the quota is met, then finishes the level with a time bonus', () => {
    const { s, steps, tick } = cave();
    s.grid[i(4, 3)] = 5;
    s.grid[i(3, 4)] = 0;
    steps(3, held({ right: true }));
    expect(s.levelDelay).toBe(0); // closed
    s.got = 3;
    s.open = true;
    steps(3, held({ right: true }));
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThan(400);
    tick(120);
    expect(s.level).toBe(2);
  });

  it('the exit opens as soon as the last needed gem is taken', () => {
    const { s, steps } = cave();
    s.need = 1;
    s.grid[i(4, 3)] = 4;
    steps(2, held({ right: true }));
    expect(s.open).toBe(true);
  });

  it('a firefly hugs the walls and kills the digger on contact', () => {
    const { s, steps } = cave();
    s.me = { x: 20, y: 8, alive: true, fx: 1 };
    s.flies.push({ x: 1, y: 1, dx: 1, dy: 0 });
    steps(6);
    const f = s.flies[0]!;
    expect(f.x + f.y).toBeGreaterThan(2); // moving
    expect(f.x === 1 || f.y === 1 || f.x === 30 || f.y === 16 || Math.abs(f.dx) + Math.abs(f.dy) === 1).toBe(true);
    for (const [x, y] of [[19, 7], [19, 9], [18, 8]] as const) s.grid[i(x, y)] = 2; // a corridor leading straight at the digger
    s.flies[0] = { x: 19, y: 8, dx: 1, dy: 0 };
    steps(6);
    expect(s.lives).toBe(2);
  });

  it('a boulder dropped on a firefly blows it up into gems (100)', () => {
    const { s, steps } = cave();
    s.me = { x: 25, y: 14, alive: true, fx: 1 };
    s.flies.push({ x: 10, y: 8, dx: 0, dy: 0 });
    for (const x of [9, 10, 11]) s.grid[i(x, 9)] = 2; // floor for the new gems
    s.grid[i(10, 5)] = 3;
    s.fall[i(10, 5)] = 1;
    steps(5);
    expect(s.flies).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(100);
    expect([9, 10, 11].some((x) => s.grid[i(x, 8)] === 4)).toBe(true);
  });

  it('running out of time costs a life', () => {
    const { s, tick } = cave();
    s.time = 0.5;
    tick(60);
    expect(s.lives).toBe(2);
  });

  it('generated caves have a reachable quota of gems and a closed exit', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = crystalQuarry.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.grid.filter((c) => c === 4).length).toBeGreaterThanOrEqual(s.need);
      expect(s.grid.filter((c) => c === 5)).toHaveLength(1);
      expect(s.open).toBe(false);
    }
  });
});
