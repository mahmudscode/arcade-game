import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const COLS = 15;
const ROWS = 13;
const CELL = 40;
const OX = (W - COLS * CELL) / 2;
const OY = 24;
const START_LIVES = 3;
const FUSE = 2.2;
const FLAME = 0.45;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** 0 floor, 1 wall, 2 soft block. */
interface Bomb { x: number; y: number; t: number; range: number; /** The player may walk off a freshly placed bomb. */ passable: boolean }
interface Foe { x: number; y: number; timer: number; dx: number; dy: number }

export interface BlastState {
  grid: number[];
  player: { x: number; y: number; move: number; alive: boolean; invuln: number };
  bombs: Bomb[];
  flames: { x: number; y: number; t: number }[];
  foes: Foe[];
  power: { x: number; y: number; kind: 'range' | 'bomb' }[];
  maxBombs: number;
  range: number;
  sparks: Spark[];
  respawn: number;
  levelDelay: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const gi = (x: number, y: number) => y * COLS + x;

function buildLevel(s: BlastState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return 1;
    if (x % 2 === 0 && y % 2 === 0) return 1;
    // Keep the player's corner clear.
    if (x + y <= 4) return 0;
    return rng.next() < 0.42 ? 2 : 0;
  });
  s.bombs = [];
  s.flames = [];
  s.power = [];
  s.player = { x: 1, y: 1, move: 0, alive: true, invuln: 2 };
  const count = Math.min(3 + s.level, 9);
  s.foes = [];
  for (let n = 0; n < count; n++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = rng.int(1, COLS - 2);
      const y = rng.int(1, ROWS - 2);
      if (s.grid[gi(x, y)] === 0 && x + y > 8 && !s.foes.some((f) => f.x === x && f.y === y)) {
        s.foes.push({ x, y, timer: rng.range(0, 0.4), dx: 0, dy: 0 });
        break;
      }
    }
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): BlastState {
  const s: BlastState = {
    grid: [],
    player: { x: 1, y: 1, move: 0, alive: true, invuln: 2 },
    bombs: [],
    flames: [],
    foes: [],
    power: [],
    maxBombs: 1,
    range: 2,
    sparks: [],
    respawn: 0,
    levelDelay: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  buildLevel(s, rng);
  return s;
}

function blocked(s: BlastState, x: number, y: number, ignoreBombs = false): boolean {
  if (s.grid[gi(x, y)] !== 0) return true;
  return !ignoreBombs && s.bombs.some((b) => b.x === x && b.y === y && !b.passable);
}

function explode(s: BlastState, rng: Rng, b: Bomb, emit: UpdateContext['emit']): void {
  s.bombs = s.bombs.filter((o) => o !== b);
  emit('explode');
  const add = (x: number, y: number) => s.flames.push({ x, y, t: FLAME });
  add(b.x, b.y);
  for (const [dx, dy] of DIRS) {
    for (let k = 1; k <= b.range; k++) {
      const x = b.x + dx * k;
      const y = b.y + dy * k;
      const cell = s.grid[gi(x, y)];
      if (cell === 1) break;
      add(x, y);
      if (cell === 2) {
        s.grid[gi(x, y)] = 0;
        s.score += 10;
        burst(s.sparks, rng, OX + x * CELL + CELL / 2, OY + y * CELL + CELL / 2, COLORS.gold, 6);
        if (rng.next() < 0.18) s.power.push({ x, y, kind: rng.pick<'range' | 'bomb'>(['range', 'bomb']) });
        break;
      }
      // Chain reaction.
      const other = s.bombs.find((o) => o.x === x && o.y === y);
      if (other) other.t = 0;
    }
  }
}

function update(s: BlastState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildLevel(s, rng);
      emit('wave');
    }
    return;
  }

  const p = s.player;
  if (p.alive) {
    p.invuln = Math.max(0, p.invuln - dt);
    p.move -= dt;
    const d = input.held.up ? DIRS[0] : input.held.right ? DIRS[1] : input.held.down ? DIRS[2] : input.held.left ? DIRS[3] : null;
    if (d && p.move <= 0 && !blocked(s, p.x + d[0], p.y + d[1])) {
      p.x += d[0];
      p.y += d[1];
      p.move = 0.13;
    }
    if (input.pressed.a && s.bombs.length < s.maxBombs && !s.bombs.some((b) => b.x === p.x && b.y === p.y)) {
      s.bombs.push({ x: p.x, y: p.y, t: FUSE, range: s.range, passable: true });
      emit('fire');
    }
    for (const b of s.bombs) if (b.passable && (b.x !== p.x || b.y !== p.y)) b.passable = false;
    const pu = s.power.findIndex((q) => q.x === p.x && q.y === p.y);
    if (pu >= 0) {
      if (s.power[pu]!.kind === 'range') s.range += 1;
      else s.maxBombs += 1;
      s.power.splice(pu, 1);
      s.score += 50;
      emit('pickup');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.player = { x: 1, y: 1, move: 0, alive: true, invuln: 2.5 };
      s.bombs = [];
    }
  }

  for (const b of [...s.bombs]) {
    b.t -= dt;
    if (b.t <= 0 && s.bombs.includes(b)) explode(s, rng, b, emit);
  }
  for (let i = s.flames.length - 1; i >= 0; i--) {
    s.flames[i]!.t -= dt;
    if (s.flames[i]!.t <= 0) s.flames.splice(i, 1);
  }

  for (const f of s.foes) {
    f.timer -= dt;
    if (f.timer > 0) continue;
    f.timer = Math.max(0.18, 0.4 - s.level * 0.02);
    const options = DIRS.filter(([dx, dy]) => !blocked(s, f.x + dx, f.y + dy));
    if (options.length === 0) continue;
    const forward = options.find(([dx, dy]) => dx === f.dx && dy === f.dy);
    const pick = forward && rng.next() < 0.7 ? forward : rng.pick(options);
    f.dx = pick[0];
    f.dy = pick[1];
    f.x += f.dx;
    f.y += f.dy;
  }

  // Flames kill foes and the player; foes kill the player on contact.
  for (let i = s.foes.length - 1; i >= 0; i--) {
    const f = s.foes[i]!;
    if (s.flames.some((fl) => fl.x === f.x && fl.y === f.y)) {
      s.foes.splice(i, 1);
      s.score += 100;
      burst(s.sparks, rng, OX + f.x * CELL + CELL / 2, OY + f.y * CELL + CELL / 2, COLORS.coral, 12);
      emit('explode');
    }
  }
  if (p.alive && p.invuln <= 0 && (s.flames.some((fl) => fl.x === p.x && fl.y === p.y) || s.foes.some((f) => f.x === p.x && f.y === p.y))) {
    p.alive = false;
    s.lives -= 1;
    s.respawn = 1.4;
    burst(s.sparks, rng, OX + p.x * CELL + CELL / 2, OY + p.y * CELL + CELL / 2, COLORS.cyan, 24);
    emit('die');
    if (s.lives <= 0) s.over = true;
  }

  if (!s.over && s.foes.length === 0) {
    s.score += 500;
    s.levelDelay = 1.4;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: BlastState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  s.grid.forEach((c, i) => {
    const x = OX + (i % COLS) * CELL;
    const y = OY + Math.floor(i / COLS) * CELL;
    g.fillStyle = c === 1 ? COLORS.purple : c === 2 ? '#8a5a2b' : '#1d1340';
    g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
  });
  for (const q of s.power) {
    g.fillStyle = q.kind === 'range' ? COLORS.coral : COLORS.cyan;
    g.fillRect(OX + q.x * CELL + 10, OY + q.y * CELL + 10, CELL - 20, CELL - 20);
  }
  for (const b of s.bombs) {
    g.fillStyle = Math.floor(b.t * 6) % 2 ? COLORS.coral : COLORS.paper;
    g.beginPath();
    g.arc(OX + b.x * CELL + CELL / 2, OY + b.y * CELL + CELL / 2, 14, 0, Math.PI * 2);
    g.fill();
  }
  for (const f of s.flames) {
    g.fillStyle = Math.floor(time * 20) % 2 ? COLORS.gold : COLORS.coral;
    g.fillRect(OX + f.x * CELL + 4, OY + f.y * CELL + 4, CELL - 8, CELL - 8);
  }
  for (const f of s.foes) {
    g.fillStyle = COLORS.coral;
    g.fillRect(OX + f.x * CELL + 8, OY + f.y * CELL + 8, CELL - 16, CELL - 16);
    g.fillStyle = COLORS.bg;
    g.fillRect(OX + f.x * CELL + 13, OY + f.y * CELL + 14, 5, 5);
    g.fillRect(OX + f.x * CELL + 22, OY + f.y * CELL + 14, 5, 5);
  }
  const p = s.player;
  if (p.alive && (p.invuln <= 0 || Math.floor(p.invuln * 10) % 2 === 0)) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(OX + p.x * CELL + 8, OY + p.y * CELL + 6, CELL - 16, CELL - 12);
    g.fillStyle = COLORS.paper;
    g.fillRect(OX + p.x * CELL + 12, OY + p.y * CELL + 10, CELL - 24, 10);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  BOMBS ${s.maxBombs}  RANGE ${s.range}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'AREA CLEARED!', 250);
  gameOver(g, s.over);
}

const game: GameDefinition<BlastState> = {
  id: 'blast-grid',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
