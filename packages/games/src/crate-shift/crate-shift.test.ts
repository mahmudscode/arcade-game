import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import crateShift from './index';
import { LEVELS } from './levels';

/** Breadth-first search over (player, crates) states to prove every level is solvable. */
function solvable(level: string[]): boolean {
  const rows = level.length;
  const cols = Math.max(...level.map((r) => r.length));
  const cell = (x: number, y: number) => level[y]![x] ?? ' ';
  const goals = new Set<number>();
  const crates: number[] = [];
  let player = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = cell(x, y);
      const i = y * cols + x;
      if (c === '.' || c === '*' || c === '+') goals.add(i);
      if (c === '$' || c === '*') crates.push(i);
      if (c === '@' || c === '+') player = i;
    }
  }
  const key = (p: number, cs: number[]) => `${p}|${[...cs].sort((a, b) => a - b).join(',')}`;
  const seen = new Set([key(player, crates)]);
  const queue: [number, number[]][] = [[player, crates]];
  while (queue.length > 0 && seen.size < 200000) {
    const [p, cs] = queue.shift()!;
    if (cs.every((c) => goals.has(c))) return true;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const x = (p % cols) + dx;
      const y = Math.floor(p / cols) + dy;
      if (cell(x, y) === '#' || x < 0 || y < 0) continue;
      const ni = y * cols + x;
      let next = cs;
      if (cs.includes(ni)) {
        const bx = x + dx;
        const by = y + dy;
        const bi = by * cols + bx;
        if (cell(bx, by) === '#' || cs.includes(bi)) continue;
        next = cs.map((c) => (c === ni ? bi : c));
      }
      const k = key(ni, next);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push([ni, next]);
      }
    }
  }
  return false;
}

const press = (name: keyof Input['pressed']): Input => ({ held: NO_INPUT.held, pressed: { ...NO_INPUT.pressed, [name]: true } });

describe('crate-shift', () => {
  it('every level is well formed and solvable', () => {
    LEVELS.forEach((lv, i) => {
      const flat = lv.join('');
      expect([...flat].filter((c) => c === '@' || c === '+').length, `level ${i + 1} players`).toBe(1);
      expect([...flat].filter((c) => c === '$' || c === '*').length, `level ${i + 1} crates`).toBe([...flat].filter((c) => c === '.' || c === '*' || c === '+').length);
      expect(solvable(lv), `level ${i + 1} solvable`).toBe(true);
    });
  });

  it('counts moves, pushes a crate and undo restores both', () => {
    // Level 1: player (1,1), crate (2,2), goal (2,3). Right then down pushes the crate onto the goal.
    const pushed = runHeadless(crateShift, { seed: 1, frames: 2, inputAt: (f) => [press('right'), press('down')][f]! });
    expect(pushed.state.moves).toBe(2);
    expect(pushed.state.crates[3 * pushed.state.cols + 2]).toBe(true);
    const walked = runHeadless(crateShift, { seed: 1, frames: 3, inputAt: (f) => [press('down'), press('right'), press('b')][f]! });
    expect(walked.state.moves).toBe(1);
    expect(walked.state.px).toBe(1);
    expect(walked.state.py).toBe(2);
  });

  it('is deterministic and saveable', () => {
    const script = (f: number): Input => press((['right', 'down', 'left', 'up'] as const)[f % 4]!);
    const a = runHeadless(crateShift, { seed: 3, frames: 400, inputAt: script });
    const b = runHeadless(crateShift, { seed: 3, frames: 400, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.parse(JSON.stringify(a.state))).toEqual(a.state);
  });
});
