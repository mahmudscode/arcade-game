import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, TAU, W, type Spark } from '../_shared';

const ROOM = { x: 0, y: 60, w: W, h: 480 };
const WALL = 8;
const GRID = 80;
const PLAYER_R = 8;
const ROBOT_R = 11;
const PLAYER_SPEED = 150;
const BULLET_SPEED = 430;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_LEVEL = 30;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Robot {
  x: number;
  y: number;
  cd: number;
  think: number;
  vx: number;
  vy: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mine: boolean;
}

export interface RoboState {
  walls: Rect[];
  robots: Robot[];
  bullets: Bullet[];
  px: number;
  py: number;
  fx: number;
  fy: number;
  alive: boolean;
  fireCd: number;
  /** Evil Otto: ignores walls, cannot be shot. Null until the room has dragged on. */
  otto: { x: number; y: number } | null;
  roomTime: number;
  entry: 'left' | 'right' | 'top' | 'bottom';
  killed: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  respawn: number;
  nextLife: number;
}

function buildWalls(rng: Rng, level: number): Rect[] {
  const walls: Rect[] = [];
  const { x, y, w, h } = ROOM;
  const gapX = [w / 2 - 50, w / 2 + 50];
  const gapY = [y + h / 2 - 50, y + h / 2 + 50];
  // Outer wall with a doorway in the middle of every side.
  walls.push({ x, y, w: gapX[0]! - x, h: WALL }, { x: gapX[1]!, y, w: w - gapX[1]!, h: WALL });
  walls.push({ x, y: y + h - WALL, w: gapX[0]! - x, h: WALL }, { x: gapX[1]!, y: y + h - WALL, w: w - gapX[1]!, h: WALL });
  walls.push({ x, y, w: WALL, h: gapY[0]! - y }, { x, y: gapY[1]!, w: WALL, h: y + h - gapY[1]! });
  walls.push({ x: x + w - WALL, y, w: WALL, h: gapY[0]! - y }, { x: x + w - WALL, y: gapY[1]!, w: WALL, h: y + h - gapY[1]! });
  // Interior segments on a lattice, kept off the outer ring so doorways stay reachable.
  const n = 5 + Math.min(level, 6);
  for (let i = 0; i < n; i++) {
    const lx = 160 + rng.int(0, 6) * GRID;
    const ly = y + 160 + rng.int(0, 2) * GRID;
    if (rng.next() < 0.5) walls.push({ x: lx, y: ly - WALL / 2, w: GRID, h: WALL });
    else walls.push({ x: lx - WALL / 2, y: ly, w: WALL, h: GRID });
  }
  return walls;
}

function hitsWall(walls: Rect[], x: number, y: number, r: number): boolean {
  for (const k of walls) if (x + r > k.x && x - r < k.x + k.w && y + r > k.y && y - r < k.y + k.h) return true;
  return false;
}

function entryPos(entry: RoboState['entry']): { x: number; y: number } {
  const cy = ROOM.y + ROOM.h / 2;
  if (entry === 'left') return { x: 36, y: cy };
  if (entry === 'right') return { x: W - 36, y: cy };
  if (entry === 'top') return { x: W / 2, y: ROOM.y + 36 };
  return { x: W / 2, y: ROOM.y + ROOM.h - 36 };
}

function enterRoom(s: RoboState, rng: Rng): void {
  s.walls = buildWalls(rng, s.level);
  s.bullets = [];
  s.robots = [];
  s.otto = null;
  s.roomTime = 0;
  s.killed = 0;
  const start = entryPos(s.entry);
  s.px = start.x;
  s.py = start.y;
  const count = Math.min(3 + Math.floor(s.level / 2), 9);
  let guard = 0;
  while (s.robots.length < count && guard++ < 400) {
    const x = rng.range(ROOM.x + 60, ROOM.x + ROOM.w - 60);
    const y = rng.range(ROOM.y + 50, ROOM.y + ROOM.h - 50);
    if (hitsWall(s.walls, x, y, ROBOT_R + 4)) continue;
    if (Math.hypot(x - s.px, y - s.py) < 200) continue;
    s.robots.push({ x, y, cd: rng.range(1.5, 3.5), think: 0, vx: 0, vy: 0 });
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RoboState {
  const s: RoboState = {
    walls: [],
    robots: [],
    bullets: [],
    px: 0,
    py: 0,
    fx: 1,
    fy: 0,
    alive: true,
    fireCd: 0,
    otto: null,
    roomTime: 0,
    entry: 'left',
    killed: 0,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    respawn: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
  enterRoom(s, rng);
  return s;
}

function kill(s: RoboState, rng: Rng, emit: UpdateContext['emit']): void {
  if (!s.alive) return;
  burst(s.sparks, rng, s.px, s.py, COLORS.cyan, 24);
  emit('die');
  s.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  if (s.lives <= 0) s.over = true;
}

function update(s: RoboState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  s.fireCd = Math.max(0, s.fireCd - dt);
  s.roomTime += dt;

  if (s.alive) {
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      s.fx = dx;
      s.fy = dy;
      const len = Math.hypot(dx, dy);
      const mx = (dx / len) * PLAYER_SPEED * dt;
      const my = (dy / len) * PLAYER_SPEED * dt;
      if (!hitsWall(s.walls, s.px + mx, s.py, PLAYER_R)) s.px += mx;
      if (!hitsWall(s.walls, s.px, s.py + my, PLAYER_R)) s.py += my;
    }
    if ((input.pressed.a || input.held.a) && s.fireCd <= 0 && s.bullets.filter((b) => b.mine).length < 2) {
      s.fireCd = 0.2;
      const len = Math.hypot(s.fx, s.fy) || 1;
      s.bullets.push({ x: s.px, y: s.py, vx: (s.fx / len) * BULLET_SPEED, vy: (s.fy / len) * BULLET_SPEED, mine: true });
      emit('fire');
    }
    // Leaving through a doorway moves to a fresh room.
    let exit: RoboState['entry'] | null = null;
    if (s.px < ROOM.x) exit = 'right';
    else if (s.px > ROOM.x + ROOM.w) exit = 'left';
    else if (s.py < ROOM.y) exit = 'bottom';
    else if (s.py > ROOM.y + ROOM.h) exit = 'top';
    if (exit) {
      if (s.robots.length === 0) s.score += 100 * s.killed;
      s.level = Math.min(s.level + 1, MAX_LEVEL + 1);
      s.entry = exit;
      enterRoom(s, rng);
      emit('wave');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.alive = true;
      const start = entryPos(s.entry);
      s.px = start.x;
      s.py = start.y;
      s.bullets = [];
      s.otto = null;
      s.roomTime = 0;
    }
  }

  // Robots shamble toward the player and shoot along straight lines.
  const lvl = Math.min(s.level, MAX_LEVEL);
  for (let i = s.robots.length - 1; i >= 0; i--) {
    const r = s.robots[i]!;
    r.think -= dt;
    if (r.think <= 0) {
      r.think = rng.range(0.4, 1);
      const ax = s.px - r.x;
      const ay = s.py - r.y;
      const horizontal = Math.abs(ax) > Math.abs(ay) ? rng.next() < 0.7 : rng.next() < 0.3;
      r.vx = horizontal ? Math.sign(ax) : 0;
      r.vy = horizontal ? 0 : Math.sign(ay);
    }
    const sp = 26 + lvl * 3.5;
    r.x += r.vx * sp * dt;
    r.y += r.vy * sp * dt;
    r.cd -= dt;
    if (r.cd <= 0 && s.alive) {
      r.cd = Math.max(1, 3.2 - lvl * 0.07) * rng.range(0.7, 1.3);
      const aligned = Math.abs(s.px - r.x) < 22 ? 'v' : Math.abs(s.py - r.y) < 22 ? 'h' : null;
      if (aligned && s.bullets.filter((b) => !b.mine).length < 3 + Math.floor(lvl / 5)) {
        const sp2 = 190 + lvl * 4;
        s.bullets.push({ x: r.x, y: r.y, vx: aligned === 'h' ? Math.sign(s.px - r.x) * sp2 : 0, vy: aligned === 'v' ? Math.sign(s.py - r.y) * sp2 : 0, mine: false });
      }
    }
    // Robots die on walls and when they touch the player.
    if (hitsWall(s.walls, r.x, r.y, ROBOT_R - 2)) {
      burst(s.sparks, rng, r.x, r.y, COLORS.coral, 10);
      emit('explode');
      s.robots.splice(i, 1);
      continue;
    }
    if (s.alive && Math.hypot(r.x - s.px, r.y - s.py) < ROBOT_R + PLAYER_R) {
      burst(s.sparks, rng, r.x, r.y, COLORS.coral, 10);
      s.robots.splice(i, 1);
      kill(s, rng, emit);
    }
  }

  // Evil Otto turns up when you dawdle.
  const ottoAt = Math.max(8, 20 - lvl * 0.4);
  if (!s.otto && s.roomTime > ottoAt) s.otto = { x: s.px < W / 2 ? W - 20 : 20, y: ROOM.y + 20 };
  if (s.otto && s.alive) {
    const o = s.otto;
    const d = Math.hypot(s.px - o.x, s.py - o.y) || 1;
    const sp = 60 + Math.min(lvl, 12) * 3;
    o.x += ((s.px - o.x) / d) * sp * dt;
    o.y += ((s.py - o.y) / d) * sp * dt + Math.sin(s.roomTime * 4) * 30 * dt;
    if (d < 16) kill(s, rng, emit);
  }

  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let remove = hitsWall(s.walls, b.x, b.y, 2) || b.x < -10 || b.x > W + 10 || b.y < ROOM.y - 10 || b.y > ROOM.y + ROOM.h + 10;
    if (!remove && b.mine) {
      for (let k = 0; k < s.robots.length; k++) {
        const r = s.robots[k]!;
        if (Math.hypot(b.x - r.x, b.y - r.y) < ROBOT_R + 3) {
          s.score += 50;
          s.killed += 1;
          burst(s.sparks, rng, r.x, r.y, COLORS.coral, 12);
          emit('explode');
          s.robots.splice(k, 1);
          remove = true;
          break;
        }
      }
    } else if (!remove && s.alive && Math.hypot(b.x - s.px, b.y - s.py) < PLAYER_R + 2) {
      remove = true;
      kill(s, rng, emit);
    }
    if (remove) s.bullets.splice(i, 1);
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: RoboState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = COLORS.cyan;
  for (const k of s.walls) g.fillRect(k.x, k.y, k.w, k.h);

  for (const r of s.robots) {
    g.fillStyle = COLORS.coral;
    g.fillRect(r.x - 10, r.y - 10, 20, 20);
    g.fillStyle = COLORS.bg;
    g.fillRect(r.x - 6, r.y - 5, 4, 4);
    g.fillRect(r.x + 2, r.y - 5, 4, 4);
    g.fillRect(r.x - 6, r.y + 4, 12, 3);
  }
  if (s.otto) {
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.arc(s.otto.x, s.otto.y, 12 + Math.sin(time * 8) * 2, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(s.otto.x - 6, s.otto.y - 4, 3, 3);
    g.fillRect(s.otto.x + 3, s.otto.y - 4, 3, 3);
  }
  if (s.alive) {
    g.fillStyle = COLORS.paper;
    g.fillRect(s.px - 5, s.py - 12, 10, 24);
    g.fillRect(s.px - 12, s.py - 4, 24, 8);
    g.fillStyle = COLORS.gold;
    g.fillRect(s.px - 4 + s.fx * 6, s.py - 4 + s.fy * 6, 8, 8);
  }
  for (const b of s.bullets) {
    g.fillStyle = b.mine ? COLORS.gold : COLORS.coral;
    g.fillRect(b.x - 3, b.y - 3, 6, 6);
  }
  drawSparks(g, s.sparks);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `ROOM ${s.level}  LEFT ${s.robots.length}`, s.lives);
  gameOver(g, s.over);
}

const roboMaze: GameDefinition<RoboState> = {
  id: 'robo-maze',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};

export default roboMaze;
