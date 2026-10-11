import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { N, VOID, TW, TH, diamond, isoX, isoY, makeTrack, heightAt as heightOf, onTrack as onTrackOf } from '../_shared/iso-track';
import { COLORS, H, TAU, W, banner, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const GRAVITY = 12;
const PUSH = 11;
const DRAG = 0.95;
const MAX_SPEED = 8;
const CHECK_EVERY = 20;
const PENALTY = 3;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 on the track; counts up while falling off the edge. */
  fall: number;
}

export interface TiltState {
  /** N*N tile heights, VOID where there is no track. */
  h: number[];
  /** Centre line of the track, start to finish. */
  path: { x: number; y: number }[];
  marble: Ball;
  /** Index of the path cell nearest the marble that was reached furthest. */
  progress: number;
  steelies: Ball[];
  spawnTimer: number;
  sparks: Spark[];
  time: number;
  levelDelay: number;
  score: number;
  hi: number;
  level: number;
  over: boolean;
}

export const onTrack = (s: TiltState, x: number, y: number) => onTrackOf(s.h, x, y);
export const heightAt = (s: TiltState, x: number, y: number) => heightOf(s.h, x, y);

function genTrack(s: TiltState, rng: Rng): void {
  const track = makeTrack(rng, s.level, false, 12);
  s.path = track.path;
  s.h = track.h;
  s.progress = 0;
  s.time = Math.round(s.path.length * 0.62 + 14);
  s.steelies = [];
  s.spawnTimer = 8;
  placeAtCheckpoint(s);
}

function placeAtCheckpoint(s: TiltState): void {
  const c = s.path[Math.floor(s.progress / CHECK_EVERY) * CHECK_EVERY]!;
  s.marble = { x: c.x + 0.5, y: c.y + 0.5, vx: 0, vy: 0, fall: 0 };
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): TiltState {
  const s: TiltState = {
    h: [],
    path: [],
    marble: { x: 3.5, y: 3.5, vx: 0, vy: 0, fall: 0 },
    progress: 0,
    steelies: [],
    spawnTimer: 8,
    sparks: [],
    time: 0,
    levelDelay: 0,
    score: 0,
    hi: hiScore,
    level: 1,
    over: false,
  };
  genTrack(s, rng);
  return s;
}

/** One physics step for a ball: slope gravity, a push (grid units), drag, and falling off the edge. */
function roll(s: TiltState, b: Ball, ax: number, ay: number, dt: number): void {
  if (b.fall > 0) {
    b.fall += dt;
    return;
  }
  const e = 0.25;
  const gx = (heightAt(s, b.x + e, b.y) - heightAt(s, b.x - e, b.y)) / (2 * e);
  const gy = (heightAt(s, b.x, b.y + e) - heightAt(s, b.x, b.y - e)) / (2 * e);
  b.vx += (ax - GRAVITY * gx) * dt;
  b.vy += (ay - GRAVITY * gy) * dt;
  const drag = Math.max(0, 1 - DRAG * dt);
  b.vx *= drag;
  b.vy *= drag;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > MAX_SPEED) {
    b.vx *= MAX_SPEED / sp;
    b.vy *= MAX_SPEED / sp;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (!onTrack(s, b.x, b.y)) b.fall = 0.001;
}

function nearestIndex(s: TiltState, x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < s.path.length; i++) {
    const d = Math.hypot(s.path[i]!.x + 0.5 - x, s.path[i]!.y + 0.5 - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function update(s: TiltState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  stepSparks(s.sparks, dt);
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      genTrack(s, rng);
      emit('wave');
    }
    return;
  }

  s.time -= dt;
  if (s.time <= 0) {
    s.time = 0;
    s.over = true;
    emit('die');
    return;
  }

  const m = s.marble;
  // Screen directions in the isometric view: up = (-1,-1), right = (+1,-1), down = (+1,+1), left = (-1,+1).
  const sx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  const sy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
  const ax = (sx + sy) * 0.7071 * PUSH;
  const ay = (sy - sx) * 0.7071 * PUSH;
  roll(s, m, ax, ay, dt);

  if (m.fall > 0) {
    if (m.fall >= 0.9) {
      // Back to the last checkpoint, at the cost of some time.
      s.time -= PENALTY;
      placeAtCheckpoint(s);
      emit('pickup');
      if (s.time <= 0) {
        s.time = 0;
        s.over = true;
        emit('die');
        return;
      }
    }
  } else {
    const idx = nearestIndex(s, m.x, m.y);
    if (idx > s.progress) {
      s.score += (idx - s.progress) * 10;
      s.progress = idx;
    }
    if (idx >= s.path.length - 2) {
      s.score += Math.floor(s.time) * 100;
      s.levelDelay = 1.8;
      emit('wave');
    }
  }

  // Steel marbles roll in ahead and chase.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && m.fall === 0) {
    s.spawnTimer = Math.max(6, 11 - s.level);
    if (s.steelies.length < 1 + Math.floor(s.level / 2) && s.progress + 14 < s.path.length) {
      const c = s.path[s.progress + 14]!;
      s.steelies.push({ x: c.x + 0.5, y: c.y + 0.5, vx: 0, vy: 0, fall: 0 });
    }
  }
  for (let i = s.steelies.length - 1; i >= 0; i--) {
    const e = s.steelies[i]!;
    const dx = m.x - e.x;
    const dy = m.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    roll(s, e, (dx / d) * 4.5, (dy / d) * 4.5, dt);
    if (e.fall > 0.8) {
      if (d < 4) s.score += 500;
      s.steelies.splice(i, 1);
      emit('explode');
      continue;
    }
    if (m.fall === 0 && e.fall === 0 && d < 0.65) {
      // A shove along the line between them: the player away from the steelie, the steelie back.
      m.vx += (dx / d) * 7;
      m.vy += (dy / d) * 7;
      e.vx -= (dx / d) * 3;
      e.vy -= (dy / d) * 3;
      emit('pickup');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

// ---- isometric rendering --------------------------------------------------------------

function ball(g: CanvasRenderingContext2D, s: TiltState, b: Ball, ox: number, oy: number, color: string): void {
  const z = (heightAt(s, b.x, b.y) <= VOID / 2 ? heightAt(s, Math.min(Math.max(b.x, 0.5), N - 0.5), Math.min(Math.max(b.y, 0.5), N - 0.5)) : heightAt(s, b.x, b.y)) - b.fall * b.fall * 6;
  const sx = ox + isoX(b.x, b.y);
  const sy = oy + isoY(b.x, b.y, Math.max(z, -20) + 0.45);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(sx, sy + 8, 9, 4, 0, 0, TAU);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(sx, sy, 9, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(sx - 4, sy - 5, 3, 3);
}

function render(s: TiltState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const m = s.marble;
  const mz = Math.max(heightAt(s, Math.min(Math.max(m.x, 0.5), N - 0.5), Math.min(Math.max(m.y, 0.5), N - 0.5)), 0);
  const ox = W / 2 - isoX(m.x, m.y);
  const oy = H / 2 + 40 - isoY(m.x, m.y, mz);
  const x0 = Math.max(0, Math.floor(m.x) - 11);
  const x1 = Math.min(N - 1, Math.floor(m.x) + 11);
  const y0 = Math.max(0, Math.floor(m.y) - 11);
  const y1 = Math.min(N - 1, Math.floor(m.y) + 11);
  const last = s.path.length - 1;
  const items: { sum: number; draw: () => void }[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const h = s.h[ty * N + tx]!;
      if (h <= VOID / 2) continue;
      items.push({
        sum: tx + ty,
        draw: () => {
          const cx = ox + isoX(tx + 0.5, ty + 0.5);
          const cy = oy + isoY(tx + 0.5, ty + 0.5, h);
          const isFinish = s.path[last]!.x === tx && s.path[last]!.y === ty;
          const shade = Math.floor(70 + h * 7);
          // Sides, so height reads.
          g.fillStyle = '#2a1f55';
          g.beginPath();
          g.moveTo(cx - TW / 2, cy);
          g.lineTo(cx, cy + TH / 2);
          g.lineTo(cx, cy + TH / 2 + 18);
          g.lineTo(cx - TW / 2, cy + 18);
          g.fill();
          g.fillStyle = '#3a2f6b';
          g.beginPath();
          g.moveTo(cx + TW / 2, cy);
          g.lineTo(cx, cy + TH / 2);
          g.lineTo(cx, cy + TH / 2 + 18);
          g.lineTo(cx + TW / 2, cy + 18);
          g.fill();
          diamond(g, cx, cy, isFinish ? (Math.floor(time * 4) % 2 ? COLORS.gold : COLORS.paper) : `rgb(${shade + 60},${shade + 40},${Math.min(255, shade + 150)})`);
          if ((tx + ty) % 2 === 0 && !isFinish) diamond(g, cx, cy, 'rgba(255,255,255,0.07)');
        },
      });
    }
  }
  items.sort((a, b) => a.sum - b.sum);
  for (const it of items) it.draw();
  for (const e of s.steelies) ball(g, s, e, ox, oy, '#2b2b3a');
  ball(g, s, m, ox, oy, COLORS.cyan);
  drawSparks(g, s.sparks);
  // Progress bar.
  g.fillStyle = COLORS.muted;
  g.fillRect(W / 2 - 120, 40, 240, 8);
  g.fillStyle = COLORS.gold;
  g.fillRect(W / 2 - 120, 40, (240 * s.progress) / Math.max(1, s.path.length - 1), 8);
  hud(g, s, `RACE ${s.level}  TIME ${Math.ceil(s.time)}`);
  if (s.levelDelay > 0) banner(g, 'FINISH!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<TiltState> = {
  id: 'tilt-track',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, s.level),
};
export default game;
