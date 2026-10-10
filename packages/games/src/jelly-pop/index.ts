import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, GEM_COLORS, H, W, clear, gameOver, hud, makeStatus } from '../_shared/ui';
import { ORIENT, autoRepeat } from '../_shared/falling';

const COLS = 6;
const ROWS = 12;
const CELL = 40;
const OX = 280;
const OY = 44;
const KINDS = 4;
const STEP = 0.09;
/** Chain bonus multiplier by chain length (1-based, clamped to the last entry). */
const CHAIN_POWER = [1, 8, 16, 32, 64, 128, 256, 512];

export interface JellyState {
  grid: number[];
  /** Falling pair: `a` is the pivot, `b` sits at ORIENT[o] relative to it. */
  piece: { x: number; y: number; o: number; a: number; b: number };
  next: { a: number; b: number };
  phase: 'drop' | 'resolve';
  timer: number;
  fall: number;
  moveTimer: number;
  popped: number;
  chain: number;
  score: number;
  hi: number;
  over: boolean;
}

const pair = (rng: Rng) => ({ a: rng.int(1, KINDS), b: rng.int(1, KINDS) });
const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
const free = (s: JellyState, x: number, y: number) => inside(x, y) && s.grid[idx(x, y)] === 0;
const cells = (p: JellyState['piece']) => [[p.x, p.y], [p.x + ORIENT[p.o]![0], p.y + ORIENT[p.o]![1]]] as const;
const fits = (s: JellyState, p: JellyState['piece']) => cells(p).every(([x, y]) => free(s, x!, y!));
const level = (s: JellyState) => 1 + Math.floor(s.popped / 40);

function spawn(s: JellyState, rng: Rng): void {
  s.piece = { x: 2, y: 1, o: 1, a: s.next.a, b: s.next.b };
  s.next = pair(rng);
  s.fall = 0;
  s.chain = 0;
  s.phase = 'drop';
  if (!fits(s, s.piece)) s.over = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): JellyState {
  const s: JellyState = {
    grid: Array.from({ length: COLS * ROWS }, () => 0),
    piece: { x: 2, y: 1, o: 1, a: 1, b: 1 },
    next: pair(rng),
    phase: 'drop',
    timer: 0,
    fall: 0,
    moveTimer: 0,
    popped: 0,
    chain: 0,
    score: 0,
    hi: hiScore,
    over: false,
  };
  spawn(s, rng);
  return s;
}

/** Orthogonally connected groups of 4+ same-coloured jellies, as cell indices. */
function findGroups(s: JellyState): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (let start = 0; start < s.grid.length; start++) {
    const c = s.grid[start]!;
    if (c === 0 || seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let k = 0; k < group.length; k++) {
      const i = group[k]!;
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) || seen.has(idx(nx, ny)) || s.grid[idx(nx, ny)] !== c) continue;
        seen.add(idx(nx, ny));
        group.push(idx(nx, ny));
      }
    }
    if (group.length >= 4) out.push(...group);
  }
  return out;
}

/** Drops every unsupported jelly by one row. Returns whether anything moved. */
function gravityStep(s: JellyState): boolean {
  let moved = false;
  for (let y = ROWS - 2; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);
      if (s.grid[i] !== 0 && s.grid[i + COLS] === 0) {
        s.grid[i + COLS] = s.grid[i]!;
        s.grid[i] = 0;
        moved = true;
      }
    }
  }
  return moved;
}

function resolveStep(s: JellyState, rng: Rng, emit: UpdateContext['emit']): void {
  if (gravityStep(s)) return;
  const hit = findGroups(s);
  if (hit.length > 0) {
    s.chain += 1;
    for (const i of hit) s.grid[i] = 0;
    s.popped += hit.length;
    s.score += hit.length * 10 * CHAIN_POWER[Math.min(s.chain, CHAIN_POWER.length) - 1]!;
    emit(s.chain > 1 ? 'wave' : 'explode');
    return;
  }
  spawn(s, rng);
}

function rotate(s: JellyState, dir: 1 | -1): void {
  const o = (s.piece.o + dir + 4) % 4;
  const [dx] = ORIENT[o]!;
  // In place, then kick away from the side the satellite swings to.
  for (const x of [s.piece.x, s.piece.x - dx]) {
    const cand = { ...s.piece, x, o };
    if (fits(s, cand)) {
      s.piece = cand;
      return;
    }
  }
}

function update(s: JellyState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

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

    const interval = input.held.down ? 0.03 : Math.max(0.1, 0.7 - (level(s) - 1) * 0.05);
    s.fall += dt;
    while (s.fall >= interval && s.phase === 'drop') {
      s.fall -= interval;
      if (fits(s, { ...s.piece, y: s.piece.y + 1 })) s.piece.y += 1;
      else {
        for (const [x, y] of cells(s.piece)) s.grid[idx(x, y)] = x === s.piece.x && y === s.piece.y ? s.piece.a : s.piece.b;
        s.phase = 'resolve';
        s.timer = STEP;
        s.chain = 0;
        emit('pickup');
      }
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function jelly(g: CanvasRenderingContext2D, x: number, y: number, kind: number): void {
  g.fillStyle = GEM_COLORS[kind - 1]!;
  g.beginPath();
  g.arc(x + CELL / 2, y + CELL / 2 + 2, CELL / 2 - 3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(x + 9, y + 9, 7, 5);
  g.fillStyle = COLORS.bg;
  g.fillRect(x + 12, y + 20, 4, 5);
  g.fillRect(x + 24, y + 20, 4, 5);
}

function render(s: JellyState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.lineWidth = 2;
  g.strokeRect(OX - 2, OY - 2, COLS * CELL + 4, ROWS * CELL + 4);
  s.grid.forEach((v, i) => {
    if (v > 0) jelly(g, OX + (i % COLS) * CELL, OY + Math.floor(i / COLS) * CELL, v);
  });
  if (!s.over && s.phase === 'drop') {
    const [[ax, ay], [bx, by]] = cells(s.piece) as [[number, number], [number, number]];
    jelly(g, OX + ax * CELL, OY + ay * CELL, s.piece.a);
    jelly(g, OX + bx * CELL, OY + by * CELL, s.piece.b);
  }
  const px = OX + COLS * CELL + 36;
  g.fillStyle = COLORS.muted;
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('NEXT', px, OY + 4);
  jelly(g, px, OY + 30, s.next.a);
  jelly(g, px, OY + 30 + CELL, s.next.b);
  if (s.chain > 1) g.fillText(`CHAIN x${s.chain}`, px, OY + 150);
  hud(g, s, `LEVEL ${level(s)}`);
  gameOver(g, s.over);
}

const game: GameDefinition<JellyState> = {
  id: 'jelly-pop',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, level(s)),
};
export default game;
