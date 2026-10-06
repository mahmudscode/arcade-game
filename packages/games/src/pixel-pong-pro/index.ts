import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const PAD_W = 14;
const PAD_H = 90;
const PLAYER_X = 40;
const AI_X = W - 40;
const BALL = 8;
const START_LIVES = 3;
const POINTS_PER_LEVEL = 5;

export interface PongState {
  player: number;
  ai: number;
  ball: { x: number; y: number; vx: number; vy: number };
  /** Seconds before the ball is served. */
  serve: number;
  serveDir: 1 | -1;
  aiError: number;
  won: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

function serveBall(s: PongState, rng: Rng): void {
  s.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  s.serve = 1;
  s.aiError = rng.range(-30, 30);
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): PongState {
  const s: PongState = {
    player: H / 2,
    ai: H / 2,
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    serve: 1,
    serveDir: 1,
    aiError: 0,
    won: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  serveBall(s, rng);
  return s;
}

function update(s: PongState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

  if (input.held.up) s.player -= 420 * dt;
  if (input.held.down) s.player += 420 * dt;
  s.player = Math.min(H - 40 - PAD_H / 2, Math.max(40 + PAD_H / 2, s.player));

  const b = s.ball;
  if (s.serve > 0) {
    s.serve -= dt;
    if (s.serve <= 0) {
      const a = rng.range(-0.5, 0.5);
      const sp = 330 + s.level * 15;
      b.vx = Math.cos(a) * sp * s.serveDir;
      b.vy = Math.sin(a) * sp;
      emit('fire');
    }
  } else {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < 40 + BALL || b.y > H - 40 - BALL) {
      b.y = Math.min(H - 40 - BALL, Math.max(40 + BALL, b.y));
      b.vy = -b.vy;
    }
    const hit = (padY: number, x: number, dir: 1 | -1): boolean => {
      if (Math.abs(b.x - x) > PAD_W / 2 + BALL || Math.abs(b.y - padY) > PAD_H / 2 + BALL) return false;
      if (Math.sign(b.vx) === dir) return false;
      const off = (b.y - padY) / (PAD_H / 2 + BALL);
      const sp = Math.min(760, Math.hypot(b.vx, b.vy) * 1.05);
      b.vx = Math.cos(off * 0.9) * sp * dir;
      b.vy = Math.sin(off * 0.9) * sp;
      return true;
    };
    if (hit(s.player, PLAYER_X, 1) || hit(s.ai, AI_X, -1)) emit('fire');

    if (b.x < 0) {
      s.lives -= 1;
      s.serveDir = -1;
      emit('die');
      if (s.lives <= 0) s.over = true;
      else serveBall(s, rng);
    } else if (b.x > W) {
      s.won += 1;
      s.score += 100 * s.level;
      s.level = 1 + Math.floor(s.won / POINTS_PER_LEVEL);
      s.serveDir = 1;
      emit('explode');
      serveBall(s, rng);
    }
  }

  // AI follows the ball (when it is heading its way) with a capped speed that grows with the level.
  const target = b.vx > 0 ? b.y + s.aiError : H / 2;
  const maxMove = (200 + s.level * 28) * dt;
  s.ai += Math.max(-maxMove, Math.min(maxMove, target - s.ai));
  s.ai = Math.min(H - 40 - PAD_H / 2, Math.max(40 + PAD_H / 2, s.ai));
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: PongState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.fillStyle = COLORS.muted;
  g.globalAlpha = 0.4;
  g.fillRect(0, 36, W, 4);
  g.fillRect(0, H - 40, W, 4);
  for (let y = 48; y < H - 48; y += 28) g.fillRect(W / 2 - 2, y, 4, 14);
  g.globalAlpha = 1;
  g.fillStyle = COLORS.cyan;
  g.fillRect(PLAYER_X - PAD_W / 2, s.player - PAD_H / 2, PAD_W, PAD_H);
  g.fillStyle = COLORS.coral;
  g.fillRect(AI_X - PAD_W / 2, s.ai - PAD_H / 2, PAD_W, PAD_H);
  g.fillStyle = COLORS.paper;
  g.fillRect(s.ball.x - BALL / 2, s.ball.y - BALL / 2, BALL, BALL);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  gameOver(g, s.over);
}

const game: GameDefinition<PongState> = {
  id: 'pixel-pong-pro',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
