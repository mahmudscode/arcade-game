import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const NC = 9;
const NR = 7;
const GX = 76;
const GY = 62;
const OX = (W - (NC - 1) * GX) / 2;
const OY = 80;
const START_LIVES = 3;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

interface Walker { x: number; y: number; tx: number; ty: number; t: number; lastDx: number; lastDy: number }

export interface PatrolState {
  /** Painted flags for horizontal edges (NC-1 per row, NR rows) and vertical edges (NC per row, NR-1 rows). */
  hEdges: boolean[];
  vEdges: boolean[];
  filled: boolean[];
  player: Walker;
  enemies: Walker[];
  jumps: number;
  safe: number;
  sparks: Spark[];
  respawn: number;
  levelDelay: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const hIdx = (x: number, y: number) => y * (NC - 1) + x;
const vIdx = (x: number, y: number) => y * NC + x;
const bIdx = (x: number, y: number) => y * (NC - 1) + x;

function newWalker(x: number, y: number): Walker {
  return { x, y, tx: x, ty: y, t: 1, lastDx: 0, lastDy: 0 };
}

function newLevel(s: PatrolState, rng: Rng): void {
  s.hEdges = Array.from({ length: (NC - 1) * NR }, () => false);
  s.vEdges = Array.from({ length: NC * (NR - 1) }, () => false);
  s.filled = Array.from({ length: (NC - 1) * (NR - 1) }, () => false);
  s.player = newWalker(0, NR - 1);
  s.jumps = 3;
  s.safe = 1.5;
  const n = Math.min(3 + s.level, 8);
  s.enemies = Array.from({ length: n }, (_, i) => newWalker(rng.int(2, NC - 1), i % 2 === 0 ? 0 : rng.int(0, 2)));
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): PatrolState {
  const s: PatrolState = {
    hEdges: [],
    vEdges: [],
    filled: [],
    player: newWalker(0, NR - 1),
    enemies: [],
    jumps: 3,
    safe: 1.5,
    sparks: [],
    respawn: 0,
    levelDelay: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  newLevel(s, rng);
  return s;
}

const pos = (w: Walker) => ({ x: OX + (w.x + (w.tx - w.x) * w.t) * GX, y: OY + (w.y + (w.ty - w.y) * w.t) * GY });
const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < NC && y < NR;

function paintEdge(s: PatrolState, x0: number, y0: number, x1: number, y1: number, emit: UpdateContext['emit']): void {
  let isNew = false;
  if (y0 === y1) {
    const i = hIdx(Math.min(x0, x1), y0);
    isNew = !s.hEdges[i];
    s.hEdges[i] = true;
  } else {
    const i = vIdx(x0, Math.min(y0, y1));
    isNew = !s.vEdges[i];
    s.vEdges[i] = true;
  }
  if (!isNew) return;
  s.score += 10;
  // A box fills once all four of its edges are painted.
  for (let by = 0; by < NR - 1; by++) {
    for (let bx = 0; bx < NC - 1; bx++) {
      if (s.filled[bIdx(bx, by)]) continue;
      if (s.hEdges[hIdx(bx, by)] && s.hEdges[hIdx(bx, by + 1)] && s.vEdges[vIdx(bx, by)] && s.vEdges[vIdx(bx + 1, by)]) {
        s.filled[bIdx(bx, by)] = true;
        s.score += 100;
        emit('pickup');
      }
    }
  }
}

function update(s: PatrolState, input: Input, dt: number, ctx: UpdateContext): void {
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
      newLevel(s, rng);
      emit('wave');
    }
    return;
  }
  if (s.respawn > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.player = newWalker(0, NR - 1);
      s.safe = 2;
    }
    return;
  }

  s.safe = Math.max(0, s.safe - dt);
  const p = s.player;
  if (input.pressed.a && s.jumps > 0 && s.safe <= 0) {
    s.jumps -= 1;
    s.safe = 1.3;
    emit('fire');
  }
  if (p.t >= 1) {
    p.x = p.tx;
    p.y = p.ty;
    const d = input.held.up ? DIRS[0] : input.held.right ? DIRS[1] : input.held.down ? DIRS[2] : input.held.left ? DIRS[3] : null;
    if (d && inGrid(p.x + d[0], p.y + d[1])) {
      p.tx = p.x + d[0];
      p.ty = p.y + d[1];
      p.t = 0;
    }
  } else {
    p.t = Math.min(1, p.t + dt / 0.16);
    if (p.t >= 1) paintEdge(s, p.x, p.y, p.tx, p.ty, emit);
  }

  const espeed = 0.45 + s.level * 0.03;
  for (const e of s.enemies) {
    if (e.t >= 1) {
      e.x = e.tx;
      e.y = e.ty;
      const options = DIRS.filter(([dx, dy]) => inGrid(e.x + dx, e.y + dy) && !(dx === -e.lastDx && dy === -e.lastDy));
      const pool = options.length > 0 ? options : DIRS.filter(([dx, dy]) => inGrid(e.x + dx, e.y + dy));
      const pick = rng.pick(pool);
      e.lastDx = pick[0];
      e.lastDy = pick[1];
      e.tx = e.x + pick[0];
      e.ty = e.y + pick[1];
      e.t = 0;
    } else e.t = Math.min(1, e.t + dt * espeed * 2);
  }

  if (s.safe <= 0) {
    const pp = pos(p);
    if (s.enemies.some((e) => Math.hypot(pos(e).x - pp.x, pos(e).y - pp.y) < 16)) {
      s.lives -= 1;
      s.respawn = 1.3;
      burst(s.sparks, rng, pp.x, pp.y, COLORS.cyan, 22);
      emit('die');
      if (s.lives <= 0) s.over = true;
    }
  }

  if (!s.over && s.filled.every(Boolean)) {
    s.score += 500 * s.level;
    s.levelDelay = 1.5;
    emit('wave');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: PatrolState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  s.filled.forEach((f, i) => {
    if (!f) return;
    const bx = i % (NC - 1);
    const by = Math.floor(i / (NC - 1));
    g.fillStyle = 'rgba(79,227,214,0.35)';
    g.fillRect(OX + bx * GX + 4, OY + by * GY + 4, GX - 8, GY - 8);
  });
  g.lineWidth = 4;
  for (let y = 0; y < NR; y++) {
    for (let x = 0; x < NC - 1; x++) {
      g.strokeStyle = s.hEdges[hIdx(x, y)] ? COLORS.cyan : COLORS.muted;
      g.globalAlpha = s.hEdges[hIdx(x, y)] ? 1 : 0.45;
      g.beginPath();
      g.moveTo(OX + x * GX, OY + y * GY);
      g.lineTo(OX + (x + 1) * GX, OY + y * GY);
      g.stroke();
    }
  }
  for (let y = 0; y < NR - 1; y++) {
    for (let x = 0; x < NC; x++) {
      g.strokeStyle = s.vEdges[vIdx(x, y)] ? COLORS.cyan : COLORS.muted;
      g.globalAlpha = s.vEdges[vIdx(x, y)] ? 1 : 0.45;
      g.beginPath();
      g.moveTo(OX + x * GX, OY + y * GY);
      g.lineTo(OX + x * GX, OY + (y + 1) * GY);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  for (const e of s.enemies) {
    const p = pos(e);
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.arc(p.x, p.y, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(p.x - 5, p.y - 4, 3, 3);
    g.fillRect(p.x + 2, p.y - 4, 3, 3);
  }
  if (s.respawn <= 0) {
    const p = pos(s.player);
    if (s.safe <= 0 || Math.floor(time * 12) % 2 === 0) {
      g.fillStyle = COLORS.gold;
      g.beginPath();
      g.arc(p.x, p.y, 10, 0, Math.PI * 2);
      g.fill();
    }
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}   JUMPS ${s.jumps}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ALL PAINTED!', 40);
  gameOver(g, s.over);
}

const game: GameDefinition<PatrolState> = {
  id: 'paint-patrol',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
