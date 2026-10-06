import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, GEM_COLORS, H, W, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const COLS = 6;
const ROWS = 13;
const CELL = 38;
const OX = (W - COLS * CELL) / 2;
const OY = 36;
const GEMS = 5;

export interface CascadeState {
  grid: number[];
  /** Falling column: three gems, top first. */
  piece: { x: number; y: number; gems: number[] };
  next: number[];
  fall: number;
  moveTimer: number;
  jewels: number;
  chain: number;
  score: number;
  hi: number;
  over: boolean;
}

const newGems = (rng: Rng) => [rng.int(1, GEMS), rng.int(1, GEMS), rng.int(1, GEMS)];
const at = (s: CascadeState, x: number, y: number) => (x < 0 || x >= COLS || y >= ROWS ? 1 : y < 0 ? 0 : s.grid[y * COLS + x]!);
const level = (s: CascadeState) => 1 + Math.floor(s.jewels / 30);

function spawn(s: CascadeState, rng: Rng): void {
  s.piece = { x: 2, y: -2, gems: s.next };
  s.next = newGems(rng);
  s.fall = 0;
  if (at(s, 2, 0) !== 0) s.over = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): CascadeState {
  const s: CascadeState = {
    grid: Array.from({ length: COLS * ROWS }, () => 0),
    piece: { x: 2, y: -2, gems: [1, 1, 1] },
    next: newGems(rng),
    fall: 0,
    moveTimer: 0,
    jewels: 0,
    chain: 0,
    score: 0,
    hi: hiScore,
    over: false,
  };
  spawn(s, rng);
  return s;
}

/** Finds runs of 3+ in any of the four line directions and returns the cell indices to clear. */
function findMatches(s: CascadeState): number[] {
  const marked = new Set<number>();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = s.grid[y * COLS + x]!;
      if (v === 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]] as const) {
        let n = 1;
        while (x + dx * n >= 0 && x + dx * n < COLS && y + dy * n >= 0 && y + dy * n < ROWS && s.grid[(y + dy * n) * COLS + x + dx * n] === v) n++;
        if (n >= 3) for (let k = 0; k < n; k++) marked.add((y + dy * k) * COLS + x + dx * k);
      }
    }
  }
  return [...marked];
}

function settle(s: CascadeState): void {
  for (let x = 0; x < COLS; x++) {
    const col: number[] = [];
    for (let y = ROWS - 1; y >= 0; y--) if (s.grid[y * COLS + x]) col.push(s.grid[y * COLS + x]!);
    for (let y = ROWS - 1; y >= 0; y--) s.grid[y * COLS + x] = col[ROWS - 1 - y] ?? 0;
  }
}

function lock(s: CascadeState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = s.piece;
  if (p.y < 0) {
    s.over = true;
    emit('die');
    return;
  }
  p.gems.forEach((gem, i) => {
    if (p.y + i >= 0) s.grid[(p.y + i) * COLS + p.x] = gem;
  });
  s.chain = 0;
  for (;;) {
    const hit = findMatches(s);
    if (hit.length === 0) break;
    s.chain += 1;
    for (const i of hit) s.grid[i] = 0;
    s.jewels += hit.length;
    s.score += hit.length * 10 * s.chain * level(s);
    emit(s.chain > 1 ? 'wave' : 'explode');
    settle(s);
  }
  if (s.chain === 0) emit('pickup');
  spawn(s, rng);
}

function update(s: CascadeState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  const p = s.piece;
  const free = (x: number) => [0, 1, 2].every((i) => at(s, x, Math.floor(p.y) + i) === 0);

  const dir = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
  if (dir !== 0) {
    const first = input.pressed.left || input.pressed.right;
    s.moveTimer -= dt;
    if ((first || s.moveTimer <= 0) && free(p.x + dir)) {
      p.x += dir;
      s.moveTimer = first ? 0.18 : 0.08;
    } else if (first || s.moveTimer <= 0) s.moveTimer = 0.08;
  } else s.moveTimer = 0;

  if (input.pressed.up || input.pressed.a) p.gems = [p.gems[2]!, p.gems[0]!, p.gems[1]!];
  if (input.pressed.b) p.gems = [p.gems[1]!, p.gems[2]!, p.gems[0]!];

  const interval = input.held.down ? 0.04 : Math.max(0.08, 0.7 - (level(s) - 1) * 0.06);
  s.fall += dt;
  while (s.fall >= interval && !s.over) {
    s.fall -= interval;
    if (at(s, p.x, p.y + 3) === 0) p.y += 1;
    else {
      lock(s, rng, emit);
      break;
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function gem(g: CanvasRenderingContext2D, x: number, y: number, kind: number): void {
  g.fillStyle = GEM_COLORS[(kind - 1) % GEM_COLORS.length]!;
  g.beginPath();
  g.moveTo(x + CELL / 2, y + 3);
  g.lineTo(x + CELL - 4, y + CELL / 2);
  g.lineTo(x + CELL / 2, y + CELL - 3);
  g.lineTo(x + 4, y + CELL / 2);
  g.closePath();
  g.fill();
}

function render(s: CascadeState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.lineWidth = 2;
  g.strokeRect(OX - 2, OY - 2, COLS * CELL + 4, ROWS * CELL + 4);
  s.grid.forEach((v, i) => {
    if (v > 0) gem(g, OX + (i % COLS) * CELL, OY + Math.floor(i / COLS) * CELL, v);
  });
  if (!s.over) {
    s.piece.gems.forEach((v, i) => {
      if (s.piece.y + i >= 0) gem(g, OX + s.piece.x * CELL, OY + (s.piece.y + i) * CELL, v);
    });
  }
  g.fillStyle = COLORS.muted;
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('NEXT', OX + COLS * CELL + 30, OY + 6);
  s.next.forEach((v, i) => gem(g, OX + COLS * CELL + 30, OY + 30 + i * CELL, v));
  if (s.chain > 1) g.fillText(`CHAIN x${s.chain}`, OX + COLS * CELL + 30, OY + 170);
  hud(g, s, `LEVEL ${level(s)}`);
  gameOver(g, s.over);
}

const game: GameDefinition<CascadeState> = {
  id: 'gem-cascade',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, level(s)),
};
export default game;
