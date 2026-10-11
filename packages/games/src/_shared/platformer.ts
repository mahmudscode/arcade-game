/**
 * Tile platformer physics (PF archetype). Coordinates are in tiles, y grows downward, and a body's
 * `y` is its feet. A tile (tx, ty) covers [tx, tx+1) x [ty, ty+1). Everything is plain JSON data.
 */
export interface Body {
  /** Horizontal centre. */
  x: number;
  /** Feet. */
  y: number;
  vx: number;
  vy: number;
  face: number;
  onGround: boolean;
  climbing: boolean;
  /** Seconds left in which a one-way floor is ignored (dropping through). */
  drop: number;
  /** Seconds left before a ladder can be grabbed again (set when jumping off one). */
  grabCd?: number;
}

export interface PlatWorld {
  /** Blocks from every side. */
  solid(tx: number, ty: number): boolean;
  /** One-way floors: can be stood on, walked and jumped through from below. */
  platform?(tx: number, ty: number): boolean;
  ladder?(tx: number, ty: number): boolean;
}

export interface PlatConfig {
  gravity: number;
  /** Upward speed of a jump; 0 disables jumping. */
  jump: number;
  walk: number;
  climb: number;
  maxFall: number;
  /** Fraction of walking speed available in the air. */
  air: number;
  /** Half width / height of the body. */
  hw: number;
  h: number;
}

export const DEFAULT_PLAT: PlatConfig = { gravity: 38, jump: 12.5, walk: 5, climb: 3.6, maxFall: 20, air: 0.8, hw: 0.28, h: 0.9 };

export interface Intent {
  dir: number;
  up: boolean;
  down: boolean;
  jump: boolean;
}

export interface StepResult {
  landed: boolean;
  /** Tile whose underside the head hit, if any. */
  bumped?: { tx: number; ty: number };
}

export const newBody = (x: number, y: number): Body => ({ x, y, vx: 0, vy: 0, face: 1, onGround: false, climbing: false, drop: 0 });

const EPS = 1e-6;

export function isLadder(w: PlatWorld, tx: number, ty: number): boolean {
  return !!w.ladder?.(tx, ty);
}
/** Anything a body can stand on. The top cell of a ladder counts as a floor. */
export function isFloor(w: PlatWorld, tx: number, ty: number, ignoreOneWay = false): boolean {
  if (w.solid(tx, ty)) return true;
  if (!ignoreOneWay && w.platform?.(tx, ty)) return true;
  return isLadder(w, tx, ty) && !isLadder(w, tx, ty - 1);
}

/** True if the body's feet rest exactly on a floor. */
export function supported(b: Body, w: PlatWorld, cfg: PlatConfig = DEFAULT_PLAT): boolean {
  if (Math.abs(b.y - Math.round(b.y)) > 1e-4) return false;
  const row = Math.round(b.y);
  return isFloor(w, Math.floor(b.x - cfg.hw), row, b.drop > 0) || isFloor(w, Math.floor(b.x + cfg.hw), row, b.drop > 0);
}

export function stepBody(b: Body, w: PlatWorld, intent: Intent, dt: number, cfg: PlatConfig = DEFAULT_PLAT): StepResult {
  const result: StepResult = { landed: false };
  b.drop = Math.max(0, b.drop - dt);
  if (b.grabCd) b.grabCd = Math.max(0, b.grabCd - dt);
  if (intent.dir !== 0) b.face = intent.dir;

  // ---- ladders
  const cx = Math.floor(b.x);
  const centred = Math.abs(b.x - (cx + 0.5)) < 0.4;
  if (!b.climbing && centred && !b.grabCd) {
    const above = isLadder(w, cx, Math.floor(b.y - EPS));
    const below = isLadder(w, cx, Math.floor(b.y + EPS));
    if ((intent.up && above) || (intent.down && below && (b.onGround || supported(b, w, cfg)))) {
      b.climbing = true;
      b.x = cx + 0.5;
      b.vx = 0;
      b.vy = 0;
      b.onGround = false;
    }
  }
  if (b.climbing) {
    b.vx = 0;
    b.vy = 0;
    if (intent.jump && cfg.jump > 0 && intent.dir !== 0) {
      b.climbing = false;
      b.grabCd = 0.3;
      b.vy = -cfg.jump * 0.8;
      b.vx = intent.dir * cfg.walk;
    } else {
      const dy = ((intent.down ? 1 : 0) - (intent.up ? 1 : 0)) * cfg.climb * dt;
      let ny = b.y + dy;
      const col = Math.floor(b.x);
      if (dy < 0) {
        // Climbing past the top cell: stand on it.
        if (!isLadder(w, col, Math.floor(ny - EPS))) {
          ny = Math.floor(b.y - EPS) + 0;
          b.climbing = false;
          b.onGround = true;
          b.y = ny;
          return result;
        }
      } else if (dy > 0) {
        // Climbing down off the bottom: stand on whatever is there, else keep falling.
        if (!isLadder(w, col, Math.floor(ny + EPS)) && Math.floor(ny + EPS) !== Math.floor(b.y + EPS)) {
          ny = Math.floor(ny) + 0;
          b.y = ny;
          b.climbing = false;
          b.onGround = supported(b, w, cfg);
          return result;
        }
      }
      b.y = ny;
      // Step off sideways onto a floor.
      if (intent.dir !== 0 && Math.abs(b.y - Math.round(b.y)) < 0.12) {
        const row = Math.round(b.y);
        const sideX = Math.floor(b.x + intent.dir * 0.8);
        if (isFloor(w, sideX, row) && !w.solid(sideX, row - 1)) {
          // Hop onto the floor tile, so both feet are over it and it doesn't fall past the edge.
          b.x = intent.dir > 0 ? sideX + cfg.hw + 0.02 : sideX + 1 - cfg.hw - 0.02;
          b.y = row + 0;
          b.climbing = false;
          b.onGround = true;
        }
      }
      return result;
    }
  }

  // ---- walking and jumping
  const grounded = supported(b, w, cfg);
  b.onGround = grounded;
  if (grounded) {
    b.vx = intent.dir * cfg.walk;
    if (intent.jump && cfg.jump > 0) {
      b.vy = -cfg.jump;
      b.onGround = false;
    } else if (intent.down && b.drop <= 0 && !intent.up) {
      // Drop through a one-way floor when standing only on one.
      const row = Math.round(b.y);
      const l = Math.floor(b.x - cfg.hw);
      const r = Math.floor(b.x + cfg.hw);
      const onlyOneWay = [l, r].every((t) => !w.solid(t, row) && !(isLadder(w, t, row) && !isLadder(w, t, row - 1)));
      if (onlyOneWay && (w.platform?.(l, row) || w.platform?.(r, row))) {
        b.drop = 0.25;
        b.onGround = false;
      }
    }
  } else {
    b.vx = intent.dir * cfg.walk * cfg.air;
  }

  // Horizontal move with wall collision.
  if (b.vx !== 0) {
    const nx = b.x + b.vx * dt;
    const edge = nx + Math.sign(b.vx) * cfg.hw;
    const tx = Math.floor(edge);
    let blocked = false;
    for (let ty = Math.floor(b.y - cfg.h + 0.08); ty <= Math.floor(b.y - 0.08); ty++) if (w.solid(tx, ty)) blocked = true;
    if (!blocked) b.x = nx;
    else b.x = b.vx > 0 ? tx - cfg.hw - EPS : tx + 1 + cfg.hw + EPS;
  }

  // Vertical move.
  if (!b.onGround) {
    b.vy = Math.min(cfg.maxFall, b.vy + cfg.gravity * dt);
    const prev = b.y;
    const ny = prev + b.vy * dt;
    const l = Math.floor(b.x - cfg.hw + EPS);
    const r = Math.floor(b.x + cfg.hw - EPS);
    if (b.vy >= 0) {
      // Every tile top the feet cross this step is a chance to land.
      for (let k = Math.ceil(prev - EPS); k <= Math.floor(ny + EPS); k++) {
        if (isFloor(w, l, k, b.drop > 0) || isFloor(w, r, k, b.drop > 0)) {
          b.y = k + 0; // (+ 0 turns a -0 from Math.ceil into 0)
          b.vy = 0;
          b.onGround = true;
          result.landed = true;
          return result;
        }
      }
      b.y = ny;
    } else {
      const head = ny - cfg.h;
      const hrow = Math.floor(head);
      const hitTile = [l, r].find((t) => w.solid(t, hrow));
      if (hitTile !== undefined && Math.floor(prev - cfg.h) !== hrow) {
        b.y = hrow + 1 + cfg.h + EPS;
        b.vy = 0;
        result.bumped = { tx: hitTile, ty: hrow };
      } else b.y = ny;
    }
  }
  return result;
}

export interface PathStep {
  dir: number;
  up: boolean;
  down: boolean;
}

/**
 * First step of a shortest route between two body cells (x, row-of-body, where the feet are at row + 1),
 * following the same rules the physics allows: walking on floors, climbing ladders, and falling.
 * `extra` can add game-specific edges (e.g. scrambling out of a pit). Returns null if unreachable.
 */
export function pathStep(
  w: PlatWorld,
  cols: number,
  rows: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  extra?: (x: number, r: number, push: (nx: number, nr: number) => void) => void,
): PathStep | null {
  const free = (x: number, r: number) => x >= 0 && x < cols && r >= 0 && r < rows && !w.solid(x, r);
  const stand = (x: number, r: number) => isFloor(w, x, r + 1) || isLadder(w, x, r);
  const key = (x: number, r: number) => r * cols + x;
  const parent = new Map<number, number>([[key(from.x, from.y), -1]]);
  const queue: [number, number][] = [[from.x, from.y]];
  let origin: [number, number] = [from.x, from.y];
  const push = (x: number, r: number) => {
    // Falling continues until something can be stood on.
    let rr = r;
    while (free(x, rr) && !stand(x, rr) && rr < rows - 1) rr += 1;
    if (!free(x, rr) || !stand(x, rr) || parent.has(key(x, rr))) return;
    parent.set(key(x, rr), key(origin[0], origin[1]));
    queue.push([x, rr]);
  };
  for (let h = 0; h < queue.length; h++) {
    const [x, r] = queue[h]!;
    origin = [x, r];
    if (x === to.x && r === to.y) break;
    // Sideways steps need a floor underfoot (not the middle of a ladder); the start may be a ledge.
    if (isFloor(w, x, r + 1) || (x === from.x && r === from.y && !isLadder(w, x, r))) {
      for (const dx of [-1, 1]) if (free(x + dx, r)) push(x + dx, r);
    }
    if (isLadder(w, x, r) && free(x, r - 1)) push(x, r - 1);
    if (isLadder(w, x, r + 1)) push(x, r + 1);
    extra?.(x, r, push);
  }
  if (!parent.has(key(to.x, to.y))) return null;
  let cur = key(to.x, to.y);
  while (parent.get(cur) !== key(from.x, from.y) && parent.get(cur) !== -1) cur = parent.get(cur)!;
  if (cur === key(from.x, from.y)) return null;
  const nx = cur % cols;
  const nr = Math.floor(cur / cols);
  return { dir: Math.sign(nx - from.x), up: nr < from.y && nx === from.x, down: nr > from.y && nx === from.x };
}

/**
 * Applied every frame to an AI's intent: before a climb, ease toward the middle of the ladder column.
 * Bodies only grab a ladder near its centre and path steps are decided per tile, so an AI arriving at a
 * tile's edge would otherwise stall. The approach slows as it nears the centre, so it never overshoots.
 */
export function steerToLadder(b: Body, intent: { dir: number; up: boolean; down: boolean }): { dir: number; up: boolean; down: boolean } {
  if ((intent.up || intent.down) && !b.climbing) {
    const off = Math.floor(b.x) + 0.5 - b.x;
    if (Math.abs(off) > 0.2) return { dir: Math.sign(off) * Math.min(1, Math.abs(off) * 3), up: false, down: false };
  }
  return intent;
}
