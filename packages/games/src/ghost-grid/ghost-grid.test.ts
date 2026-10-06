import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import { createRng } from '@arcade/engine';
import { MCOLS, MROWS, generateMaze } from '../_shared/maze-chase';
import ghostGrid from './index';

const script = (f: number): Input => ({
  held: { ...NO_INPUT.held, left: f % 200 < 80, right: f % 200 >= 100 && f % 200 < 180, up: f % 90 < 20, down: f % 130 > 100, a: f % 12 < 6 },
  pressed: { ...NO_INPUT.pressed, a: f % 12 === 0, up: f % 37 === 0, right: f % 53 === 0, down: f % 61 === 0, left: f % 71 === 0 },
});

/** Every number anywhere in the state must be finite (JSON would silently turn NaN into null). */
const allFinite = (v: unknown): boolean =>
  typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(allFinite) : v && typeof v === 'object' ? Object.values(v).every(allFinite) : true;

describe('ghost-grid', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(ghostGrid, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(ghostGrid, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(ghostGrid, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(ghostGrid, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, no NaN in state', () => {
    const { state, status } = runHeadless(ghostGrid, { seed: 7, frames: 10000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(allFinite(state)).toBe(true);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(ghostGrid, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('generated mazes are fully connected', () => {
    const rng = createRng(11);
    for (let n = 0; n < 20; n++) {
      const grid = generateMaze(rng);
      const start = grid.findIndex((c) => c !== 1);
      const seen = new Set([start]);
      const stack = [start];
      while (stack.length) {
        const i = stack.pop()!;
        const x = i % MCOLS;
        const y = Math.floor(i / MCOLS);
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= MCOLS || ny >= MROWS) continue;
          const j = ny * MCOLS + nx;
          if (grid[j] !== 1 && !seen.has(j)) {
            seen.add(j);
            stack.push(j);
          }
        }
      }
      expect(seen.size).toBe(grid.filter((c) => c !== 1).length);
    }
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(ghostGrid, { seed: 9, frames: 120000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });
});
