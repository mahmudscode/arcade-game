import type { GameDefinition, Input, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, clear, gameOver, hud, makeStatus } from '../_shared/ui';
import { LEVELS } from './levels';

const CELL = 56;

export interface ShiftState {
  /** Parsed level: walls and goals are fixed; crates and the player move. */
  walls: boolean[];
  goals: boolean[];
  crates: boolean[];
  cols: number;
  rows: number;
  px: number;
  py: number;
  moves: number;
  /** Undo history of {px, py, pushedFrom} where pushedFrom is the crate's old index or -1. */
  history: { px: number; py: number; from: number; to: number }[];
  levelDelay: number;
  score: number;
  hi: number;
  level: number;
  over: boolean;
}

function load(s: ShiftState, n: number): void {
  const rows = LEVELS[n]!;
  s.rows = rows.length;
  s.cols = Math.max(...rows.map((r) => r.length));
  s.walls = [];
  s.goals = [];
  s.crates = [];
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      const c = rows[y]![x] ?? ' ';
      s.walls.push(c === '#');
      s.goals.push(c === '.' || c === '*' || c === '+');
      s.crates.push(c === '$' || c === '*');
      if (c === '@' || c === '+') {
        s.px = x;
        s.py = y;
      }
    }
  }
  s.moves = 0;
  s.history = [];
}

function init({ hiScore }: { hiScore: number }): ShiftState {
  const s: ShiftState = { walls: [], goals: [], crates: [], cols: 0, rows: 0, px: 0, py: 0, moves: 0, history: [], levelDelay: 0, score: 0, hi: hiScore, level: 1, over: false };
  load(s, 0);
  return s;
}

const solved = (s: ShiftState) => s.goals.every((g, i) => !g || s.crates[i]);

function update(s: ShiftState, input: Input, dt: number, ctx: UpdateContext): void {
  const { emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      if (s.level >= LEVELS.length) s.over = true;
      else {
        s.level += 1;
        load(s, s.level - 1);
        emit('wave');
      }
    }
    return;
  }
  if (input.pressed.start || input.pressed.select) {
    load(s, s.level - 1);
    return;
  }
  if (input.pressed.b) {
    const h = s.history.pop();
    if (h) {
      s.px = h.px;
      s.py = h.py;
      if (h.from >= 0) {
        s.crates[h.to] = false;
        s.crates[h.from] = true;
      }
      s.moves -= 1;
    }
    return;
  }
  const d = input.pressed.up ? [0, -1] : input.pressed.down ? [0, 1] : input.pressed.left ? [-1, 0] : input.pressed.right ? [1, 0] : null;
  if (!d) return;
  const nx = s.px + d[0]!;
  const ny = s.py + d[1]!;
  const ni = ny * s.cols + nx;
  if (s.walls[ni]) return;
  let from = -1;
  let to = -1;
  if (s.crates[ni]) {
    const bi = (ny + d[1]!) * s.cols + nx + d[0]!;
    if (s.walls[bi] || s.crates[bi]) return;
    s.crates[ni] = false;
    s.crates[bi] = true;
    from = ni;
    to = bi;
    emit('fire');
  }
  s.history.push({ px: s.px, py: s.py, from, to });
  s.px = nx;
  s.py = ny;
  s.moves += 1;
  if (solved(s)) {
    s.score += Math.max(100, 1000 - s.moves * 10);
    s.levelDelay = 1.2;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: ShiftState, g: CanvasRenderingContext2D): void {
  clear(g);
  const ox = (W - s.cols * CELL) / 2;
  const oy = (H - s.rows * CELL) / 2;
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      const i = y * s.cols + x;
      const px = ox + x * CELL;
      const py = oy + y * CELL;
      if (s.walls[i]) {
        g.fillStyle = COLORS.purple;
        g.fillRect(px, py, CELL - 2, CELL - 2);
        continue;
      }
      g.fillStyle = '#1d1340';
      g.fillRect(px, py, CELL - 2, CELL - 2);
      if (s.goals[i]) {
        g.fillStyle = COLORS.gold;
        g.fillRect(px + 20, py + 20, CELL - 42, CELL - 42);
      }
      if (s.crates[i]) {
        g.fillStyle = s.goals[i] ? COLORS.cyan : COLORS.coral;
        g.fillRect(px + 6, py + 6, CELL - 14, CELL - 14);
      }
    }
  }
  g.fillStyle = COLORS.paper;
  g.beginPath();
  g.arc(ox + s.px * CELL + CELL / 2 - 1, oy + s.py * CELL + CELL / 2 - 1, 16, 0, Math.PI * 2);
  g.fill();
  hud(g, s, `LEVEL ${s.level}/${LEVELS.length}  MOVES ${s.moves}  B=UNDO`);
  if (s.levelDelay > 0 && !s.over) banner(g, 'SOLVED!', 80);
  gameOver(g, s.over);
}

const game: GameDefinition<ShiftState> = {
  id: 'crate-shift',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, s.level),
};
export default game;
