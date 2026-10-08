import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, W, type Spark } from '../_shared';
import { generateMaze, MCOLS, MROWS } from '../_shared/maze-chase';

const CELL = 26;
const OX = (W - MCOLS * CELL) / 2;
const OY = 36;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_LEVEL = 30;
const FLAGS = 8;
const SMOKE_TIME = 4;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const CAR_COLORS = [COLORS.coral, COLORS.purple, COLORS.gold, COLORS.muted];

interface Car {
  cx: number;
  cy: number;
  nx: number;
  ny: number;
  p: number;
  stun: number;
}

export interface RallyState {
  /** 1 wall, 0 open. */
  walls: number[];
  flags: { x: number; y: number }[];
  smoke: { x: number; y: number; t: number }[];
  player: Car & { dx: number; dy: number };
  rivals: Car[];
  fuel: number;
  smokes: number;
  streak: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  respawn: number;
  levelDelay: number;
  nextLife: number;
}

const idx = (x: number, y: number) => y * MCOLS + x;
const open = (s: RallyState, x: number, y: number) => x >= 0 && y >= 0 && x < MCOLS && y < MROWS && s.walls[idx(x, y)] === 0;
const PLAYER_START = { x: 10, y: 13 };
const RIVAL_STARTS = [{ x: 1, y: 1 }, { x: 19, y: 1 }, { x: 1, y: 17 }, { x: 19, y: 17 }, { x: 10, y: 1 }];

function car(x: number, y: number): Car {
  return { cx: x, cy: y, nx: x, ny: y, p: 0, stun: 0 };
}

function buildLevel(s: RallyState, rng: Rng): void {
  const maze = generateMaze(rng);
  s.walls = maze.map((v) => (v === 1 ? 1 : 0));
  const free: { x: number; y: number }[] = [];
  for (let y = 0; y < MROWS; y++) for (let x = 0; x < MCOLS; x++) if (s.walls[idx(x, y)] === 0 && x > 0 && x < MCOLS - 1) free.push({ x, y });
  s.flags = [];
  while (s.flags.length < FLAGS) {
    const c = rng.pick(free);
    if (Math.abs(c.x - PLAYER_START.x) + Math.abs(c.y - PLAYER_START.y) < 5) continue;
    if (!s.flags.some((f) => f.x === c.x && f.y === c.y)) s.flags.push(c);
  }
  s.smoke = [];
  placeCars(s);
  s.fuel = 1;
  s.smokes = 3;
  s.streak = 0;
}

function placeCars(s: RallyState): void {
  s.player = { ...car(PLAYER_START.x, PLAYER_START.y), dx: 0, dy: 0 };
  const n = Math.min(2 + Math.floor((s.level + 1) / 2), 5);
  s.rivals = RIVAL_STARTS.slice(0, n).map((c) => {
    let x = c.x;
    let y = c.y;
    // Snap onto the nearest open cell (the maze may have a wall at a corner start).
    for (let r = 0; r < 6 && !open(s, x, y); r++) {
      for (const [dx, dy] of DIRS) {
        if (open(s, c.x + dx * r, c.y + dy * r)) {
          x = c.x + dx * r;
          y = c.y + dy * r;
          break;
        }
      }
    }
    return car(x, y);
  });
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RallyState {
  const s: RallyState = {
    walls: [],
    flags: [],
    smoke: [],
    player: { ...car(0, 0), dx: 0, dy: 0 },
    rivals: [],
    fuel: 1,
    smokes: 3,
    streak: 0,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
  buildLevel(s, rng);
  return s;
}

/** Breadth-first distances from a cell, used by the rival cars. */
function distanceMap(s: RallyState, tx: number, ty: number): number[] {
  const dist = new Array<number>(MCOLS * MROWS).fill(-1);
  const queue = [idx(tx, ty)];
  dist[queue[0]!] = 0;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const x = c % MCOLS;
    const y = Math.floor(c / MCOLS);
    for (const [dx, dy] of DIRS) {
      if (!open(s, x + dx, y + dy) || dist[idx(x + dx, y + dy)] !== -1) continue;
      dist[idx(x + dx, y + dy)] = dist[c]! + 1;
      queue.push(idx(x + dx, y + dy));
    }
  }
  return dist;
}

/** Move a car along cell edges; `choose` picks the next cell each time one is reached. */
function drive(c: Car, speed: number, dt: number, choose: (c: Car) => [number, number] | null): void {
  let left = speed * dt;
  while (left > 0) {
    if (c.cx === c.nx && c.cy === c.ny) {
      const d = choose(c);
      if (!d) return;
      c.nx = c.cx + d[0];
      c.ny = c.cy + d[1];
    }
    const need = 1 - c.p;
    if (left >= need) {
      left -= need;
      c.cx = c.nx;
      c.cy = c.ny;
      c.p = 0;
    } else {
      c.p += left;
      left = 0;
    }
  }
}

const pos = (c: Car) => ({ x: c.cx + (c.nx - c.cx) * c.p, y: c.cy + (c.ny - c.cy) * c.p });

function loseLife(s: RallyState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = pos(s.player);
  burst(s.sparks, rng, OX + p.x * CELL + CELL / 2, OY + p.y * CELL + CELL / 2, COLORS.cyan, 24);
  emit('die');
  s.lives -= 1;
  s.streak = 0;
  s.respawn = 1.4;
  if (s.lives <= 0) s.over = true;
}

function update(s: RallyState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level = Math.min(s.level + 1, MAX_LEVEL);
      buildLevel(s, rng);
      emit('wave');
    }
    return;
  }
  if (s.respawn > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.fuel = Math.max(s.fuel, 0.4);
      placeCars(s);
    }
    stepSparks(s.sparks, dt);
    return;
  }

  const p = s.player;
  if (input.held.left) [p.dx, p.dy] = [-1, 0];
  else if (input.held.right) [p.dx, p.dy] = [1, 0];
  else if (input.held.up) [p.dx, p.dy] = [0, -1];
  else if (input.held.down) [p.dx, p.dy] = [0, 1];

  s.fuel = Math.max(0, s.fuel - dt / 45);
  const speed = s.fuel > 0 ? 5.2 : 2.6;
  drive(p, speed, dt, (c) => {
    if (open(s, c.cx + p.dx, c.cy + p.dy) && (p.dx !== 0 || p.dy !== 0)) return [p.dx, p.dy];
    return null;
  });

  if (input.pressed.b && s.smokes > 0) {
    s.smokes -= 1;
    s.smoke.push({ x: p.cx, y: p.cy, t: SMOKE_TIME });
    emit('fire');
  }
  for (let i = s.smoke.length - 1; i >= 0; i--) {
    s.smoke[i]!.t -= dt;
    if (s.smoke[i]!.t <= 0) s.smoke.splice(i, 1);
  }

  // Rival cars follow the shortest path to the player's next cell.
  const dist = distanceMap(s, p.nx, p.ny);
  const rivalSpeed = Math.min(4.6, 3 + s.level * 0.15);
  for (const r of s.rivals) {
    r.stun = Math.max(0, r.stun - dt);
    if (r.stun > 0) continue;
    drive(r, rivalSpeed, dt, (c) => {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (const [dx, dy] of DIRS) {
        const d = open(s, c.cx + dx, c.cy + dy) ? dist[idx(c.cx + dx, c.cy + dy)]! : -1;
        const jitter = rng.next() * 0.4;
        if (d >= 0 && d + jitter < bestD) {
          bestD = d + jitter;
          best = [dx, dy];
        }
      }
      return best;
    });
    if (s.smoke.some((sm) => Math.abs(sm.x - r.cx) + Math.abs(sm.y - r.cy) === 0)) r.stun = 2.2;
  }

  // Flags, fuel and collisions.
  const pp = pos(p);
  for (let i = s.flags.length - 1; i >= 0; i--) {
    const f = s.flags[i]!;
    if (Math.abs(f.x - pp.x) < 0.6 && Math.abs(f.y - pp.y) < 0.6) {
      s.streak += 1;
      s.score += 100 * Math.min(s.streak, 5);
      s.fuel = Math.min(1, s.fuel + 0.3);
      s.smokes = Math.min(5, s.smokes + 1);
      emit('pickup');
      s.flags.splice(i, 1);
    }
  }
  for (const r of s.rivals) {
    const rp = pos(r);
    if (r.stun <= 0 && Math.hypot(rp.x - pp.x, rp.y - pp.y) < 0.7) {
      loseLife(s, rng, emit);
      break;
    }
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.flags.length === 0 && s.levelDelay <= 0 && !s.over && s.respawn <= 0) {
    s.score += 1000;
    s.levelDelay = 1.4;
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: RallyState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = COLORS.purple;
  for (let y = 0; y < MROWS; y++) {
    for (let x = 0; x < MCOLS; x++) {
      if (s.walls[idx(x, y)] === 1) g.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
    }
  }
  for (const sm of s.smoke) {
    g.fillStyle = COLORS.muted;
    g.globalAlpha = Math.min(0.7, sm.t / 2);
    g.beginPath();
    g.arc(OX + sm.x * CELL + CELL / 2, OY + sm.y * CELL + CELL / 2, CELL * 0.7, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  for (const f of s.flags) {
    const x = OX + f.x * CELL + CELL / 2;
    const y = OY + f.y * CELL + CELL / 2;
    g.fillStyle = COLORS.paper;
    g.fillRect(x - 1, y - 9, 2, 18);
    g.fillStyle = COLORS.gold;
    g.fillRect(x + 1, y - 9, 9, 7);
  }
  const drawCar = (c: Car, color: string) => {
    const q = pos(c);
    const x = OX + q.x * CELL + CELL / 2;
    const y = OY + q.y * CELL + CELL / 2;
    g.fillStyle = color;
    g.fillRect(x - 9, y - 9, 18, 18);
    g.fillStyle = COLORS.bg;
    g.fillRect(x - 5, y - 5, 10, 6);
  };
  s.rivals.forEach((r, i) => {
    if (r.stun > 0 && Math.floor(time * 10) % 2 === 0) return;
    drawCar(r, CAR_COLORS[i % CAR_COLORS.length]!);
  });
  if (s.respawn <= 0) drawCar(s.player, COLORS.cyan);
  drawSparks(g, s.sparks);
  // Fuel gauge.
  g.fillStyle = COLORS.muted;
  g.fillRect(W / 2 - 80, 14, 160, 10);
  g.fillStyle = s.fuel > 0.25 ? COLORS.cyan : COLORS.coral;
  g.fillRect(W / 2 - 80, 14, 160 * s.fuel, 10);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `ROUND ${s.level}  SMOKE ${s.smokes}  FLAGS ${s.flags.length}`, s.lives);
  gameOver(g, s.over);
}

const rallyMaze: GameDefinition<RallyState> = {
  id: 'rally-maze',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};

export default rallyMaze;
