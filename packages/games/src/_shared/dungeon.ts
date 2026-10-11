import type { Rng } from '@arcade/engine';

/**
 * Pillared dungeon: border walls, a pillar on every even/even tile, and random extra wall segments
 * between pillars that are kept only while every floor tile stays connected. 1 = wall, 0 = floor.
 * Needs odd `cols` and `rows`.
 */
export function generateDungeon(rng: Rng, cols: number, rows: number): number[] {
  const idx = (x: number, y: number) => y * cols + x;
  const grid = Array.from({ length: cols * rows }, (_, i) => {
    const x = i % cols;
    const y = Math.floor(i / cols);
    return x === 0 || y === 0 || x === cols - 1 || y === rows - 1 || (x % 2 === 0 && y % 2 === 0) ? 1 : 0;
  });
  const floor = () => grid.filter((c) => c === 0).length;
  const connected = () => {
    const seen = new Set<number>([idx(1, 1)]);
    const queue = [idx(1, 1)];
    for (let h = 0; h < queue.length; h++) {
      const c = queue[h]!;
      for (const n of [c - 1, c + 1, c - cols, c + cols]) {
        if (n >= 0 && n < grid.length && grid[n] === 0 && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return seen.size === floor();
  };
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if ((x + y) % 2 !== 1 || rng.next() > 0.32) continue;
      grid[idx(x, y)] = 1;
      if (!connected()) grid[idx(x, y)] = 0;
    }
  }
  return grid;
}
