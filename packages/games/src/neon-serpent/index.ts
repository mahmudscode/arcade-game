import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const CELL = 20;
const COLS = 40;
const ROWS = 26;
const OY = 40;

type Dir = 0 | 1 | 2 | 3; // up right down left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface SerpentState {
  body: { x: number; y: number }[];
  dir: Dir;
  /** Direction queued for the next step; prevents reversing into yourself. */
  next: Dir;
  food: { x: number; y: number };
  timer: number;
  grow: number;
  score: number;
  hi: number;
  over: boolean;
}

function placeFood(s: SerpentState, rng: Rng): void {
  for (let tries = 0; tries < 400; tries++) {
    const p = { x: rng.int(0, COLS - 1), y: rng.int(0, ROWS - 1) };
    if (!s.body.some((b) => b.x === p.x && b.y === p.y)) {
      s.food = p;
      return;
    }
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): SerpentState {
  const s: SerpentState = {
    body: [
      { x: 10, y: 13 },
      { x: 9, y: 13 },
      { x: 8, y: 13 },
    ],
    dir: 1,
    next: 1,
    food: { x: 0, y: 0 },
    timer: 0,
    grow: 0,
    score: 0,
    hi: hiScore,
    over: false,
  };
  placeFood(s, rng);
  return s;
}

const level = (s: SerpentState) => 1 + Math.floor(s.body.length / 8);

function update(s: SerpentState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

  const want: Dir | null = input.pressed.up || input.held.up ? 0 : input.pressed.right || input.held.right ? 1 : input.pressed.down || input.held.down ? 2 : input.pressed.left || input.held.left ? 3 : null;
  if (want !== null && (want + 2) % 4 !== s.dir) s.next = want;

  s.timer += dt;
  const interval = Math.max(0.05, 0.14 - (level(s) - 1) * 0.012);
  if (s.timer < interval) return;
  s.timer -= interval;

  s.dir = s.next;
  const head = s.body[0]!;
  const nx = head.x + DX[s.dir]!;
  const ny = head.y + DY[s.dir]!;
  const tailGrows = s.grow > 0;
  const bodyToCheck = tailGrows ? s.body : s.body.slice(0, -1);
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || bodyToCheck.some((b) => b.x === nx && b.y === ny)) {
    s.over = true;
    emit('die');
    return;
  }
  s.body.unshift({ x: nx, y: ny });
  if (tailGrows) s.grow -= 1;
  else s.body.pop();

  if (nx === s.food.x && ny === s.food.y) {
    s.score += 10 * level(s);
    s.grow += 1;
    emit('pickup');
    placeFood(s, rng);
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: SerpentState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  g.strokeRect(1, OY - 1, COLS * CELL - 2, ROWS * CELL + 2);
  g.globalAlpha = 1;
  g.fillStyle = COLORS.gold;
  g.fillRect(s.food.x * CELL + 3, OY + s.food.y * CELL + 3, CELL - 6, CELL - 6);
  s.body.forEach((b, i) => {
    g.fillStyle = i === 0 ? COLORS.paper : COLORS.cyan;
    g.fillRect(b.x * CELL + 1, OY + b.y * CELL + 1, CELL - 2, CELL - 2);
  });
  hud(g, s, `LEVEL ${level(s)}`);
  gameOver(g, s.over);
}

const game: GameDefinition<SerpentState> = {
  id: 'neon-serpent',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, level(s)),
};
export default game;
