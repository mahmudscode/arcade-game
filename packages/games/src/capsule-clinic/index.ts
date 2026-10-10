import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, GEM_COLORS, H, W, banner, clear, gameOver, hud, makeStatus } from '../_shared/ui';
import { ORIENT, autoRepeat } from '../_shared/falling';

const COLS = 8;
const ROWS = 16;
const CELL = 30;
const OX = 280;
const OY = 44;
const COLORS_N = 3;
const EMPTY = 0;
const GERM = 1;
const HALF = 2;
const STEP = 0.14;

export interface ClinicState {
  color: number[];
  kind: number[];
  /** Index of the other half of the same capsule, or -1 for germs and loose halves. */
  mate: number[];
  /** Falling capsule: `a` is the pivot, `b` sits at ORIENT[o] relative to it. */
  piece: { x: number; y: number; o: number; a: number; b: number };
  next: { a: number; b: number };
  phase: 'drop' | 'resolve';
  timer: number;
  fall: number;
  moveTimer: number;
  level: number;
  chain: number;
  banner: number;
  score: number;
  hi: number;
  over: boolean;
}

const pill = (rng: Rng) => ({ a: rng.int(1, COLORS_N), b: rng.int(1, COLORS_N) });
const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
const free = (s: ClinicState, x: number, y: number) => inside(x, y) && s.kind[idx(x, y)] === EMPTY;
const cells = (p: ClinicState['piece']) => [[p.x, p.y], [p.x + ORIENT[p.o]![0], p.y + ORIENT[p.o]![1]]] as const;
const fits = (s: ClinicState, p: ClinicState['piece']) => cells(p).every(([x, y]) => free(s, x!, y!));
const germCount = (s: ClinicState) => s.kind.filter((k) => k === GERM).length;

/** Would colour `c` at (x, y) complete a line of 3 with what's already placed? Used to seed fair levels. */
function makesTriple(s: ClinicState, x: number, y: number, c: number): boolean {
  const run = (dx: number, dy: number) => {
    let n = 0;
    while (inside(x + dx * (n + 1), y + dy * (n + 1)) && s.color[idx(x + dx * (n + 1), y + dy * (n + 1))] === c && s.kind[idx(x + dx * (n + 1), y + dy * (n + 1))] !== EMPTY) n++;
    return n;
  };
  return run(1, 0) + run(-1, 0) + 1 >= 3 || run(0, 1) + run(0, -1) + 1 >= 3;
}

function buildLevel(s: ClinicState, rng: Rng): void {
  s.color.fill(0);
  s.kind.fill(EMPTY);
  s.mate.fill(-1);
  const want = Math.min(4 + s.level * 2, 36);
  for (let placed = 0, tries = 0; placed < want && tries < 600; tries++) {
    const x = rng.int(0, COLS - 1);
    const y = rng.int(ROWS - 10, ROWS - 1);
    const c = rng.int(1, COLORS_N);
    if (s.kind[idx(x, y)] !== EMPTY || makesTriple(s, x, y, c)) continue;
    s.color[idx(x, y)] = c;
    s.kind[idx(x, y)] = GERM;
    placed++;
  }
  s.banner = 1.5;
}

function spawn(s: ClinicState, rng: Rng): void {
  s.piece = { x: 3, y: 0, o: 0, a: s.next.a, b: s.next.b };
  s.next = pill(rng);
  s.fall = 0;
  s.chain = 0;
  s.phase = 'drop';
  if (!fits(s, s.piece)) s.over = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): ClinicState {
  const s: ClinicState = {
    color: Array.from({ length: COLS * ROWS }, () => 0),
    kind: Array.from({ length: COLS * ROWS }, () => EMPTY),
    mate: Array.from({ length: COLS * ROWS }, () => -1),
    piece: { x: 3, y: 0, o: 0, a: 1, b: 1 },
    next: pill(rng),
    phase: 'drop',
    timer: 0,
    fall: 0,
    moveTimer: 0,
    level: 1,
    chain: 0,
    banner: 0,
    score: 0,
    hi: hiScore,
    over: false,
  };
  buildLevel(s, rng);
  spawn(s, rng);
  return s;
}

/** Cells in horizontal or vertical runs of 4+ of one colour. */
function findMatches(s: ClinicState): number[] {
  const hit = new Set<number>();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);
      if (s.kind[i] === EMPTY) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        let n = 1;
        while (inside(x + dx * n, y + dy * n) && s.kind[idx(x + dx * n, y + dy * n)] !== EMPTY && s.color[idx(x + dx * n, y + dy * n)] === s.color[i]) n++;
        if (n >= 4) for (let k = 0; k < n; k++) hit.add(idx(x + dx * k, y + dy * k));
      }
    }
  }
  return [...hit];
}

function moveCell(s: ClinicState, from: number, to: number): void {
  s.color[to] = s.color[from]!;
  s.kind[to] = s.kind[from]!;
  s.mate[to] = s.mate[from]!;
  s.color[from] = 0;
  s.kind[from] = EMPTY;
  s.mate[from] = -1;
}

/** Drops every unsupported capsule half (and whole capsules) by one row. Returns whether anything moved. */
function gravityStep(s: ClinicState): boolean {
  let moved = false;
  for (let y = ROWS - 2; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);
      if (s.kind[i] !== HALF) continue;
      const m = s.mate[i]!;
      const below = i + COLS;
      if (m === -1) {
        if (s.kind[below] === EMPTY) (moveCell(s, i, below), (moved = true));
      } else if (m === i + 1) {
        if (s.kind[below] === EMPTY && s.kind[below + 1] === EMPTY) {
          moveCell(s, i, below);
          moveCell(s, m, m + COLS);
          s.mate[below] = m + COLS;
          s.mate[m + COLS] = below;
          moved = true;
        }
      } else if (m === i - COLS) {
        // Vertical capsule, `i` is the lower half.
        if (s.kind[below] === EMPTY) {
          moveCell(s, i, below);
          moveCell(s, m, i);
          s.mate[below] = i;
          s.mate[i] = below;
          moved = true;
        }
      }
    }
  }
  return moved;
}

function lock(s: ClinicState): void {
  const [[ax, ay], [bx, by]] = cells(s.piece) as [[number, number], [number, number]];
  const ia = idx(ax, ay);
  const ib = idx(bx, by);
  s.color[ia] = s.piece.a;
  s.color[ib] = s.piece.b;
  s.kind[ia] = s.kind[ib] = HALF;
  s.mate[ia] = ib;
  s.mate[ib] = ia;
  s.phase = 'resolve';
  s.timer = STEP;
  s.chain = 0;
}

function resolveStep(s: ClinicState, rng: Rng, emit: UpdateContext['emit']): void {
  const hits = findMatches(s);
  if (hits.length > 0) {
    s.chain += 1;
    let germs = 0;
    for (const i of hits) {
      if (s.kind[i] === GERM) germs++;
      const m = s.mate[i]!;
      if (m >= 0 && !hits.includes(m)) s.mate[m] = -1;
      s.color[i] = 0;
      s.kind[i] = EMPTY;
      s.mate[i] = -1;
    }
    s.score += (germs * 100 + (hits.length - germs) * 10) * s.chain;
    emit(germs > 0 ? 'explode' : 'pickup');
    return;
  }
  if (gravityStep(s)) return;
  if (germCount(s) === 0) {
    s.score += 500 * s.level;
    s.level += 1;
    buildLevel(s, rng);
    emit('wave');
  }
  spawn(s, rng);
}

function rotate(s: ClinicState, dir: 1 | -1): boolean {
  const o = (s.piece.o + dir + 4) % 4;
  const [dx] = ORIENT[o]!;
  // Try in place, then kick away from the side the second half swings to.
  for (const x of [s.piece.x, s.piece.x - dx]) {
    const cand = { ...s.piece, x, o };
    if (fits(s, cand)) {
      s.piece = cand;
      return true;
    }
  }
  return false;
}

function update(s: ClinicState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  if (s.banner > 0) s.banner -= dt;

  if (s.phase === 'resolve') {
    s.timer -= dt;
    while (s.timer <= 0 && s.phase === 'resolve' && !s.over) {
      s.timer += STEP;
      resolveStep(s, rng, emit);
    }
  } else {
    const dir = autoRepeat(s, input, dt);
    if (dir !== 0 && fits(s, { ...s.piece, x: s.piece.x + dir })) s.piece.x += dir;
    if (input.pressed.a || input.pressed.up) rotate(s, 1);
    if (input.pressed.b) rotate(s, -1);

    const interval = input.held.down ? 0.03 : Math.max(0.2, 0.75 - s.level * 0.035);
    s.fall += dt;
    while (s.fall >= interval && s.phase === 'drop') {
      s.fall -= interval;
      if (fits(s, { ...s.piece, y: s.piece.y + 1 })) s.piece.y += 1;
      else lock(s);
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function half(g: CanvasRenderingContext2D, x: number, y: number, color: number, mate: 'l' | 'r' | 'u' | 'd' | null): void {
  const pad = 2;
  g.fillStyle = GEM_COLORS[color - 1]!;
  g.fillRect(x + pad + (mate === 'l' ? -pad : 0), y + pad + (mate === 'u' ? -pad : 0), CELL - pad * 2 + (mate === 'l' || mate === 'r' ? pad : 0), CELL - pad * 2 + (mate === 'u' || mate === 'd' ? pad : 0));
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(x + 7, y + 6, 6, 4);
}

function germ(g: CanvasRenderingContext2D, x: number, y: number, color: number): void {
  g.fillStyle = GEM_COLORS[color - 1]!;
  g.beginPath();
  g.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.bg;
  g.fillRect(x + 8, y + 10, 4, 5);
  g.fillRect(x + 18, y + 10, 4, 5);
}

function render(s: ClinicState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.lineWidth = 2;
  g.strokeRect(OX - 2, OY - 2, COLS * CELL + 4, ROWS * CELL + 4);
  for (let i = 0; i < s.kind.length; i++) {
    const k = s.kind[i];
    if (k === EMPTY) continue;
    const x = OX + (i % COLS) * CELL;
    const y = OY + Math.floor(i / COLS) * CELL;
    if (k === GERM) germ(g, x, y, s.color[i]!);
    else {
      const m = s.mate[i]!;
      half(g, x, y, s.color[i]!, m === i - 1 ? 'l' : m === i + 1 ? 'r' : m === i - COLS ? 'u' : m === i + COLS ? 'd' : null);
    }
  }
  if (!s.over && s.phase === 'drop') {
    const [[ax, ay], [bx, by]] = cells(s.piece) as [[number, number], [number, number]];
    half(g, OX + ax * CELL, OY + ay * CELL, s.piece.a, bx > ax ? 'r' : bx < ax ? 'l' : by < ay ? 'u' : 'd');
    half(g, OX + bx * CELL, OY + by * CELL, s.piece.b, bx > ax ? 'l' : bx < ax ? 'r' : by < ay ? 'd' : 'u');
  }
  const px = OX + COLS * CELL + 36;
  g.fillStyle = COLORS.muted;
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('NEXT', px, OY + 4);
  half(g, px, OY + 30, s.next.a, 'r');
  half(g, px + CELL, OY + 30, s.next.b, 'l');
  g.fillText(`GERMS ${germCount(s)}`, px, OY + 100);
  if (s.chain > 1) g.fillText(`CHAIN x${s.chain}`, px, OY + 130);
  if (s.banner > 0 && !s.over) banner(g, `LEVEL ${s.level}`, 250);
  hud(g, s, `LEVEL ${s.level}`);
  gameOver(g, s.over);
}

const game: GameDefinition<ClinicState> = {
  id: 'capsule-clinic',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, s.level),
};
export default game;
