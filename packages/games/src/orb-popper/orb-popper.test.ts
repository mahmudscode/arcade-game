import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import orbPopper, { type PopperState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 240 < 90, right: f % 240 >= 120 && f % 240 < 210 }, { a: f % 30 === 0, b: f % 97 === 0 });

describe('orb-popper', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(orbPopper, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(orbPopper, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(orbPopper, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(orbPopper, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(orbPopper, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(orbPopper, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect|ellipse)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = orbPopper.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      orbPopper.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) orbPopper.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 11;
const i = (r: number, c: number) => r * COLS + c;

function board() {
  const rng = createRng(5);
  const s: PopperState = orbPopper.init({ rng, hiScore: 0 });
  s.grid = s.grid.map(() => 0);
  s.par = 0;
  s.misses = 0;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) orbPopper.update(s, input, TICK, { rng, emit: () => undefined }); };
  /** Drops a bubble of `color` into the board at pixel (x, y) and resolves it, as a landing shot would. */
  const land = (x: number, y: number, color: number) => {
    s.flight = { active: true, x, y, vx: 0, vy: -1, color };
    tick(1);
  };
  return { s, tick, land };
}

describe('orb-popper rules', () => {
  it('a straight shot flies up and sticks to the ceiling', () => {
    const { s, tick } = board();
    s.current = 2;
    tick(1, held({}, { a: true }));
    expect(s.flight.active).toBe(true);
    tick(60);
    expect(s.flight.active).toBe(false);
    expect(s.grid[i(0, 5)]).toBe(2);
    expect(s.misses).toBe(1);
  });

  it('three of a colour pop, and score 30', () => {
    const { s, land } = board();
    s.grid[i(0, 3)] = 1;
    s.grid[i(0, 4)] = 1;
    land(400, 56, 1);
    expect([3, 4, 5].every((c) => s.grid[i(0, c)] === 0)).toBe(true);
    expect(s.score).toBe(30);
    expect(s.misses).toBe(0);
  });

  it('two of a colour do not pop', () => {
    const { s, land } = board();
    s.grid[i(0, 4)] = 1;
    land(400, 56, 1);
    expect(s.grid[i(0, 4)]).toBe(1);
    expect(s.grid[i(0, 5)]).toBe(1);
    expect(s.score).toBe(0);
    expect(s.misses).toBe(1);
  });

  it('bubbles cut off from the ceiling fall and score extra', () => {
    const { s, land } = board();
    s.grid[i(0, 3)] = 1;
    s.grid[i(0, 4)] = 1;
    s.grid[i(1, 3)] = 2;
    s.grid[i(2, 3)] = 2;
    land(400, 56, 1);
    expect(s.grid.every((v) => v === 0)).toBe(true);
    expect(s.falling).toHaveLength(2);
    expect(s.score).toBe(3 * 10 + 2 * 30);
  });

  it('bubbles still attached to the ceiling are kept', () => {
    const { s, land } = board();
    s.grid[i(0, 3)] = 1;
    s.grid[i(0, 4)] = 1;
    s.grid[i(0, 2)] = 2; // hangs off the ceiling by itself
    land(400, 56, 1);
    expect(s.grid[i(0, 2)]).toBe(2);
    expect(s.falling).toHaveLength(0);
  });

  it('shots that bounce off the walls keep going', () => {
    const { s, tick } = board();
    s.aim = 1.2;
    tick(1, held({}, { a: true }));
    const vx0 = Math.sign(s.flight.vx);
    for (let k = 0; k < 40 && s.flight.active; k++) tick(1);
    expect(Math.sign(s.flight.vx)).toBe(-vx0);
    expect(s.flight.x).toBeGreaterThan(180);
    expect(s.flight.x).toBeLessThan(620);
  });

  it('the ceiling drops a row after too many misses, keeping every bubble where it was', () => {
    const { s, land } = board();
    s.level = 1;
    s.misses = 6; // the 7th miss triggers it at level 1
    s.grid[i(0, 0)] = 3;
    const before = s.par;
    land(600, 56, 2);
    expect(s.par).not.toBe(before);
    expect(s.grid[i(1, 0)]).toBe(3);
    expect(s.grid.slice(0, 10).every((v) => v > 0)).toBe(true);
    expect(s.misses).toBe(0);
  });

  it('a bubble that lands on the danger row ends the game', () => {
    const { s, land } = board();
    for (let r = 0; r <= 11; r++) for (let c = 0; c < (r % 2 ? 10 : 11); c++) s.grid[i(r, c)] = ((r + c) % 3) + 1;
    land(380, 36 + 20 + 12 * 35, 4); // directly under a row-11 bubble, close enough to touch it
    expect(s.over).toBe(true);
  });

  it('clearing the board starts the next level with more rows', () => {
    const { s, tick, land } = board();
    s.grid[i(0, 0)] = 1;
    s.grid[i(0, 1)] = 1;
    land(280, 56, 1);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(120);
    expect(s.level).toBe(2);
    expect(s.grid.filter((v) => v > 0).length).toBeGreaterThan(30);
  });

  it('the loaded bubble is always a colour still on the board; B swaps it with the next one', () => {
    const rng = createRng(11);
    const s = orbPopper.init({ rng, hiScore: 0 });
    const present = new Set(s.grid.filter((v) => v > 0));
    expect(present.has(s.current)).toBe(true);
    expect(present.has(s.next)).toBe(true);
    const [a, b] = [s.current, s.next];
    orbPopper.update(s, held({}, { b: true }), TICK, { rng, emit: () => undefined });
    expect([s.current, s.next]).toEqual([b, a]);
  });

  it('the aim is limited to a sensible arc', () => {
    const { s, tick } = board();
    tick(300, held({ left: true }));
    expect(s.aim).toBeGreaterThanOrEqual(-1.3);
    tick(600, held({ right: true }));
    expect(s.aim).toBeLessThanOrEqual(1.3);
  });
});
