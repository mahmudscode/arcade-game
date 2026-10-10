import type { Input } from '@arcade/engine';

/** Rotation offsets of the second cell relative to the pivot: right, up, left, down (clockwise). */
export const ORIENT: readonly (readonly [number, number])[] = [[1, 0], [0, -1], [-1, 0], [0, 1]];

/**
 * Left/right auto-repeat for falling-block games: moves once on press, then repeats after a short
 * delay. Returns -1, 0 or 1 for this tick and keeps its timer in `s.moveTimer` (plain JSON state).
 */
export function autoRepeat(s: { moveTimer: number }, input: Input, dt: number): -1 | 0 | 1 {
  const dir = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
  if (dir === 0) {
    s.moveTimer = 0;
    return 0;
  }
  const first = input.pressed.left || input.pressed.right;
  s.moveTimer -= dt;
  if (!first && s.moveTimer > 0) return 0;
  s.moveTimer = first ? 0.18 : 0.08;
  return dir as -1 | 1;
}
