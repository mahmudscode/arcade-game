import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { clear, COLORS, gameOver, H, hud, makeStatus, TAU, W } from '../_shared';

const CELL = 8;
const COLS = 90;
const ROWS = 58;
const OX = (W - COLS * CELL) / 2;
const OY = 54;
const START_LIVES = 3;
const TARGET = 0.75;
const MOVE_EVERY = 0.026;
const SPARX_EVERY = 0.075;
const POINTS_PER_CELL = 4;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** Cell values: 0 open, 1 claimed, 2 trail being drawn. */
interface Sparx {
  x: number;
  y: number;
  px: number;
  py: number;
  cd: number;
}

export interface WeaverState {
  grid: number[];
  px: number;
  py: number;
  /** True while a trail is being drawn into open space. */
  drawing: boolean;
  moveCd: number;
  qx: number;
  qy: number;
  qAngle: number;
  /** Direction the Qix is drifting; its drawn line spins independently. */
  qHead: number;
  qSpin: number;
  qTurnCd: number;
  sparx: Sparx[];
  claimed: number;
  flash: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  respawn: number;
  levelDelay: number;
}

const idx = (x: number, y: number) => y * COLS + x;
const INTERIOR = (COLS - 2) * (ROWS - 2);

function freshGrid(): number[] {
  const g = Array.from({ length: COLS * ROWS }, () => 0);
  for (let x = 0; x < COLS; x++) {
    g[idx(x, 0)] = 1;
    g[idx(x, ROWS - 1)] = 1;
  }
  for (let y = 0; y < ROWS; y++) {
    g[idx(0, y)] = 1;
    g[idx(COLS - 1, y)] = 1;
  }
  return g;
}

function resetLevel(s: WeaverState, rng: Rng): void {
  s.grid = freshGrid();
  s.claimed = 0;
  s.px = COLS >> 1;
  s.py = ROWS - 1;
  s.drawing = false;
  s.qx = COLS / 2;
  s.qy = ROWS / 2;
  s.qAngle = rng.range(0, TAU);
  s.qHead = rng.range(0, TAU);
  s.qSpin = rng.pick([-1, 1]) * 3;
  s.qTurnCd = 1;
  const n = s.level >= 3 ? 2 : 1;
  s.sparx = Array.from({ length: n + (s.level >= 6 ? 1 : 0) }, (_, i) => ({ x: i % 2 === 0 ? 0 : COLS - 1, y: 0, px: -1, py: -1, cd: 0 }));
  s.levelDelay = 0;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): WeaverState {
  const s: WeaverState = {
    grid: [],
    px: 0,
    py: 0,
    drawing: false,
    moveCd: 0,
    qx: 0,
    qy: 0,
    qAngle: 0,
    qHead: 0,
    qSpin: 3,
    qTurnCd: 1,
    sparx: [],
    claimed: 0,
    flash: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    respawn: 0,
    levelDelay: 0,
  };
  resetLevel(s, rng);
  return s;
}

function loseLife(s: WeaverState, emit: UpdateContext['emit']): void {
  for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === 2) s.grid[i] = 0;
  s.drawing = false;
  s.px = COLS >> 1;
  s.py = ROWS - 1;
  s.lives -= 1;
  s.respawn = 1;
  s.flash = 0.4;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** Turn the finished trail into wall, then wall off every open region the Qix is not in. */
function closeTrail(s: WeaverState, emit: UpdateContext['emit']): void {
  const g = s.grid;
  for (let i = 0; i < g.length; i++) if (g[i] === 2) g[i] = 1;
  const label = new Array<number>(g.length).fill(-1);
  const regions: number[][] = [];
  for (let start = 0; start < g.length; start++) {
    if (g[start] !== 0 || label[start] !== -1) continue;
    const id = regions.length;
    const cells: number[] = [];
    const stack = [start];
    label[start] = id;
    while (stack.length > 0) {
      const c = stack.pop()!;
      cells.push(c);
      const cx = c % COLS;
      const cy = Math.floor(c / COLS);
      for (const [dx, dy] of DIRS) {
        const n = idx(cx + dx, cy + dy);
        if (g[n] === 0 && label[n] === -1) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    regions.push(cells);
  }
  const qCell = idx(Math.floor(s.qx), Math.floor(s.qy));
  let keep = label[qCell] ?? -1;
  if (keep === -1) {
    // Qix sits on a wall (should not happen): keep the largest region.
    keep = regions.reduce((best, r, i) => (r.length > (regions[best]?.length ?? -1) ? i : best), 0);
  }
  let gained = 0;
  regions.forEach((cells, id) => {
    if (id === keep) return;
    for (const c of cells) g[c] = 1;
    gained += cells.length;
  });
  let total = 0;
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (g[idx(x, y)] === 1) total += 1;
  s.claimed = total;
  s.score += gained * POINTS_PER_CELL;
  if (gained > 0) emit('pickup');
}

function update(s: WeaverState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  s.flash = Math.max(0, s.flash - dt);

  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      resetLevel(s, rng);
      emit('wave');
    }
    return;
  }
  if (s.respawn > 0) {
    s.respawn -= dt;
    return;
  }

  // Player steps one cell at a time.
  s.moveCd -= dt;
  if (s.moveCd <= 0) {
    let dx = 0;
    let dy = 0;
    if (input.held.left) dx = -1;
    else if (input.held.right) dx = 1;
    else if (input.held.up) dy = -1;
    else if (input.held.down) dy = 1;
    if (dx !== 0 || dy !== 0) {
      const nx = s.px + dx;
      const ny = s.py + dy;
      if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) {
        const target = s.grid[idx(nx, ny)]!;
        if (target === 1) {
          s.px = nx;
          s.py = ny;
          s.moveCd = MOVE_EVERY;
          if (s.drawing) {
            s.drawing = false;
            closeTrail(s, emit);
          }
        } else if (target === 0 && (s.drawing || input.held.a)) {
          s.drawing = true;
          s.px = nx;
          s.py = ny;
          s.grid[idx(nx, ny)] = 2;
          s.moveCd = MOVE_EVERY * 1.3;
        } else if (target === 2) {
          loseLife(s, emit);
          return;
        }
      }
    }
  }

  // The Qix bounces around the open area on a drifting heading.
  s.qAngle += s.qSpin * dt;
  s.qTurnCd -= dt;
  const speed = 70 + s.level * 8;
  if (s.qTurnCd <= 0) {
    s.qTurnCd = rng.range(0.8, 2);
    s.qHead = rng.range(0, TAU);
    s.qSpin = rng.pick([-1, 1]) * rng.range(2, 4.5);
  }
  let vx = (Math.cos(s.qHead) * speed) / CELL;
  let vy = (Math.sin(s.qHead) * speed) / CELL;
  const nx = s.qx + vx * dt;
  const ny = s.qy + vy * dt;
  if (s.grid[idx(Math.floor(nx), Math.floor(s.qy))] === 1) vx = -vx;
  if (s.grid[idx(Math.floor(s.qx), Math.floor(ny))] === 1) vy = -vy;
  s.qx += vx * dt;
  s.qy += vy * dt;
  s.qHead = Math.atan2(vy, vx);
  s.qx = Math.min(COLS - 2, Math.max(1, s.qx));
  s.qy = Math.min(ROWS - 2, Math.max(1, s.qy));

  // Qix touching the trail with any part of its line kills the player.
  for (let k = -5; k <= 5; k++) {
    const lx = Math.floor(s.qx + Math.cos(s.qAngle) * k);
    const ly = Math.floor(s.qy + Math.sin(s.qAngle) * k);
    if (lx >= 0 && ly >= 0 && lx < COLS && ly < ROWS && s.grid[idx(lx, ly)] === 2) {
      loseLife(s, emit);
      return;
    }
  }

  // Sparx patrol the walls and hunt the player.
  for (const sp of s.sparx) {
    sp.cd -= dt;
    if (sp.cd > 0) continue;
    sp.cd = SPARX_EVERY - Math.min(0.03, s.level * 0.004);
    const options = DIRS.map(([dx, dy]) => ({ x: sp.x + dx, y: sp.y + dy })).filter(
      (c) => c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS && s.grid[idx(c.x, c.y)] === 1 && !(c.x === sp.px && c.y === sp.py),
    );
    const next = options.length === 0 ? { x: sp.px, y: sp.py } : rng.next() < 0.7 ? options.reduce((a, b) => (Math.abs(a.x - s.px) + Math.abs(a.y - s.py) <= Math.abs(b.x - s.px) + Math.abs(b.y - s.py) ? a : b)) : rng.pick(options);
    if (next.x >= 0) {
      sp.px = sp.x;
      sp.py = sp.y;
      sp.x = next.x;
      sp.y = next.y;
    }
  }
  for (const sp of s.sparx) {
    if (Math.abs(sp.x - s.px) + Math.abs(sp.y - s.py) <= 1 && s.grid[idx(s.px, s.py)] !== 2) {
      loseLife(s, emit);
      return;
    }
  }

  if (s.claimed / INTERIOR >= TARGET) {
    s.score += 1000 * s.level;
    s.levelDelay = 1.6;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: WeaverState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = s.grid[idx(x, y)]!;
      if (v === 0) continue;
      g.fillStyle = v === 2 ? COLORS.gold : (x + y) % 2 === 0 ? '#3b2a7a' : '#46338c';
      g.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
    }
  }
  g.strokeStyle = COLORS.cyan;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(OX + (s.qx + Math.cos(s.qAngle) * 5) * CELL, OY + (s.qy + Math.sin(s.qAngle) * 5) * CELL);
  g.lineTo(OX + (s.qx - Math.cos(s.qAngle) * 5) * CELL, OY + (s.qy - Math.sin(s.qAngle) * 5) * CELL);
  g.stroke();
  g.strokeStyle = COLORS.coral;
  g.beginPath();
  g.moveTo(OX + (s.qx + Math.cos(s.qAngle + 1.2) * 4) * CELL, OY + (s.qy + Math.sin(s.qAngle + 1.2) * 4) * CELL);
  g.lineTo(OX + (s.qx - Math.cos(s.qAngle + 1.2) * 4) * CELL, OY + (s.qy - Math.sin(s.qAngle + 1.2) * 4) * CELL);
  g.stroke();

  g.fillStyle = COLORS.coral;
  for (const sp of s.sparx) {
    g.beginPath();
    g.arc(OX + sp.x * CELL + CELL / 2, OY + sp.y * CELL + CELL / 2, 6, 0, TAU);
    g.fill();
  }
  if (s.respawn <= 0 || Math.floor(time * 10) % 2 === 0) {
    g.fillStyle = COLORS.paper;
    g.beginPath();
    g.moveTo(OX + s.px * CELL + CELL / 2, OY + s.py * CELL - 4);
    g.lineTo(OX + s.px * CELL + CELL + 4, OY + s.py * CELL + CELL / 2);
    g.lineTo(OX + s.px * CELL + CELL / 2, OY + s.py * CELL + CELL + 4);
    g.lineTo(OX + s.px * CELL - 4, OY + s.py * CELL + CELL / 2);
    g.closePath();
    g.fill();
  }
  if (s.flash > 0) {
    g.fillStyle = 'rgba(255,93,115,0.25)';
    g.fillRect(0, 0, W, H);
  }
  const pct = Math.floor((s.claimed / INTERIOR) * 100);
  hud(g, s, `LEVEL ${s.level}  CLAIMED ${pct}%/75`, s.lives);
  gameOver(g, s.over);
}

const lineWeaver: GameDefinition<WeaverState> = {
  id: 'line-weaver',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};

export default lineWeaver;
