import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, W, type Spark } from '../_shared';

const LANES = 5;
const LANE_W = 72;
const OX = W / 2 - (LANES * LANE_W) / 2;
const TILE = 36;
const TOP = 56;
const END = 300;
const BIN_ROWS = 5;
const BIN_Y = H - 30 - BIN_ROWS * TILE;
const STACK_MAX = 5;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_LEVEL = 30;
const GOAL = 24;
const TILE_COLORS = [COLORS.coral, COLORS.gold, COLORS.cyan, COLORS.purple, '#7BE495', '#FF9F68'];

interface Tile {
  lane: number;
  y: number;
  color: number;
}

export interface CatcherState {
  tiles: Tile[];
  lane: number;
  stack: number[];
  /** Row-major, row 0 is the top row; -1 empty. */
  bin: number[];
  spawnCd: number;
  moveCd: number;
  cleared: number;
  chainFlash: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  nextLife: number;
}

const colorsFor = (level: number) => Math.min(6, 3 + Math.floor(level / 2));

function init({ hiScore }: { rng: Rng; hiScore: number }): CatcherState {
  return {
    tiles: [],
    lane: 2,
    stack: [],
    bin: Array.from({ length: LANES * BIN_ROWS }, () => -1),
    spawnCd: 1,
    moveCd: 0,
    cleared: 0,
    chainFlash: 0,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    nextLife: EXTRA_LIFE_EVERY,
  };
}

const bi = (col: number, row: number) => row * LANES + col;

/** Find every tile that is part of a line of 3+ same-colour tiles: rows, columns and both diagonals. */
function findMatches(bin: number[]): Set<number> {
  const out = new Set<number>();
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
  for (let row = 0; row < BIN_ROWS; row++) {
    for (let col = 0; col < LANES; col++) {
      const c = bin[bi(col, row)]!;
      if (c < 0) continue;
      for (const [dx, dy] of dirs) {
        const line = [[col, row]];
        let x = col + dx;
        let y = row + dy;
        while (x >= 0 && x < LANES && y >= 0 && y < BIN_ROWS && bin[bi(x, y)] === c) {
          line.push([x, y]);
          x += dx;
          y += dy;
        }
        if (line.length >= 3) for (const [lx, ly] of line) out.add(bi(lx!, ly!));
      }
    }
  }
  return out;
}

function settle(bin: number[]): void {
  for (let col = 0; col < LANES; col++) {
    const colTiles: number[] = [];
    for (let row = BIN_ROWS - 1; row >= 0; row--) if (bin[bi(col, row)]! >= 0) colTiles.push(bin[bi(col, row)]!);
    for (let row = BIN_ROWS - 1, k = 0; row >= 0; row--, k++) bin[bi(col, row)] = k < colTiles.length ? colTiles[k]! : -1;
  }
}

/** Clear matches until the bin is stable; returns tiles removed and the chain length. */
function resolve(s: CatcherState, rng: Rng, emit: UpdateContext['emit']): void {
  let chain = 0;
  for (;;) {
    const matches = findMatches(s.bin);
    if (matches.size === 0) break;
    chain += 1;
    for (const i of matches) {
      const col = i % LANES;
      const row = Math.floor(i / LANES);
      burst(s.sparks, rng, OX + col * LANE_W + LANE_W / 2, BIN_Y + row * TILE + TILE / 2, TILE_COLORS[s.bin[i]!]!, 6);
      s.bin[i] = -1;
    }
    s.score += matches.size * 100 * chain + (matches.size >= 5 ? 500 : 0);
    s.cleared += matches.size;
    s.chainFlash = 0.5;
    emit('explode');
    settle(s.bin);
  }
}

function loseLife(s: CatcherState, emit: UpdateContext['emit']): void {
  s.lives -= 1;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: CatcherState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  s.chainFlash = Math.max(0, s.chainFlash - dt);
  s.moveCd = Math.max(0, s.moveCd - dt);

  const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  if (dx !== 0 && (s.moveCd <= 0 || input.pressed.left || input.pressed.right)) {
    s.lane = Math.min(LANES - 1, Math.max(0, s.lane + dx));
    s.moveCd = 0.11;
  }
  // Toss the top tile away (up), or drop it into the bin column below the paddle (down / B).
  if (input.pressed.up || input.pressed.a) {
    if (s.stack.pop() !== undefined) emit('fire');
  }
  if ((input.pressed.down || input.pressed.b) && s.stack.length > 0) {
    let row = BIN_ROWS - 1;
    while (row >= 0 && s.bin[bi(s.lane, row)]! >= 0) row -= 1;
    if (row >= 0) {
      s.bin[bi(s.lane, row)] = s.stack.pop()!;
      emit('pickup');
      resolve(s, rng, emit);
    }
  }
  // Bin completely jammed: lose a life and sweep it clean.
  if (s.bin.every((c) => c >= 0)) {
    s.bin.fill(-1);
    loseLife(s, emit);
  }

  s.spawnCd -= dt;
  if (s.spawnCd <= 0) {
    s.spawnCd = Math.max(0.45, 1.6 - s.level * 0.07) * rng.range(0.7, 1.2);
    s.tiles.push({ lane: rng.int(0, LANES - 1), y: TOP, color: rng.int(0, colorsFor(s.level) - 1) });
  }

  const speed = 70 + Math.min(s.level, MAX_LEVEL) * 7;
  for (let i = s.tiles.length - 1; i >= 0; i--) {
    const t = s.tiles[i]!;
    t.y += speed * dt;
    const stop = END - s.stack.length * TILE;
    if (t.lane === s.lane && s.stack.length < STACK_MAX && t.y + TILE / 2 >= stop) {
      s.stack.push(t.color);
      s.tiles.splice(i, 1);
      emit('fire');
    } else if (t.y > END + 50) {
      s.tiles.splice(i, 1);
      loseLife(s, emit);
    }
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.cleared >= GOAL * s.level && s.level < MAX_LEVEL) {
    s.level += 1;
    s.score += 1000;
    emit('wave');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: CatcherState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.fillStyle = '#1d1442';
  g.fillRect(OX, TOP - 6, LANES * LANE_W, END - TOP + 52);
  g.strokeStyle = COLORS.purple;
  g.lineWidth = 2;
  for (let i = 0; i <= LANES; i++) {
    g.beginPath();
    g.moveTo(OX + i * LANE_W, TOP - 6);
    g.lineTo(OX + i * LANE_W, END + 46);
    g.stroke();
  }
  const drawTile = (x: number, y: number, c: number) => {
    g.fillStyle = TILE_COLORS[c]!;
    g.fillRect(x + 4, y + 2, LANE_W - 8, TILE - 4);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(x + 4, y + 2, LANE_W - 8, 6);
  };
  for (const t of s.tiles) drawTile(OX + t.lane * LANE_W, t.y - TILE / 2, t.color);
  s.stack.forEach((c, i) => drawTile(OX + s.lane * LANE_W, END - (i + 1) * TILE, c));
  g.fillStyle = COLORS.paper;
  g.fillRect(OX + s.lane * LANE_W + 2, END, LANE_W - 4, 12);

  g.fillStyle = '#1d1442';
  g.fillRect(OX, BIN_Y - 4, LANES * LANE_W, BIN_ROWS * TILE + 8);
  for (let row = 0; row < BIN_ROWS; row++) {
    for (let col = 0; col < LANES; col++) {
      const c = s.bin[bi(col, row)]!;
      if (c >= 0) drawTile(OX + col * LANE_W, BIN_Y + row * TILE, c);
    }
  }
  drawSparks(g, s.sparks);
  if (s.chainFlash > 0) {
    g.fillStyle = COLORS.gold;
    g.textAlign = 'center';
    g.font = '22px "Press Start 2P", monospace';
    g.fillText('CLEAR!', W / 2, END + 70);
  }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `LEVEL ${s.level}  TILES ${s.cleared}/${GOAL * s.level}`, s.lives);
  gameOver(g, s.over);
}

const tileCatcher: GameDefinition<CatcherState> = {
  id: 'tile-catcher',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};

export default tileCatcher;
