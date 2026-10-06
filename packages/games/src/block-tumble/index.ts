import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, GEM_COLORS, H, W, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const COLS = 10;
const ROWS = 20;
const CELL = 26;
const OX = (W - COLS * CELL) / 2;
const OY = 36;

/** Each piece is a list of [x, y] cells in a 4x4 box for rotation 0; rotation is computed. */
const SHAPES: number[][][] = [
  [[0, 1], [1, 1], [2, 1], [3, 1]], // I
  [[1, 0], [2, 0], [1, 1], [2, 1]], // O
  [[1, 0], [0, 1], [1, 1], [2, 1]], // T
  [[1, 0], [2, 0], [0, 1], [1, 1]], // S
  [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
  [[0, 0], [0, 1], [1, 1], [2, 1]], // J
  [[2, 0], [0, 1], [1, 1], [2, 1]], // L
];

export interface TumbleState {
  grid: number[];
  piece: { kind: number; rot: number; x: number; y: number };
  nextKind: number;
  bag: number[];
  fall: number;
  moveTimer: number;
  lines: number;
  score: number;
  hi: number;
  over: boolean;
}

function cells(kind: number, rot: number): number[][] {
  let c = SHAPES[kind]!.map((p) => [p[0]!, p[1]!]);
  const n = kind === 0 ? 4 : kind === 1 ? 2 : 3;
  for (let r = 0; r < rot; r++) c = c.map(([x, y]) => [n - 1 - y!, x!]);
  return c;
}

function fits(s: TumbleState, kind: number, rot: number, px: number, py: number): boolean {
  return cells(kind, rot).every(([x, y]) => {
    const gx = px + x!;
    const gy = py + y!;
    return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || s.grid[gy * COLS + gx] === 0);
  });
}

function draw7(s: TumbleState, rng: Rng): number {
  if (s.bag.length === 0) {
    const bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    s.bag = bag;
  }
  return s.bag.pop()!;
}

function spawn(s: TumbleState, rng: Rng): void {
  s.piece = { kind: s.nextKind, rot: 0, x: 3, y: 0 };
  s.nextKind = draw7(s, rng);
  s.fall = 0;
  if (!fits(s, s.piece.kind, 0, s.piece.x, s.piece.y)) s.over = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): TumbleState {
  const s: TumbleState = {
    grid: Array.from({ length: COLS * ROWS }, () => 0),
    piece: { kind: 0, rot: 0, x: 3, y: 0 },
    nextKind: 0,
    bag: [],
    fall: 0,
    moveTimer: 0,
    lines: 0,
    score: 0,
    hi: hiScore,
    over: false,
  };
  s.nextKind = draw7(s, rng);
  spawn(s, rng);
  return s;
}

const level = (s: TumbleState) => 1 + Math.floor(s.lines / 10);

function lock(s: TumbleState, rng: Rng, emit: UpdateContext['emit']): void {
  for (const [x, y] of cells(s.piece.kind, s.piece.rot)) {
    const gy = s.piece.y + y!;
    if (gy >= 0) s.grid[gy * COLS + s.piece.x + x!] = s.piece.kind + 1;
  }
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (s.grid.slice(r * COLS, r * COLS + COLS).every((v) => v > 0)) {
      s.grid.splice(r * COLS, COLS);
      s.grid.unshift(...Array.from({ length: COLS }, () => 0));
      cleared += 1;
      r += 1;
    }
  }
  if (cleared > 0) {
    s.score += [0, 100, 300, 500, 800][cleared]! * level(s);
    s.lines += cleared;
    emit(cleared === 4 ? 'wave' : 'explode');
  } else emit('pickup');
  spawn(s, rng);
}

function update(s: TumbleState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  const p = s.piece;

  const dir = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
  if (dir !== 0) {
    const first = input.pressed.left || input.pressed.right;
    s.moveTimer -= dt;
    if ((first || s.moveTimer <= 0) && fits(s, p.kind, p.rot, p.x + dir, p.y)) {
      p.x += dir;
      s.moveTimer = first ? 0.18 : 0.06;
    } else if (first || s.moveTimer <= 0) s.moveTimer = 0.06;
  } else s.moveTimer = 0;

  if (input.pressed.up && fits(s, p.kind, (p.rot + 1) % 4, p.x, p.y)) p.rot = (p.rot + 1) % 4;
  else if (input.pressed.b && fits(s, p.kind, (p.rot + 3) % 4, p.x, p.y)) p.rot = (p.rot + 3) % 4;

  if (input.pressed.a) {
    let dropped = 0;
    while (fits(s, p.kind, p.rot, p.x, p.y + 1)) {
      p.y += 1;
      dropped += 1;
    }
    s.score += dropped * 2;
    lock(s, rng, emit);
  } else {
    const interval = input.held.down ? 0.04 : Math.max(0.05, 0.8 - (level(s) - 1) * 0.07);
    s.fall += dt;
    while (s.fall >= interval && !s.over) {
      s.fall -= interval;
      if (fits(s, p.kind, p.rot, p.x, p.y + 1)) {
        p.y += 1;
        if (input.held.down) s.score += 1;
      } else {
        lock(s, rng, emit);
        break;
      }
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function drawCell(g: CanvasRenderingContext2D, x: number, y: number, kind: number): void {
  g.fillStyle = GEM_COLORS[kind % GEM_COLORS.length]!;
  g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
}

function render(s: TumbleState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.lineWidth = 2;
  g.strokeRect(OX - 2, OY - 2, COLS * CELL + 4, ROWS * CELL + 4);
  s.grid.forEach((v, i) => {
    if (v > 0) drawCell(g, OX + (i % COLS) * CELL, OY + Math.floor(i / COLS) * CELL, v - 1);
  });
  if (!s.over) {
    for (const [x, y] of cells(s.piece.kind, s.piece.rot)) drawCell(g, OX + (s.piece.x + x!) * CELL, OY + (s.piece.y + y!) * CELL, s.piece.kind);
  }
  g.fillStyle = COLORS.muted;
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('NEXT', OX + COLS * CELL + 30, OY + 6);
  for (const [x, y] of cells(s.nextKind, 0)) drawCell(g, OX + COLS * CELL + 30 + x! * CELL, OY + 34 + y! * CELL, s.nextKind);
  g.fillText(`LINES ${s.lines}`, OX + COLS * CELL + 30, OY + 170);
  hud(g, s, `LEVEL ${level(s)}`);
  gameOver(g, s.over);
}

const game: GameDefinition<TumbleState> = {
  id: 'block-tumble',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, level(s)),
};
export default game;
