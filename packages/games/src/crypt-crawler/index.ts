import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DIRS, heldDir, isReverse, newWalker, reverseWalker, stepWalker, walkerPos, type Walker } from '../_shared/walker';

const COLS = 19;
const ROWS = 11;
const CELL = 36;
const OX = (W - COLS * CELL) / 2;
const OY = 70;
const START = { x: 1, y: 9 };
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const BULLET_SPEED = 14;
const FOE_BULLET_SPEED = 8;

/** Monster tiers: speed (tiles/s), points, seconds between shots, colour. */
const KINDS = [
  { name: 'burwor', speed: 2.6, points: 100, fire: 4.6, color: '#5b8cff' },
  { name: 'garwor', speed: 3.1, points: 200, fire: 3.6, color: COLORS.gold },
  { name: 'thorwor', speed: 3.8, points: 500, fire: 2.6, color: COLORS.coral },
] as const;

interface Monster extends Walker {
  kind: 0 | 1 | 2;
  cd: number;
}
interface Bullet {
  x: number;
  y: number;
  dx: number;
  dy: number;
  mine: boolean;
}

export interface CryptState {
  /** 1 wall, 0 floor. */
  grid: number[];
  me: Walker & { fx: number; fy: number; alive: boolean; invuln: number };
  monsters: Monster[];
  bullets: Bullet[];
  sparks: Spark[];
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
}

const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const wall = (s: CryptState, x: number, y: number) => !inside(x, y) || s.grid[idx(x, y)] === 1;
const px = (x: number) => OX + x * CELL + CELL / 2;
const py = (y: number) => OY + y * CELL + CELL / 2;

function reachable(grid: number[]): boolean {
  const seen = new Set<number>([idx(1, 1)]);
  const queue = [idx(1, 1)];
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h]!;
    for (const [dx, dy] of DIRS) {
      const nx = (c % COLS) + dx;
      const ny = Math.floor(c / COLS) + dy;
      if (inside(nx, ny) && grid[idx(nx, ny)] === 0 && !seen.has(idx(nx, ny))) {
        seen.add(idx(nx, ny));
        queue.push(idx(nx, ny));
      }
    }
  }
  return seen.size === grid.filter((c) => c === 0).length;
}

export function generateDungeon(rng: Rng): number[] {
  const grid = Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    return x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0) ? 1 : 0;
  });
  // Extra wall segments between pillars, kept only while the dungeon stays connected.
  const spots: number[] = [];
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if ((x + y) % 2 === 1) spots.push(idx(x, y));
  for (const i of spots) {
    if (rng.next() > 0.32) continue;
    grid[i] = 1;
    if (!reachable(grid)) grid[i] = 0;
  }
  return grid;
}

function lineClear(s: CryptState, ax: number, ay: number, bx: number, by: number): boolean {
  if (ax !== bx && ay !== by) return false;
  const dx = Math.sign(bx - ax);
  const dy = Math.sign(by - ay);
  for (let x = ax + dx, y = ay + dy; x !== bx || y !== by; x += dx, y += dy) if (wall(s, x, y)) return false;
  return true;
}

function spawnWave(s: CryptState, rng: Rng): void {
  const count = Math.min(5 + s.wave, 10);
  const garwors = Math.min(s.wave - 1, 4);
  const thorwors = Math.min(Math.max(s.wave - 2, 0), 3);
  s.monsters = [];
  for (let i = 0; i < count; i++) {
    const kind = (i < thorwors ? 2 : i < thorwors + garwors ? 1 : 0) as 0 | 1 | 2;
    for (let tries = 0; tries < 80; tries++) {
      const x = rng.int(1, COLS - 2);
      const y = rng.int(1, ROWS - 2);
      if (wall(s, x, y) || Math.abs(x - START.x) + Math.abs(y - START.y) < 9 || s.monsters.some((m) => m.tx === x && m.ty === y)) continue;
      s.monsters.push({ ...newWalker(x, y), kind, cd: rng.range(1.5, KINDS[kind].fire) });
      break;
    }
  }
}

function newWave(s: CryptState, rng: Rng): void {
  s.grid = generateDungeon(rng);
  s.bullets = [];
  Object.assign(s.me, newWalker(START.x, START.y), { fx: 1, fy: 0, alive: true, invuln: 1.5 });
  spawnWave(s, rng);
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): CryptState {
  const s: CryptState = {
    grid: [],
    me: { ...newWalker(START.x, START.y), fx: 1, fy: 0, alive: true, invuln: 1.5 },
    monsters: [],
    bullets: [],
    sparks: [],
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
  };
  newWave(s, rng);
  return s;
}

function killPlayer(s: CryptState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = walkerPos(s.me);
  burst(s.sparks, rng, px(p.x), py(p.y), COLORS.gold, 22);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: CryptState, input: Input, dt: number, ctx: UpdateContext): void {
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
      s.wave += 1;
      newWave(s, rng);
      emit('wave');
    }
    return;
  }

  const me = s.me;
  const wasAlive = me.alive;
  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newWalker(START.x, START.y), { fx: 1, fy: 0, alive: true, invuln: 2.2 });
      // Keep monsters from camping the entrance.
      for (const m of s.monsters) {
        if (Math.abs(m.tx - START.x) + Math.abs(m.ty - START.y) < 5) {
          m.cd = Math.max(m.cd, 2);
        }
      }
    }
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    const want = heldDir(input.held);
    if (want) {
      me.fx = want[0];
      me.fy = want[1];
      if (me.dx === -want[0] && me.dy === -want[1]) reverseWalker(me);
    }
    stepWalker(me, 5.5, dt, () => want, (x, y, dx, dy) => !wall(s, x + dx, y + dy));
    if ((input.pressed.a || input.pressed.b) && !s.bullets.some((b) => b.mine)) {
      const p = walkerPos(me);
      s.bullets.push({ x: p.x, y: p.y, dx: me.fx, dy: me.fy, mine: true });
      emit('fire');
    }
  }

  // Monsters speed up as the pack thins out.
  const rush = s.monsters.length <= 2 ? 1.45 : 1;
  for (const m of s.monsters) {
    const k = KINDS[m.kind];
    m.cd -= dt;
    stepWalker(
      m,
      k.speed * rush + s.wave * 0.05,
      dt,
      (w) => {
        const free = DIRS.filter(([dx, dy]) => !wall(s, w.tx + dx, w.ty + dy));
        const forward = free.filter(([dx, dy]) => !isReverse(w, dx, dy));
        const pool = forward.length > 0 ? forward : free;
        if (pool.length === 0) return null;
        if (me.alive && rng.next() < 0.55) {
          return pool.reduce((a, b) => (Math.abs(w.tx + a[0] - me.tx) + Math.abs(w.ty + a[1] - me.ty) <= Math.abs(w.tx + b[0] - me.tx) + Math.abs(w.ty + b[1] - me.ty) ? a : b));
        }
        return rng.pick(pool);
      },
      (x, y, dx, dy) => !wall(s, x + dx, y + dy),
    );
    if (me.alive && m.cd <= 0 && lineClear(s, m.tx, m.ty, me.tx, me.ty) && (m.tx === me.tx || m.ty === me.ty)) {
      const dx = Math.sign(me.tx - m.tx);
      const dy = Math.sign(me.ty - m.ty);
      if ((dx !== 0 || dy !== 0) && !s.bullets.some((b) => !b.mine && Math.hypot(b.x - m.tx, b.y - m.ty) < 0.5)) {
        s.bullets.push({ x: m.tx, y: m.ty, dx, dy, mine: false });
        m.cd = k.fire;
      }
    }
  }

  // Bullets.
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    const speed = b.mine ? BULLET_SPEED : FOE_BULLET_SPEED;
    const steps = Math.ceil((speed * dt) / 0.25);
    let dead = false;
    for (let k = 0; k < steps && !dead; k++) {
      b.x += (b.dx * speed * dt) / steps;
      b.y += (b.dy * speed * dt) / steps;
      if (wall(s, Math.round(b.x), Math.round(b.y))) {
        dead = true;
        break;
      }
      if (b.mine) {
        const hit = s.monsters.findIndex((m) => {
          const mp = walkerPos(m);
          return Math.hypot(mp.x - b.x, mp.y - b.y) < 0.55;
        });
        if (hit >= 0) {
          const m = s.monsters[hit]!;
          const mp = walkerPos(m);
          s.score += KINDS[m.kind].points;
          burst(s.sparks, rng, px(mp.x), py(mp.y), KINDS[m.kind].color, 12);
          s.monsters.splice(hit, 1);
          emit('explode');
          dead = true;
        }
      } else if (me.alive && me.invuln <= 0) {
        const mp = walkerPos(me);
        if (Math.hypot(mp.x - b.x, mp.y - b.y) < 0.45) {
          dead = true;
          killPlayer(s, rng, emit);
        }
      }
    }
    if (dead && s.bullets[i] === b) s.bullets.splice(i, 1);
  }

  // Monster contact.
  if (me.alive && me.invuln <= 0) {
    const mp = walkerPos(me);
    if (s.monsters.some((m) => {
      const p = walkerPos(m);
      return Math.hypot(p.x - mp.x, p.y - mp.y) < 0.6;
    })) killPlayer(s, rng, emit);
  }
  if (wasAlive && !me.alive) s.bullets = [];

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (!s.over && s.monsters.length === 0 && me.alive) {
    s.score += 500;
    s.levelDelay = 1.6;
  }
  if (s.score > s.hi) s.hi = s.score;
}

/** Garwors are only visible up close; everything shows on the radar. */
export function visibleOnScreen(s: CryptState, m: Monster): boolean {
  if (m.kind !== 1) return true;
  const mp = walkerPos(m);
  const p = walkerPos(s.me);
  return Math.hypot(mp.x - p.x, mp.y - p.y) < 4.5;
}

function render(s: CryptState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (s.grid[idx(x, y)] !== 1) continue;
      g.fillStyle = COLORS.purple;
      g.fillRect(OX + x * CELL + 2, OY + y * CELL + 2, CELL - 4, CELL - 4);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(OX + x * CELL + 2, OY + y * CELL + CELL / 2, CELL - 4, 3);
    }
  }
  for (const m of s.monsters) {
    if (!visibleOnScreen(s, m)) continue;
    const p = walkerPos(m);
    const k = KINDS[m.kind];
    g.fillStyle = k.color;
    g.beginPath();
    g.arc(px(p.x), py(p.y) - 1, 13, Math.PI, 0);
    g.lineTo(px(p.x) + 13, py(p.y) + 12);
    g.lineTo(px(p.x) - 13, py(p.y) + 12);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(px(p.x) - 7, py(p.y) - 5, 4, 5);
    g.fillRect(px(p.x) + 3, py(p.y) - 5, 4, 5);
    if (Math.floor(time * 5) % 2) g.fillRect(px(p.x) - 6, py(p.y) + 5, 12, 3);
  }
  for (const b of s.bullets) {
    g.fillStyle = b.mine ? COLORS.cyan : COLORS.coral;
    g.fillRect(px(b.x) - 3, py(b.y) - 3, 7, 7);
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    const p = walkerPos(s.me);
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.arc(px(p.x), py(p.y), 12, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(px(p.x) - 4 + s.me.fx * 4, py(p.y) - 4 + s.me.fy * 4, 8, 8);
    g.fillStyle = COLORS.cyan;
    g.fillRect(px(p.x) + s.me.fx * 12 - 2, py(p.y) + s.me.fy * 12 - 2, 5, 5);
  }
  drawSparks(g, s.sparks);

  // Radar.
  const rx = (W - COLS * 8) / 2;
  const ry = OY + ROWS * CELL + 14;
  g.fillStyle = 'rgba(79,227,214,0.12)';
  g.fillRect(rx - 4, ry - 4, COLS * 8 + 8, ROWS * 8 + 8);
  g.fillStyle = COLORS.muted;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (s.grid[idx(x, y)] === 1) g.fillRect(rx + x * 8 + 3, ry + y * 8 + 3, 2, 2);
  for (const m of s.monsters) {
    const p = walkerPos(m);
    g.fillStyle = KINDS[m.kind].color;
    g.fillRect(rx + p.x * 8 + 1, ry + p.y * 8 + 1, 6, 6);
  }
  if (s.me.alive) {
    const p = walkerPos(s.me);
    g.fillStyle = COLORS.paper;
    g.fillRect(rx + p.x * 8 + 1, ry + p.y * 8 + 1, 6, 6);
  }
  hud(g, s, `DUNGEON ${s.wave}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'DUNGEON CLEARED!', 36);
  gameOver(g, s.over);
}

const game: GameDefinition<CryptState> = {
  id: 'crypt-crawler',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};
export default game;
