import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import jellyPop from './index';

const script = (f: number): Input => ({
  held: { ...NO_INPUT.held, left: f % 200 < 80, right: f % 200 >= 100 && f % 200 < 180, down: f % 130 > 100 },
  pressed: { ...NO_INPUT.pressed, a: f % 12 === 0, b: f % 29 === 0, up: f % 37 === 0, right: f % 53 === 0, down: f % 61 === 0, left: f % 71 === 0 },
});

describe('jelly-pop', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(jellyPop, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(jellyPop, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(jellyPop, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(jellyPop, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, no NaN in state', () => {
    const { state, status } = runHeadless(jellyPop, { seed: 7, frames: 10000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toContain('null');
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(jellyPop, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(jellyPop, { seed: 9, frames: 120000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });
});

import { TICK, createRng } from '@arcade/engine';
import type { JellyState } from './index';

const COLS = 6;
const i = (x: number, y: number) => y * COLS + x;

function settle(grid: [number, number, number][]) {
  const rng = createRng(3);
  const s: JellyState = jellyPop.init({ rng, hiScore: 0 });
  s.grid.fill(0);
  for (const [x, y, c] of grid) s.grid[i(x, y)] = c;
  s.phase = 'resolve';
  s.timer = 0;
  for (let n = 0; n < 600 && s.phase === 'resolve'; n++) jellyPop.update(s, NO_INPUT, TICK, { rng, emit: () => undefined });
  return s;
}

describe('jelly-pop rules', () => {
  it('pops a connected group of four, not three', () => {
    const four = settle([[0, 11, 2], [1, 11, 2], [2, 11, 2], [2, 10, 2]]);
    expect(four.grid.every((v) => v === 0)).toBe(true);
    expect(four.score).toBe(40);
    const three = settle([[0, 11, 2], [1, 11, 2], [2, 11, 2]]);
    expect(three.grid.filter((v) => v).length).toBe(3);
    expect(three.score).toBe(0);
  });

  it('does not connect groups diagonally', () => {
    const s = settle([[0, 11, 1], [1, 11, 3], [2, 11, 1], [3, 11, 3], [1, 10, 1], [3, 10, 1]]);
    expect(s.score).toBe(0);
  });

  it('unsupported jellies fall, and a chain scores with a multiplier', () => {
    // Popping the row of 2s drops the trio of 1s next to the lone 1, forming a second group.
    const s = settle([[2, 11, 2], [3, 11, 2], [4, 11, 2], [5, 11, 2], [1, 11, 1], [2, 10, 1], [3, 10, 1], [4, 10, 1]]);
    expect(s.grid.every((v) => v === 0)).toBe(true);
    expect(s.score).toBe(4 * 10 * 1 + 4 * 10 * 8);
  });
});
