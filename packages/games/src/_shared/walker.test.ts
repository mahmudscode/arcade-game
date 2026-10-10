import { describe, expect, it } from 'vitest';
import { DIRS, isReverse, newWalker, reverseWalker, stepWalker, walkerPos } from './walker';

const open = () => true;

describe('walker', () => {
  it('covers the same distance whatever the frame step', () => {
    const run = (dt: number, steps: number) => {
      const w = newWalker(0, 0);
      for (let i = 0; i < steps; i++) stepWalker(w, 3, dt, () => DIRS[1], open);
      return w.tx + w.dx * w.p;
    };
    expect(run(1 / 60, 120)).toBeCloseTo(6, 5);
    expect(run(1 / 30, 60)).toBeCloseTo(6, 5);
    expect(run(0.25, 8)).toBeCloseTo(6, 5);
  });

  it('only starts a move that canEnter allows', () => {
    const w = newWalker(2, 2);
    stepWalker(w, 5, 1, () => DIRS[1], () => false);
    expect(w).toMatchObject({ tx: 2, ty: 2, dx: 0 });
  });

  it('remembers its last move so AI can avoid U-turns, and never stores -0', () => {
    const w = newWalker(0, 0);
    stepWalker(w, 10, 0.1, () => DIRS[1], open);
    expect(w).toMatchObject({ tx: 1, lx: 1, ly: 0 });
    expect(isReverse(w, -1, 0)).toBe(true);
    expect(isReverse(w, 1, 0)).toBe(false);
    expect(isReverse(w, 0, 1)).toBe(false);
    expect(isReverse(newWalker(0, 0), -1, 0)).toBe(false);
    reverseWalker(w);
    expect(Object.is(w.dy, -0)).toBe(false);
  });

  it('a corridor walker that avoids reversing runs to the end without turning back', () => {
    const W = 10;
    const w = newWalker(0, 0);
    const seen: number[] = [];
    for (let i = 0; i < 400; i++) {
      stepWalker(
        w,
        4,
        1 / 60,
        (m) => {
          const opts = DIRS.filter(([dx, dy]) => dy === 0 && m.tx + dx >= 0 && m.tx + dx < W);
          const ahead = opts.filter(([dx, dy]) => !isReverse(m, dx, dy));
          return (ahead.length > 0 ? ahead : opts)[0] ?? null;
        },
        open,
      );
      seen.push(walkerPos(w).x);
    }
    // It must bounce only at the two ends: count direction changes.
    let turns = 0;
    for (let i = 2; i < seen.length; i++) if (Math.sign(seen[i]! - seen[i - 1]!) !== Math.sign(seen[i - 1]! - seen[i - 2]!) && seen[i] !== seen[i - 1]) turns++;
    expect(turns).toBeLessThanOrEqual(2);
  });
});
