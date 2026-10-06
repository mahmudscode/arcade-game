import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const BUCKET_Y = H - 90;
const BUCKET_W = 90;
const BUCKET_GAP = 22;
const START_BUCKETS = 3;
const MAX_LEVEL = 8;

export interface CatcherState {
  bucketX: number;
  buckets: number;
  bomber: { x: number; target: number; retarget: number };
  bombs: { x: number; y: number }[];
  dropTimer: number;
  /** Bombs left to drop this round. */
  left: number;
  roundDelay: number;
  sparks: Spark[];
  score: number;
  hi: number;
  level: number;
  over: boolean;
}

const roundSize = (level: number) => 10 + level * 5;

function init({ hiScore }: { rng: Rng; hiScore: number }): CatcherState {
  return {
    bucketX: W / 2,
    buckets: START_BUCKETS,
    bomber: { x: W / 2, target: W / 2, retarget: 0 },
    bombs: [],
    dropTimer: 1,
    left: roundSize(1),
    roundDelay: 0,
    sparks: [],
    score: 0,
    hi: hiScore,
    level: 1,
    over: false,
  };
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

  if (input.held.left) s.bucketX -= 560 * dt;
  if (input.held.right) s.bucketX += 560 * dt;
  s.bucketX = Math.min(W - BUCKET_W / 2, Math.max(BUCKET_W / 2, s.bucketX));

  const b = s.bomber;
  b.retarget -= dt;
  if (b.retarget <= 0) {
    b.target = rng.range(60, W - 60);
    b.retarget = rng.range(0.4, 1.1);
  }
  const bStep = (200 + s.level * 50) * dt;
  b.x += Math.max(-bStep, Math.min(bStep, b.target - b.x));

  if (s.left > 0 && s.roundDelay <= 0) {
    s.dropTimer -= dt;
    if (s.dropTimer <= 0) {
      s.bombs.push({ x: b.x, y: 80 });
      s.left -= 1;
      s.dropTimer = Math.max(0.35, 1.0 - s.level * 0.1) * rng.range(0.7, 1.2);
    }
  }

  const fallSpeed = 180 + s.level * 45;
  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const bomb = s.bombs[i]!;
    bomb.y += fallSpeed * dt;
    const top = BUCKET_Y - (s.buckets - 1) * BUCKET_GAP;
    if (bomb.y >= top - 6 && bomb.y <= top + 16 && Math.abs(bomb.x - s.bucketX) <= BUCKET_W / 2 + 6) {
      s.score += s.level;
      burst(s.sparks, rng, bomb.x, bomb.y, COLORS.cyan, 5);
      emit('pickup');
      s.bombs.splice(i, 1);
    } else if (bomb.y > H - 30) {
      // A bomb hit the floor: it blows up every bomb on screen and costs a bucket.
      for (const other of s.bombs) burst(s.sparks, rng, other.x, Math.min(other.y, H - 30), COLORS.coral, 8);
      s.bombs = [];
      s.buckets -= 1;
      emit('die');
      if (s.buckets <= 0) s.over = true;
      break;
    }
  }

  stepSparks(s.sparks, dt);

  if (!s.over && s.left === 0 && s.bombs.length === 0) {
    if (s.roundDelay <= 0) s.roundDelay = 1.2;
    s.roundDelay -= dt;
    if (s.roundDelay <= 0) {
      s.level = Math.min(s.level + 1, MAX_LEVEL);
      s.left = roundSize(s.level);
      s.buckets = Math.min(START_BUCKETS, s.buckets + 1);
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: CatcherState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.fillStyle = COLORS.purple;
  g.fillRect(0, H - 30, W, 4);

  g.fillStyle = COLORS.coral;
  g.fillRect(s.bomber.x - 24, 40, 48, 30);
  g.fillStyle = COLORS.paper;
  g.fillRect(s.bomber.x - 12, 48, 8, 8);
  g.fillRect(s.bomber.x + 4, 48, 8, 8);

  g.fillStyle = COLORS.gold;
  for (const b of s.bombs) {
    g.beginPath();
    g.arc(b.x, b.y, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.coral;
    g.fillRect(b.x - 1, b.y - 16, 3, 7);
    g.fillStyle = COLORS.gold;
  }

  g.fillStyle = COLORS.cyan;
  for (let i = 0; i < s.buckets; i++) g.fillRect(s.bucketX - BUCKET_W / 2, BUCKET_Y - i * BUCKET_GAP, BUCKET_W, 14);

  drawSparks(g, s.sparks);
  hud(g, s, `ROUND ${s.level}  BOMBS ${s.left + s.bombs.length}`, s.buckets);
  if (s.roundDelay > 0) banner(g, 'ROUND CLEAR!', 260);
  gameOver(g, s.over);
}

const game: GameDefinition<CatcherState> = {
  id: 'bomb-catcher',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.buckets, s.level),
};
export default game;
