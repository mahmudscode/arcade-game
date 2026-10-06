import type { GameDefinition, GameStatus, Input, Rng, UpdateContext } from '@arcade/engine';

const W = 800;
const H = 570;
const COLORS = { bg: '#120a2a', paper: '#F6EFFF', gold: '#FFC93C', coral: '#FF5D73', cyan: '#4FE3D6', purple: '#A78BFA', muted: '#B7A9DB' };
const START_LIVES = 3;
const GRAVITY = 38;
const THRUST = 95;
const TURN = 2.4;
const MAX_LEVEL = 20;
const SAFE_SPEED = 32;
const SAFE_ANGLE = 0.22;
const STEP = 20;

interface Pad { x0: number; x1: number; mult: number }

export interface LanderState {
  /** Terrain height (y) sampled every STEP px. */
  terrain: number[];
  pads: Pad[];
  lander: { x: number; y: number; vx: number; vy: number; angle: number; fuel: number; thrusting: boolean };
  /** 'fly' | 'landed' | 'crashed' */
  phase: 'fly' | 'landed' | 'crashed';
  phaseTimer: number;
  message: string;
  stars: { x: number; y: number }[];
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

function buildTerrain(rng: Rng, level: number): { terrain: number[]; pads: Pad[] } {
  const n = W / STEP + 1;
  const terrain: number[] = [];
  let y = rng.range(H - 160, H - 80);
  for (let i = 0; i < n; i++) {
    y = Math.min(H - 40, Math.max(H - 260, y + rng.range(-34, 34)));
    terrain.push(y);
  }
  const pads: Pad[] = [];
  const width = Math.max(2, 5 - Math.floor(level / 5));
  for (const mult of [1, 2, 5]) {
    for (let tries = 0; tries < 20; tries++) {
      const start = rng.int(1, n - width - 2);
      if (pads.some((p) => start * STEP < p.x1 + STEP * 2 && (start + width) * STEP > p.x0 - STEP * 2)) continue;
      for (let k = 0; k <= width; k++) terrain[start + k] = terrain[start]!;
      pads.push({ x0: start * STEP, x1: (start + width) * STEP, mult });
      break;
    }
  }
  return { terrain, pads };
}

function resetLander(s: LanderState, rng: Rng): void {
  s.lander = { x: rng.range(60, 200), y: 70, vx: rng.range(10, 30), vy: 0, angle: 0, fuel: Math.max(300, 700 - s.level * 20), thrusting: false };
  s.phase = 'fly';
  s.phaseTimer = 0;
  s.message = '';
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): LanderState {
  const s: LanderState = {
    terrain: [],
    pads: [],
    lander: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, fuel: 0, thrusting: false },
    phase: 'fly',
    phaseTimer: 0,
    message: '',
    stars: Array.from({ length: 70 }, () => ({ x: rng.range(0, W), y: rng.range(0, H - 100) })),
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  Object.assign(s, buildTerrain(rng, 1));
  resetLander(s, rng);
  return s;
}

const groundAt = (s: LanderState, x: number): number => {
  const f = Math.min(s.terrain.length - 1.001, Math.max(0, x / STEP));
  const i = Math.floor(f);
  return s.terrain[i]! + (s.terrain[i + 1]! - s.terrain[i]!) * (f - i);
};

function update(s: LanderState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;

  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

  const l = s.lander;
  if (s.phase !== 'fly') {
    s.phaseTimer -= dt;
    if (s.phaseTimer <= 0) {
      if (s.phase === 'landed') {
        s.level = Math.min(s.level + 1, MAX_LEVEL);
        Object.assign(s, buildTerrain(rng, s.level));
        emit('wave');
      } else if (s.lives <= 0) {
        s.over = true;
        return;
      }
      resetLander(s, rng);
    }
    return;
  }

  if (input.held.left) l.angle -= TURN * dt;
  if (input.held.right) l.angle += TURN * dt;
  l.angle = Math.max(-1.4, Math.min(1.4, l.angle));
  l.thrusting = (input.held.up || input.held.a) && l.fuel > 0;
  if (l.thrusting) {
    l.vx += Math.sin(l.angle) * THRUST * dt;
    l.vy -= Math.cos(l.angle) * THRUST * dt;
    l.fuel = Math.max(0, l.fuel - 60 * dt);
  }
  l.vy += GRAVITY * dt;
  l.x += l.vx * dt;
  l.y += l.vy * dt;

  if (l.x < 0 || l.x > W) l.x = (l.x + W) % W;

  if (l.y + 14 >= groundAt(s, l.x)) {
    const pad = s.pads.find((p) => l.x >= p.x0 && l.x <= p.x1);
    const speed = Math.hypot(l.vx, l.vy);
    if (pad && speed < SAFE_SPEED && Math.abs(l.angle) < SAFE_ANGLE) {
      s.phase = 'landed';
      const pts = pad.mult * 50 + Math.floor(l.fuel / 10);
      s.score += pts;
      s.message = `LANDED +${pts}`;
      s.phaseTimer = 1.8;
      l.vx = 0;
      l.vy = 0;
      emit('pickup');
    } else {
      s.phase = 'crashed';
      s.lives -= 1;
      s.message = 'CRASHED';
      s.phaseTimer = 1.8;
      l.thrusting = false;
      emit('die');
    }
    l.y = groundAt(s, l.x) - 14;
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: LanderState, g: CanvasRenderingContext2D): void {
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = COLORS.paper;
  g.globalAlpha = 0.5;
  for (const st of s.stars) g.fillRect(st.x, st.y, 2, 2);
  g.globalAlpha = 1;

  g.fillStyle = COLORS.purple;
  g.beginPath();
  g.moveTo(0, H);
  s.terrain.forEach((y, i) => g.lineTo(i * STEP, y));
  g.lineTo(W, H);
  g.closePath();
  g.fill();

  for (const p of s.pads) {
    g.fillStyle = COLORS.gold;
    g.fillRect(p.x0, groundAt(s, p.x0) - 3, p.x1 - p.x0, 5);
    g.font = '12px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(`x${p.mult}`, (p.x0 + p.x1) / 2, groundAt(s, p.x0) + 8);
  }

  const l = s.lander;
  if (s.phase !== 'crashed') {
    g.save();
    g.translate(l.x, l.y);
    g.rotate(l.angle);
    if (l.thrusting) {
      g.fillStyle = COLORS.coral;
      g.beginPath();
      g.moveTo(-5, 10);
      g.lineTo(0, 24);
      g.lineTo(5, 10);
      g.fill();
    }
    g.fillStyle = COLORS.cyan;
    g.fillRect(-9, -10, 18, 16);
    g.fillStyle = COLORS.paper;
    g.fillRect(-4, -6, 8, 6);
    g.strokeStyle = COLORS.cyan;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-8, 6);
    g.lineTo(-14, 14);
    g.moveTo(8, 6);
    g.lineTo(14, 14);
    g.stroke();
    g.restore();
  } else {
    g.fillStyle = COLORS.coral;
    g.fillRect(l.x - 14, l.y + 2, 28, 6);
  }

  g.font = '14px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.fillStyle = COLORS.paper;
  g.fillText(`1UP  ${String(Math.min(s.score, 999999)).padStart(6, '0')}`, 22, 14);
  g.fillStyle = COLORS.muted;
  g.fillText(`FUEL ${Math.floor(l.fuel)}`, 22, 40);
  g.fillText(`SPD ${Math.hypot(l.vx, l.vy).toFixed(0)}`, 22, 62);
  g.textAlign = 'right';
  g.fillStyle = COLORS.gold;
  g.fillText(`HI ${String(Math.min(Math.max(s.hi, s.score), 999999)).padStart(6, '0')}`, W - 22, 14);
  g.fillStyle = COLORS.cyan;
  g.fillText(`LIVES ${Math.max(0, s.lives)}`, W - 22, 40);

  if (s.message) {
    g.textAlign = 'center';
    g.fillStyle = s.phase === 'landed' ? COLORS.cyan : COLORS.coral;
    g.font = '24px "Press Start 2P", monospace';
    g.fillText(s.message, W / 2, 140);
  }
  if (s.over) {
    g.fillStyle = 'rgba(18,10,42,0.72)';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.fillStyle = COLORS.coral;
    g.font = '32px "Press Start 2P", monospace';
    g.fillText('GAME OVER', W / 2, H / 2 - 40);
    g.fillStyle = COLORS.paper;
    g.font = '13px "Press Start 2P", monospace';
    g.fillText('PRESS SPACE TO PLAY AGAIN', W / 2, H / 2 + 20);
  }
}

function status(s: LanderState): GameStatus {
  return { score: s.score, hiScore: Math.max(s.hi, s.score), lives: Math.max(0, s.lives), level: s.level, over: s.over };
}

const lunarDescent: GameDefinition<LanderState> = { id: 'lunar-descent', size: { width: W, height: H }, init, update, render, status };
export default lunarDescent;
