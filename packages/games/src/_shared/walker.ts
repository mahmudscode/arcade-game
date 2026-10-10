/** Tile-to-tile movement for grid games. Plain JSON data, so game state stays saveable. */
export interface Walker {
  tx: number;
  ty: number;
  /** Direction of the tile move in progress, or 0,0 when resting on a tile. */
  dx: number;
  dy: number;
  /** Progress through the move, 0..1. */
  p: number;
  /** Direction of the last completed move, so AI can avoid turning straight back. */
  lx?: number;
  ly?: number;
}

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
export type Dir = readonly [number, number];

export const newWalker = (x: number, y: number): Walker => ({ tx: x, ty: y, dx: 0, dy: 0, p: 0, lx: 0, ly: 0 });

/** True if moving by (dx, dy) would be a U-turn from the walker's last move. */
export const isReverse = (w: Walker, dx: number, dy: number) => (dx !== 0 || dy !== 0) && dx === 0 - (w.lx ?? 0) && dy === 0 - (w.ly ?? 0);
export const walkerPos = (w: Walker) => ({ x: w.tx + w.dx * w.p, y: w.ty + w.dy * w.p });

/**
 * Advances a walker by `speed` tiles/s. When it rests on a tile it asks `choose` for a direction and
 * starts only if `canEnter` allows. `onArrive` fires after each completed tile, and the walker
 * carries leftover movement into the next tile, so speed is independent of the frame step.
 */
export function stepWalker(
  w: Walker,
  speed: number,
  dt: number,
  choose: (w: Walker) => Dir | null,
  canEnter: (x: number, y: number, dx: number, dy: number) => boolean,
  onArrive?: (w: Walker) => void,
): void {
  let budget = speed * dt;
  for (let guard = 0; guard < 4; guard++) {
    if (w.dx === 0 && w.dy === 0) {
      const d = choose(w);
      if (!d || (d[0] === 0 && d[1] === 0) || !canEnter(w.tx, w.ty, d[0], d[1])) return;
      w.dx = d[0];
      w.dy = d[1];
      w.p = 0;
    }
    const need = 1 - w.p;
    if (budget < need) {
      w.p += budget;
      return;
    }
    budget -= need;
    w.tx += w.dx;
    w.ty += w.dy;
    w.lx = w.dx;
    w.ly = w.dy;
    w.dx = 0;
    w.dy = 0;
    w.p = 0;
    onArrive?.(w);
  }
}

/** Turns a walker around mid-tile (its tile becomes the one it was heading to). */
export function reverseWalker(w: Walker): void {
  if (w.dx === 0 && w.dy === 0) return;
  w.tx += w.dx;
  w.ty += w.dy;
  // `0 - x` rather than `-x`, so a zero component never becomes -0 in saved state.
  w.dx = 0 - w.dx;
  w.dy = 0 - w.dy;
  w.p = 1 - w.p;
}

export const heldDir = (held: { up: boolean; right: boolean; down: boolean; left: boolean }): Dir | null =>
  held.up ? DIRS[0] : held.right ? DIRS[1] : held.down ? DIRS[2] : held.left ? DIRS[3] : null;
