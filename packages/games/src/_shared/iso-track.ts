import type { Rng } from '@arcade/engine';

/** Isometric ribbon tracks on a square tile grid: used by the marble race and the jungle climb. */
export const N = 28;
export const VOID = -999;
export const TW = 44;
export const TH = 22;
export const HZ = 15;

export const tileH = (h: number[], ix: number, iy: number) => (ix < 0 || iy < 0 || ix >= N || iy >= N ? VOID : h[iy * N + ix]!);
export const onTrack = (h: number[], x: number, y: number) => tileH(h, Math.floor(x), Math.floor(y)) > VOID / 2;

/** Smooth surface height: bilinear between tile centres, void neighbours borrowing the local tile's height. */
export function heightAt(h: number[], x: number, y: number): number {
  const here = tileH(h, Math.floor(x), Math.floor(y));
  if (here <= VOID / 2) return VOID;
  const fx = x - 0.5;
  const fy = y - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const g = (a: number, b: number) => {
    const v = tileH(h, a, b);
    return v <= VOID / 2 ? here : v;
  };
  return g(ix, iy) * (1 - tx) * (1 - ty) + g(ix + 1, iy) * tx * (1 - ty) + g(ix, iy + 1) * (1 - tx) * ty + g(ix + 1, iy + 1) * tx * ty;
}

export interface Track {
  /** Centre line, start to finish (each step is one tile east or south). */
  path: { x: number; y: number }[];
  /** N*N tile heights. */
  h: number[];
}

/**
 * A winding 3-wide track alternating east and south runs. `rise` makes it climb from `start`,
 * otherwise it descends from `start`. Slopes vary between flat and steep, steeper at higher levels.
 */
export function makeTrack(rng: Rng, level: number, rise: boolean, start: number): Track {
  const path: { x: number; y: number }[] = [{ x: 3, y: 3 }];
  const segments = Math.min(7 + level, 13);
  let dir = 0;
  const slopes = [0.18, 0.28, 0.4, 0.55, 0];
  const slopeAt: number[] = [0];
  outer: for (let seg = 0; seg < segments; seg++) {
    const len = rng.int(4, 7);
    const slope = seg === 0 ? 0.2 : rng.pick(slopes) + Math.min(level, 6) * 0.02;
    for (let k = 0; k < len; k++) {
      const last = path[path.length - 1]!;
      const nx = last.x + (dir === 0 ? 1 : 0);
      const ny = last.y + (dir === 1 ? 1 : 0);
      if (nx > N - 4 || ny > N - 4) break outer;
      path.push({ x: nx, y: ny });
      slopeAt.push(slope);
    }
    dir ^= 1;
  }
  const h = Array.from({ length: N * N }, () => VOID);
  let height = start;
  path.forEach((c, k) => {
    height += rise ? slopeAt[k]! : -slopeAt[k]!;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = (c.y + dy) * N + c.x + dx;
        if (h[i] === VOID) h[i] = height;
      }
    }
  });
  return { path, h };
}

export const isoX = (x: number, y: number) => (x - y) * (TW / 2);
export const isoY = (x: number, y: number, z: number) => (x + y) * (TH / 2) - z * HZ;

export function diamond(g: CanvasRenderingContext2D, cx: number, cy: number, fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(cx, cy - TH / 2);
  g.lineTo(cx + TW / 2, cy);
  g.lineTo(cx, cy + TH / 2);
  g.lineTo(cx - TW / 2, cy);
  g.closePath();
  g.fill();
}
