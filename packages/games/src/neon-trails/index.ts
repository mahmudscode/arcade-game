import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const CELL = 20;
const COLS = 40;
const ROWS = 26;
const OY = 40;
const START_LIVES = 3;
const MAX_LEVEL = 15;

type Dir = 0 | 1 | 2 | 3; // up right down left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

interface Cycle { x: number; y: number; dir: Dir; next: Dir }

export interface TrailState {
  /** 0 empty, 1 player trail, 2 rival trail. */
  grid: number[];
  me: Cycle;
  rival: Cycle;
  timer: number;
  /** >0 while showing the result of a round. */
  pause: number;
  result: '' | 'win' | 'lose';
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

function newRound(s: TrailState): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => 0);
  s.me = { x: 6, y: 13, dir: 1, next: 1 };
  s.rival = { x: COLS - 7, y: 13, dir: 3, next: 3 };
  s.grid[13 * COLS + 6] = 1;
  s.grid[13 * COLS + COLS - 7] = 2;
  s.timer = 0;
  s.pause = 0;
  s.result = '';
}

function init({ hiScore }: { rng: Rng; hiScore: number }): TrailState {
  const s: TrailState = {
    grid: [],
    me: { x: 0, y: 0, dir: 1, next: 1 },
    rival: { x: 0, y: 0, dir: 3, next: 3 },
    timer: 0,
    pause: 0,
    result: '',
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  newRound(s);
  return s;
}

const blocked = (s: TrailState, x: number, y: number) => x < 0 || x >= COLS || y < 0 || y >= ROWS || s.grid[y * COLS + x] !== 0;

/** How many free cells in a straight line from (x, y) heading `dir`, capped. */
function clearance(s: TrailState, x: number, y: number, dir: Dir, cap: number): number {
  let n = 0;
  while (n < cap && !blocked(s, x + DX[dir]! * (n + 1), y + DY[dir]! * (n + 1))) n++;
  return n;
}

function steerRival(s: TrailState, rng: Rng): void {
  const r = s.rival;
  const ahead = clearance(s, r.x, r.y, r.dir, 8);
  const turnChance = 0.04 + s.level * 0.005;
  const left = ((r.dir + 3) % 4) as Dir;
  const right = ((r.dir + 1) % 4) as Dir;
  if (ahead >= 8) {
    if (rng.next() > turnChance) {
      r.next = r.dir;
      return;
    }
    // Occasional random turn into open space so the rival is not predictable.
    const open = [left, right].filter((d) => clearance(s, r.x, r.y, d, 6) >= 6);
    r.next = open.length > 0 ? rng.pick(open) : r.dir;
    return;
  }
  const options: { d: Dir; c: number }[] = [
    { d: r.dir, c: ahead },
    { d: left, c: clearance(s, r.x, r.y, left, 12) },
    { d: right, c: clearance(s, r.x, r.y, right, 12) },
  ];
  // Prefer the roomiest direction; the level sets how far it looks ahead.
  const look = 4 + s.level;
  options.sort((a, b) => Math.min(b.c, look) - Math.min(a.c, look) || (a.d === r.dir ? -1 : 1));
  r.next = options[0]!.d;
}

function update(s: TrailState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

  if (s.pause > 0) {
    s.pause -= dt;
    if (s.pause <= 0) {
      if (s.result === 'win') s.level = Math.min(s.level + 1, MAX_LEVEL);
      newRound(s);
      emit('wave');
    }
    return;
  }

  const want: Dir | null = input.pressed.up ? 0 : input.pressed.right ? 1 : input.pressed.down ? 2 : input.pressed.left ? 3 : null;
  if (want !== null && (want + 2) % 4 !== s.me.dir) s.me.next = want;

  s.timer += dt;
  const interval = Math.max(0.045, 0.1 - (s.level - 1) * 0.004);
  if (s.timer < interval) return;
  s.timer -= interval;

  steerRival(s, rng);
  s.me.dir = s.me.next;
  s.rival.dir = s.rival.next;
  const mx = s.me.x + DX[s.me.dir]!;
  const my = s.me.y + DY[s.me.dir]!;
  const rx = s.rival.x + DX[s.rival.dir]!;
  const ry = s.rival.y + DY[s.rival.dir]!;
  const meDead = blocked(s, mx, my) || (mx === rx && my === ry);
  const rivalDead = blocked(s, rx, ry) || (mx === rx && my === ry);

  if (meDead || rivalDead) {
    if (meDead) {
      s.lives -= 1;
      s.result = 'lose';
      emit('die');
      if (s.lives <= 0) s.over = true;
    } else {
      s.score += 100 * s.level;
      s.result = 'win';
      emit('explode');
    }
    s.pause = 1.2;
    if (s.score > s.hi) s.hi = s.score;
    return;
  }

  s.me.x = mx;
  s.me.y = my;
  s.rival.x = rx;
  s.rival.y = ry;
  s.grid[my * COLS + mx] = 1;
  s.grid[ry * COLS + rx] = 2;
  s.score += 1;
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: TrailState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  g.strokeRect(1, OY - 1, COLS * CELL - 2, ROWS * CELL + 2);
  g.globalAlpha = 1;
  s.grid.forEach((v, i) => {
    if (v === 0) return;
    g.fillStyle = v === 1 ? COLORS.cyan : COLORS.coral;
    g.fillRect((i % COLS) * CELL + 2, OY + Math.floor(i / COLS) * CELL + 2, CELL - 4, CELL - 4);
  });
  g.fillStyle = COLORS.paper;
  g.fillRect(s.me.x * CELL + 2, OY + s.me.y * CELL + 2, CELL - 4, CELL - 4);
  g.fillRect(s.rival.x * CELL + 2, OY + s.rival.y * CELL + 2, CELL - 4, CELL - 4);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  if (s.pause > 0 && !s.over) banner(g, s.result === 'win' ? 'RIVAL CRASHED!' : 'CRASHED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<TrailState> = {
  id: 'neon-trails',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
