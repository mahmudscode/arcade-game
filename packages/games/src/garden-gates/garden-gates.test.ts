import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import gardenGates, { type GardenState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 160 < 40, right: f % 160 >= 80 && f % 160 < 120, up: f % 160 >= 40 && f % 160 < 80, down: f % 160 >= 120 }, { a: f % 10 === 0 });

describe('garden-gates', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(gardenGates, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(gardenGates, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(gardenGates, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(gardenGates, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(gardenGates, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(gardenGates, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(gardenGates, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = gardenGates.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      gardenGates.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) gardenGates.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 21;
const i = (x: number, y: number) => y * COLS + x;

/** A single corridor on row 5 (x 1..19), everything else wall. */
function corridor() {
  const rng = createRng(5);
  const s: GardenState = gardenGates.init({ rng, hiScore: 0 });
  s.grid = s.grid.map((_, k) => (Math.floor(k / COLS) === 5 && k % COLS >= 1 && k % COLS <= 19 ? 0 : 1));
  s.gates = [];
  s.bugs = [];
  s.respawn = 0;
  s.dots = 99;
  s.me = { tx: 3, ty: 5, dx: 0, dy: 0, p: 0 };
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) gardenGates.update(s, input, TICK, { rng, emit: () => undefined }); };
  const bug = (x: number, y: number) => ({ tx: x, ty: y, dx: 0, dy: 0, p: 0, wait: 0, home: { x, y } });
  return { s, tick, bug };
}

describe('garden-gates rules', () => {
  it('a closed gate blocks the corridor until the gardener pushes it open, then it lets them through', () => {
    const { s, tick } = corridor();
    s.gates.push({ x: 6, y: 5, open: 0, axis: 0 });
    tick(30, held({ right: true }));
    expect(s.gates[0]!.open).toBeGreaterThan(0); // pushed open
    tick(60, held({ right: true }));
    expect(s.me.tx).toBeGreaterThan(6);
  });

  it('a gate swings shut again, cutting the corridor behind the gardener', () => {
    const { s, tick, bug } = corridor();
    s.gates.push({ x: 6, y: 5, open: 0, axis: 0 });
    tick(30, held({ right: true }));
    tick(60, held({ right: true }));
    expect(s.me.tx).toBeGreaterThan(7);
    tick(240);
    expect(s.gates[0]!.open).toBe(0);
    s.bugs.push(bug(2, 5)); // a chaser on the far side can no longer follow
    tick(600);
    expect(s.bugs[0]!.tx).toBeLessThan(6);
    expect(s.lives).toBe(3);
  });

  it('a gate stays open while something stands in it', () => {
    const { s, tick } = corridor();
    s.gates.push({ x: 6, y: 5, open: 0.1, axis: 0 });
    s.me = { tx: 6, ty: 5, dx: 0, dy: 0, p: 0 };
    tick(120);
    expect(s.gates[0]!.open).toBeGreaterThan(0);
    s.me = { tx: 3, ty: 5, dx: 0, dy: 0, p: 0 };
    tick(60);
    expect(s.gates[0]!.open).toBe(0);
  });

  it('eats dots (10) and hearts (50); a heart lets the gardener eat bugs', () => {
    const { s, tick, bug } = corridor();
    s.grid[i(4, 5)] = 2;
    s.grid[i(5, 5)] = 3;
    s.bugs.push(bug(9, 5));
    s.bugs[0]!.wait = 99;
    tick(40, held({ right: true }));
    expect(s.score).toBe(60);
    expect(s.blossom).toBeGreaterThan(0);
    s.bugs[0]!.wait = 0;
    s.bugs[0]!.tx = s.me.tx;
    tick(2);
    expect(s.score).toBe(60 + 200);
    expect(s.lives).toBe(3);
  });

  it('touching a bug without a heart costs a life', () => {
    const { s, tick, bug } = corridor();
    s.bugs.push(bug(3, 5));
    tick(2);
    expect(s.lives).toBe(2);
  });

  it('bugs chase along the shortest route', () => {
    const { s, tick, bug } = corridor();
    s.me = { tx: 15, ty: 5, dx: 0, dy: 0, p: 0 };
    s.bugs.push(bug(3, 5));
    tick(90);
    expect(s.bugs[0]!.tx).toBeGreaterThan(6);
    tick(300); // it keeps coming, and gets the gardener
    expect(s.lives).toBe(2);
  });

  it('eating the last dot clears the garden and starts a new level', () => {
    const { s, tick } = corridor();
    s.grid.fill(1);
    for (let x = 1; x <= 19; x++) s.grid[i(x, 5)] = 0;
    s.grid[i(4, 5)] = 2;
    s.dots = 1;
    tick(60, held({ right: true }));
    tick(200);
    expect(s.level).toBe(2);
    expect(s.gates.length).toBeGreaterThan(0);
  });

  it('every generated level places gates only in straight corridors, away from the start', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = gardenGates.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.gates.length).toBeGreaterThanOrEqual(1);
      for (const g of s.gates) {
        expect(s.grid[i(g.x, g.y)]).not.toBe(1);
        expect(Math.abs(g.x - 10) + Math.abs(g.y - 13)).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
