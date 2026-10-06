import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, GEM_COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/** Paddle-and-ball archetype (PB). Breakout and Arkanoid are configurations of this. */
export interface BrickConfig {
  id: string;
  /** Brick hit points for a cell; 0 means empty. */
  layout(level: number, row: number, col: number): number;
  /** Chance that a destroyed brick drops a capsule. */
  capsuleChance: number;
  /** Base ball speed at level 1 (px/s). */
  speed: number;
}

export const COLS = 12;
export const ROWS = 8;
const BW = 60;
const BH = 22;
const LEFT = 40;
const TOP = 70;
const PADDLE_Y = H - 50;
const PADDLE_BASE = 100;
const R = 6;
const START_LIVES = 3;
const MAX_LEVEL = 30;

type CapsuleKind = 'wide' | 'multi' | 'slow';
interface Ball { x: number; y: number; vx: number; vy: number; stuck: boolean }
interface Capsule { x: number; y: number; kind: CapsuleKind }

export interface BrickState {
  paddle: { x: number; w: number; wideTime: number };
  balls: Ball[];
  bricks: number[];
  capsules: Capsule[];
  sparks: Spark[];
  launchTimer: number;
  slowTime: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  levelDelay: number;
}

const speedFor = (cfg: BrickConfig, level: number) => cfg.speed * (1 + Math.min(level - 1, MAX_LEVEL) * 0.04);

function buildBricks(cfg: BrickConfig, level: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push(cfg.layout(level, r, c));
  return out;
}

export function createBrickGame(cfg: BrickConfig): GameDefinition<BrickState> {
  function stick(s: BrickState): void {
    s.balls = [{ x: s.paddle.x, y: PADDLE_Y - R - 1, vx: 0, vy: 0, stuck: true }];
    s.launchTimer = 1.5;
  }

  function init({ hiScore }: { rng: Rng; hiScore: number }): BrickState {
    const s: BrickState = {
      paddle: { x: W / 2, w: PADDLE_BASE, wideTime: 0 },
      balls: [],
      bricks: buildBricks(cfg, 1),
      capsules: [],
      sparks: [],
      launchTimer: 0,
      slowTime: 0,
      score: 0,
      hi: hiScore,
      lives: START_LIVES,
      level: 1,
      over: false,
      levelDelay: 0,
    };
    stick(s);
    return s;
  }

  function launch(s: BrickState, b: Ball, rng: Rng): void {
    const a = rng.range(-0.6, 0.6);
    const sp = speedFor(cfg, s.level) * (s.slowTime > 0 ? 0.7 : 1);
    b.stuck = false;
    b.vx = Math.sin(a) * sp;
    b.vy = -Math.cos(a) * sp;
  }

  function hitBrick(s: BrickState, i: number, rng: Rng, emit: UpdateContext['emit']): void {
    const hp = s.bricks[i]! - 1;
    s.bricks[i] = hp;
    const row = Math.floor(i / COLS);
    const x = LEFT + (i % COLS) * BW + BW / 2;
    const y = TOP + row * BH + BH / 2;
    if (hp > 0) {
      emit('fire');
      return;
    }
    s.score += (ROWS - row) * 10;
    burst(s.sparks, rng, x, y, GEM_COLORS[row % GEM_COLORS.length]!, 8);
    emit('explode');
    if (cfg.capsuleChance > 0 && rng.next() < cfg.capsuleChance) {
      s.capsules.push({ x, y, kind: rng.pick<CapsuleKind>(['wide', 'multi', 'slow']) });
    }
  }

  const cellAt = (s: BrickState, x: number, y: number): number => {
    const c = Math.floor((x - LEFT) / BW);
    const r = Math.floor((y - TOP) / BH);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    return s.bricks[r * COLS + c]! > 0 ? r * COLS + c : -1;
  };

  function update(s: BrickState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    if (s.over) {
      if (input.pressed.a || input.pressed.start) {
        Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
        emit('start');
      }
      stepSparks(s.sparks, dt);
      return;
    }

    const p = s.paddle;
    if (input.held.left) p.x -= 520 * dt;
    if (input.held.right) p.x += 520 * dt;
    s.paddle.wideTime = Math.max(0, p.wideTime - dt);
    s.slowTime = Math.max(0, s.slowTime - dt);
    p.w = p.wideTime > 0 ? PADDLE_BASE * 1.6 : PADDLE_BASE;
    p.x = Math.min(W - p.w / 2, Math.max(p.w / 2, p.x));

    for (const b of s.balls) {
      if (b.stuck) {
        b.x = p.x;
        b.y = PADDLE_Y - R - 1;
        s.launchTimer -= dt;
        if (input.pressed.a || s.launchTimer <= 0) launch(s, b, rng);
        continue;
      }
      b.x += b.vx * dt;
      if (b.x < R || b.x > W - R) {
        b.x = Math.min(W - R, Math.max(R, b.x));
        b.vx = -b.vx;
      }
      const hx = cellAt(s, b.x + Math.sign(b.vx) * R, b.y);
      if (hx >= 0) {
        b.vx = -b.vx;
        b.x += b.vx * dt * 2;
        hitBrick(s, hx, rng, emit);
      }
      b.y += b.vy * dt;
      if (b.y < R) {
        b.y = R;
        b.vy = Math.abs(b.vy);
      }
      const hy = cellAt(s, b.x, b.y + Math.sign(b.vy) * R);
      if (hy >= 0) {
        b.vy = -b.vy;
        b.y += b.vy * dt * 2;
        hitBrick(s, hy, rng, emit);
      }
      if (b.vy > 0 && b.y + R >= PADDLE_Y && b.y + R <= PADDLE_Y + 16 && Math.abs(b.x - p.x) <= p.w / 2 + R) {
        const off = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2)));
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.sin(off * 1.1) * sp;
        b.vy = -Math.cos(off * 1.1) * sp;
        b.y = PADDLE_Y - R;
        emit('fire');
      }
    }
    s.balls = s.balls.filter((b) => b.y < H + 20);

    for (let i = s.capsules.length - 1; i >= 0; i--) {
      const c = s.capsules[i]!;
      c.y += 120 * dt;
      if (c.y >= PADDLE_Y - 8 && c.y <= PADDLE_Y + 14 && Math.abs(c.x - p.x) <= p.w / 2 + 14) {
        if (c.kind === 'wide') p.wideTime = 12;
        else if (c.kind === 'slow') s.slowTime = 10;
        else {
          const src = s.balls.find((b) => !b.stuck);
          if (src) {
            s.balls.push({ ...src, vx: src.vx * 0.8 + src.vy * 0.3, vy: src.vy * 0.9 });
            s.balls.push({ ...src, vx: src.vx * 0.8 - src.vy * 0.3, vy: src.vy * 0.9 });
          }
        }
        s.score += 50;
        emit('pickup');
        s.capsules.splice(i, 1);
      } else if (c.y > H + 10) s.capsules.splice(i, 1);
    }

    if (s.balls.length === 0) {
      s.lives -= 1;
      s.capsules = [];
      emit('die');
      if (s.lives <= 0) s.over = true;
      else stick(s);
    }

    stepSparks(s.sparks, dt);

    if (!s.over && s.bricks.every((b) => b === 0)) {
      if (s.levelDelay <= 0) s.levelDelay = 1.2;
      s.levelDelay -= dt;
      if (s.levelDelay <= 0) {
        s.level = Math.min(s.level + 1, MAX_LEVEL);
        s.bricks = buildBricks(cfg, s.level);
        s.capsules = [];
        s.paddle.wideTime = 0;
        stick(s);
        emit('wave');
      }
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function render(s: BrickState, g: CanvasRenderingContext2D): void {
    clear(g);
    s.bricks.forEach((hp, i) => {
      if (hp <= 0) return;
      const r = Math.floor(i / COLS);
      g.fillStyle = hp > 1 ? COLORS.paper : GEM_COLORS[r % GEM_COLORS.length]!;
      g.fillRect(LEFT + (i % COLS) * BW + 1, TOP + r * BH + 1, BW - 2, BH - 2);
    });
    for (const c of s.capsules) {
      g.fillStyle = c.kind === 'wide' ? COLORS.cyan : c.kind === 'multi' ? COLORS.gold : COLORS.purple;
      g.fillRect(c.x - 14, c.y - 7, 28, 14);
      g.fillStyle = COLORS.bg;
      g.font = '10px "Press Start 2P", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(c.kind === 'wide' ? 'W' : c.kind === 'multi' ? 'M' : 'S', c.x, c.y);
    }
    g.fillStyle = COLORS.cyan;
    g.fillRect(s.paddle.x - s.paddle.w / 2, PADDLE_Y, s.paddle.w, 10);
    g.fillStyle = COLORS.paper;
    for (const b of s.balls) {
      g.beginPath();
      g.arc(b.x, b.y, R, 0, Math.PI * 2);
      g.fill();
    }
    drawSparks(g, s.sparks);
    hud(g, s, `LEVEL ${s.level}`, s.lives);
    if (s.levelDelay > 0) banner(g, 'CLEARED!', 300);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
