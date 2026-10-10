import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DIRS, heldDir, isReverse, newWalker, reverseWalker, stepWalker, walkerPos, type Walker } from '../_shared/walker';

const COLS = 15;
const ROWS = 13;
const CELL = 36;
const OX = (W - COLS * CELL) / 2;
const OY = 56;
const START = { x: 7, y: 11 };
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const SLIDE_SPEED = 12;
const EMPTY = 0;
const ICE = 1;
const GEM = 2;
const WALL = 3;

interface Enemy extends Walker {
  stun: number;
  /** Seconds left chewing through an ice block; the target tile is tx+cx, ty+cy. */
  chew: number;
  cx: number;
  cy: number;
}
interface Slider {
  x: number;
  y: number;
  dx: number;
  dy: number;
  p: number;
  gem: boolean;
  hits: number;
}

export interface ShoverState {
  grid: number[];
  me: Walker & { fx: number; fy: number; alive: boolean; invuln: number; pushCd: number };
  enemies: Enemy[];
  sliders: Slider[];
  sparks: Spark[];
  /** Enemies still to enter this level (not counting those on screen). */
  waiting: number;
  spawnTimer: number;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const cellAt = (s: ShoverState, x: number, y: number) => (inside(x, y) ? s.grid[idx(x, y)]! : WALL);
const cap = (level: number) => Math.min(2 + Math.ceil(level / 2), 4);

function buildLevel(s: ShoverState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return WALL;
    if (Math.abs(x - START.x) <= 1 && Math.abs(y - START.y) <= 1) return EMPTY;
    return rng.next() < 0.55 ? ICE : EMPTY;
  });
  // Three gem blocks hidden among the ice.
  const iceCells = s.grid.map((c, i) => (c === ICE ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < 3 && iceCells.length > 0; k++) {
    const pick = rng.int(0, iceCells.length - 1);
    s.grid[iceCells[pick]!] = GEM;
    iceCells.splice(pick, 1);
  }
  s.sliders = [];
  s.enemies = [];
  s.waiting = Math.min(5 + s.level, 12);
  s.spawnTimer = 0;
  Object.assign(s.me, newWalker(START.x, START.y), { fx: 0, fy: -1, alive: true, invuln: 1.5, pushCd: 0 });
}

function spawnEnemy(s: ShoverState, rng: Rng): void {
  for (let tries = 0; tries < 60; tries++) {
    const x = rng.int(1, COLS - 2);
    const y = rng.int(1, ROWS - 2);
    if (cellAt(s, x, y) !== EMPTY || Math.hypot(x - s.me.tx, y - s.me.ty) < 6) continue;
    s.enemies.push({ ...newWalker(x, y), stun: 0, chew: 0, cx: 0, cy: 0 });
    s.waiting -= 1;
    return;
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): ShoverState {
  const s: ShoverState = {
    grid: [],
    me: { ...newWalker(START.x, START.y), fx: 0, fy: -1, alive: true, invuln: 1.5, pushCd: 0 },
    enemies: [],
    sliders: [],
    sparks: [],
    waiting: 0,
    spawnTimer: 0,
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  buildLevel(s, rng);
  while (s.enemies.length < cap(s.level) && s.waiting > 0) spawnEnemy(s, rng);
  return s;
}

/** Pushes the block at (bx, by) along (dx, dy): it slides if the next tile is free, else ice crumbles. */
function pushBlock(s: ShoverState, bx: number, by: number, dx: number, dy: number, rng: Rng, emit: UpdateContext['emit']): void {
  const kind = cellAt(s, bx, by);
  if (cellAt(s, bx + dx, by + dy) === EMPTY) {
    s.grid[idx(bx, by)] = EMPTY;
    s.sliders.push({ x: bx, y: by, dx, dy, p: 0, gem: kind === GEM, hits: 0 });
    emit('fire');
  } else if (kind === ICE) {
    s.grid[idx(bx, by)] = EMPTY;
    s.score += 30;
    burst(s.sparks, rng, OX + bx * CELL + CELL / 2, OY + by * CELL + CELL / 2, COLORS.cyan, 8);
    emit('pickup');
  }
}

function gemsAligned(s: ShoverState): boolean {
  const gems = s.grid.map((c, i) => (c === GEM ? i : -1)).filter((i) => i >= 0);
  if (gems.length !== 3) return false;
  const xs = gems.map((i) => i % COLS).sort((a, b) => a - b);
  const ys = gems.map((i) => Math.floor(i / COLS)).sort((a, b) => a - b);
  const line = (v: number[]) => v[1]! - v[0]! === 1 && v[2]! - v[1]! === 1;
  return (ys[0] === ys[2] && line(xs)) || (xs[0] === xs[2] && line(ys));
}

function killPlayer(s: ShoverState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = walkerPos(s.me);
  burst(s.sparks, rng, OX + p.x * CELL + CELL / 2, OY + p.y * CELL + CELL / 2, COLORS.coral, 22);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: ShoverState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  stepSparks(s.sparks, dt);

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      s.score += 1000;
      buildLevel(s, rng);
      while (s.enemies.length < cap(s.level) && s.waiting > 0) spawnEnemy(s, rng);
      emit('wave');
    }
    return;
  }

  const me = s.me;
  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newWalker(START.x, START.y), { alive: true, invuln: 2.2, pushCd: 0 });
      // Enemies camping the start tile are sent back to the queue.
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        if (Math.hypot(s.enemies[i]!.tx - START.x, s.enemies[i]!.ty - START.y) < 4) {
          s.enemies.splice(i, 1);
          s.waiting += 1;
        }
      }
    }
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    me.pushCd = Math.max(0, me.pushCd - dt);
    const want = heldDir(input.held);
    if (want) {
      me.fx = want[0];
      me.fy = want[1];
      if (me.dx === -want[0] && me.dy === -want[1]) reverseWalker(me);
    }
    stepWalker(
      me,
      5,
      dt,
      () => {
        if (!want) return null;
        const bx = me.tx + want[0];
        const by = me.ty + want[1];
        const c = cellAt(s, bx, by);
        if (c === ICE || c === GEM) {
          if (me.pushCd <= 0) {
            pushBlock(s, bx, by, want[0], want[1], rng, emit);
            me.pushCd = 0.25;
          }
          return null;
        }
        return want;
      },
      (x, y, dx, dy) => cellAt(s, x + dx, y + dy) === EMPTY,
    );
  }

  // Sliding blocks crush whatever they run over.
  for (let i = s.sliders.length - 1; i >= 0; i--) {
    const b = s.sliders[i]!;
    b.p += SLIDE_SPEED * dt;
    while (b.p >= 1) {
      b.p -= 1;
      b.x += b.dx;
      b.y += b.dy;
      if (cellAt(s, b.x + b.dx, b.y + b.dy) !== EMPTY) {
        s.grid[idx(b.x, b.y)] = b.gem ? GEM : ICE;
        s.sliders.splice(i, 1);
        if (b.gem && gemsAligned(s)) {
          s.score += 5000;
          for (const e of s.enemies) e.stun = 6;
          emit('wave');
        }
        break;
      }
    }
    if (s.sliders[i] !== b) continue;
    const bx = b.x + b.dx * b.p;
    const by = b.y + b.dy * b.p;
    for (let k = s.enemies.length - 1; k >= 0; k--) {
      const e = s.enemies[k]!;
      const ep = walkerPos(e);
      if (Math.hypot(ep.x - bx, ep.y - by) < 0.75) {
        s.score += 400 * 2 ** Math.min(b.hits, 3);
        b.hits += 1;
        burst(s.sparks, rng, OX + ep.x * CELL + CELL / 2, OY + ep.y * CELL + CELL / 2, COLORS.gold, 14);
        s.enemies.splice(k, 1);
        emit('explode');
      }
    }
  }

  // Enemies.
  for (const e of s.enemies) {
    if (e.stun > 0) {
      e.stun -= dt;
      continue;
    }
    if (e.chew > 0) {
      e.chew -= dt;
      if (e.chew <= 0 && cellAt(s, e.tx + e.cx, e.ty + e.cy) === ICE) s.grid[idx(e.tx + e.cx, e.ty + e.cy)] = EMPTY;
      continue;
    }
    stepWalker(
      e,
      2.3 + Math.min(s.level, 10) * 0.12,
      dt,
      (w) => {
        const free = DIRS.filter(([dx, dy]) => cellAt(s, w.tx + dx, w.ty + dy) === EMPTY);
        const forward = free.filter(([dx, dy]) => !isReverse(w, dx, dy));
        const pool = forward.length > 0 ? forward : free;
        if (pool.length === 0) {
          // Boxed in: chew toward the player.
          const ice = DIRS.filter(([dx, dy]) => cellAt(s, w.tx + dx, w.ty + dy) === ICE);
          if (ice.length > 0) {
            const best = ice.reduce((a, b) => (Math.abs(w.tx + a[0] - me.tx) + Math.abs(w.ty + a[1] - me.ty) <= Math.abs(w.tx + b[0] - me.tx) + Math.abs(w.ty + b[1] - me.ty) ? a : b));
            e.cx = best[0];
            e.cy = best[1];
            e.chew = Math.max(0.8, 1.6 - s.level * 0.05);
          }
          return null;
        }
        if (rng.next() < Math.min(0.45 + s.level * 0.03, 0.8)) {
          return pool.reduce((a, b) => (Math.abs(w.tx + a[0] - me.tx) + Math.abs(w.ty + a[1] - me.ty) <= Math.abs(w.tx + b[0] - me.tx) + Math.abs(w.ty + b[1] - me.ty) ? a : b));
        }
        return rng.pick(pool);
      },
      (x, y, dx, dy) => cellAt(s, x + dx, y + dy) === EMPTY,
    );
  }

  // Player vs enemies.
  if (me.alive) {
    const mp = walkerPos(me);
    for (let k = s.enemies.length - 1; k >= 0; k--) {
      const e = s.enemies[k]!;
      const ep = walkerPos(e);
      if (Math.hypot(ep.x - mp.x, ep.y - mp.y) > 0.6) continue;
      if (e.stun > 0) {
        s.score += 100;
        s.enemies.splice(k, 1);
        emit('pickup');
      } else if (me.invuln <= 0) {
        killPlayer(s, rng, emit);
        break;
      }
    }
  }

  // Bring in the next enemy.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.waiting > 0 && s.enemies.length < cap(s.level) && me.alive) {
    s.spawnTimer = 4;
    spawnEnemy(s, rng);
  }
  if (s.waiting <= 0 && s.enemies.length === 0 && s.levelDelay <= 0 && me.alive) s.levelDelay = 1.6;

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: ShoverState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const px = (x: number) => OX + x * CELL;
  const py = (y: number) => OY + y * CELL;
  g.fillStyle = '#1d1440';
  g.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === WALL) {
        g.fillStyle = COLORS.purple;
        g.fillRect(px(x) + 1, py(y) + 1, CELL - 2, CELL - 2);
      } else if (c === ICE || c === GEM) block(g, px(x), py(y), c === GEM);
    }
  }
  for (const b of s.sliders) block(g, px(b.x + b.dx * b.p), py(b.y + b.dy * b.p), b.gem);
  for (const e of s.enemies) {
    const p = walkerPos(e);
    const cx = px(p.x) + CELL / 2;
    const cy = py(p.y) + CELL / 2;
    g.fillStyle = e.stun > 0 ? COLORS.muted : e.chew > 0 && Math.floor(time * 12) % 2 ? COLORS.paper : COLORS.gold;
    g.beginPath();
    g.arc(cx, cy, 12, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(cx - 6, cy - 4, 4, 5);
    g.fillRect(cx + 2, cy - 4, 4, 5);
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    const p = walkerPos(s.me);
    const cx = px(p.x) + CELL / 2;
    const cy = py(p.y) + CELL / 2;
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.arc(cx, cy, 13, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.paper;
    g.fillRect(cx - 7 + s.me.fx * 3, cy - 5 + s.me.fy * 3, 5, 6);
    g.fillRect(cx + 2 + s.me.fx * 3, cy - 5 + s.me.fy * 3, 5, 6);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  ENEMIES ${s.waiting + s.enemies.length}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'LEVEL CLEARED!', 270);
  gameOver(g, s.over);
}

function block(g: CanvasRenderingContext2D, x: number, y: number, gem: boolean): void {
  g.fillStyle = gem ? COLORS.gold : COLORS.cyan;
  g.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
  g.fillStyle = gem ? COLORS.paper : 'rgba(255,255,255,0.45)';
  g.fillRect(x + 6, y + 6, CELL - 18, 5);
  g.fillRect(x + 6, y + 6, 5, CELL - 18);
}

const game: GameDefinition<ShoverState> = {
  id: 'frost-shover',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
