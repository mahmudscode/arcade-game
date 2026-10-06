import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const ROAD_L = 200;
const ROAD_R = 600;
const CAR_W = 34;
const CAR_H = 56;
const PLAYER_Y = H - 110;
const START_LIVES = 3;
const GOAL = 5000;
const MAX_SPEED = 360;

interface Obj { x: number; y: number; kind: 'car' | 'oil' | 'fuel'; vy: number }

export interface HighwayState {
  x: number;
  speed: number;
  fuel: number;
  dist: number;
  objs: Obj[];
  spawnTimer: number;
  skid: number;
  crash: number;
  sparks: Spark[];
  levelDelay: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

function init({ hiScore }: { rng: Rng; hiScore: number }): HighwayState {
  return { x: 400, speed: 0, fuel: 100, dist: 0, objs: [], spawnTimer: 1, skid: 0, crash: 0, sparks: [], levelDelay: 0, score: 0, hi: hiScore, lives: START_LIVES, level: 1, over: false };
}

function update(s: HighwayState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  stepSparks(s.sparks, dt);

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      s.dist = 0;
      s.fuel = 100;
      s.objs = [];
      emit('wave');
    }
    return;
  }

  s.crash = Math.max(0, s.crash - dt);
  s.skid = Math.max(0, s.skid - dt);
  const accel = input.held.a || input.held.up;
  if (s.crash <= 0) s.speed += (accel ? 160 : -60) * dt;
  if (input.held.down || input.held.b) s.speed -= 240 * dt;
  s.speed = Math.min(MAX_SPEED, Math.max(0, s.speed));

  const steer = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  s.x += steer * (s.skid > 0 ? 80 : 240) * dt * (0.4 + s.speed / MAX_SPEED);
  if (s.skid > 0) s.x += Math.sin(s.skid * 18) * 60 * dt;
  if (s.x < ROAD_L + CAR_W / 2 || s.x > ROAD_R - CAR_W / 2) {
    // Verges are slow and rough.
    s.x = Math.min(ROAD_R - CAR_W / 2, Math.max(ROAD_L + CAR_W / 2, s.x));
    s.speed = Math.min(s.speed, 90);
  }

  s.dist += s.speed * dt;
  s.score += Math.floor(s.speed * dt * 0.2);
  s.fuel -= (3.2 + s.speed / 150) * dt;
  if (s.fuel <= 0) {
    s.fuel = 0;
    crash(s, rng, emit);
  }

  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.speed > 0) {
    s.spawnTimer = Math.max(0.35, 1.2 - s.level * 0.07) * rng.range(0.6, 1.2);
    const roll = rng.next();
    const kind = roll < 0.12 ? 'fuel' : roll < 0.3 ? 'oil' : 'car';
    s.objs.push({ x: rng.range(ROAD_L + 30, ROAD_R - 30), y: -60, kind, vy: kind === 'car' ? rng.range(60, 140) : 0 });
  }

  for (let i = s.objs.length - 1; i >= 0; i--) {
    const o = s.objs[i]!;
    o.y += (s.speed - o.vy) * dt;
    if (o.y > H + 80 || o.y < -400) {
      s.objs.splice(i, 1);
      continue;
    }
    if (Math.abs(o.x - s.x) < CAR_W && Math.abs(o.y - PLAYER_Y) < CAR_H * 0.8) {
      if (o.kind === 'fuel') {
        s.fuel = Math.min(100, s.fuel + 30);
        s.score += 100;
        emit('pickup');
        s.objs.splice(i, 1);
      } else if (o.kind === 'oil') {
        if (s.skid <= 0) emit('fire');
        s.skid = 1;
      } else if (s.crash <= 0) {
        crash(s, rng, emit);
        s.objs.splice(i, 1);
      }
    }
  }

  if (s.dist >= GOAL * (1 + (s.level - 1) * 0.15) && !s.over) {
    s.score += 1000 + Math.floor(s.fuel) * 10;
    s.levelDelay = 1.5;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function crash(s: HighwayState, rng: Rng, emit: UpdateContext['emit']): void {
  s.lives -= 1;
  s.crash = 1.2;
  s.speed = 0;
  s.fuel = Math.max(s.fuel, 40);
  burst(s.sparks, rng, s.x, PLAYER_Y, COLORS.coral, 24);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function render(s: HighwayState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.fillStyle = '#16301f';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#2d2650';
  g.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
  g.fillStyle = COLORS.paper;
  g.fillRect(ROAD_L - 6, 0, 6, H);
  g.fillRect(ROAD_R, 0, 6, H);
  const off = s.dist % 80;
  for (let y = -80 + off; y < H; y += 80) g.fillRect(W / 2 - 3, y, 6, 40);

  for (const o of s.objs) {
    if (o.kind === 'car') {
      g.fillStyle = COLORS.coral;
      g.fillRect(o.x - CAR_W / 2, o.y - CAR_H / 2, CAR_W, CAR_H);
      g.fillStyle = COLORS.bg;
      g.fillRect(o.x - CAR_W / 2 + 4, o.y - CAR_H / 2 + 8, CAR_W - 8, 14);
    } else if (o.kind === 'oil') {
      g.fillStyle = '#05030f';
      g.beginPath();
      g.ellipse(o.x, o.y, 26, 14, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = COLORS.gold;
      g.fillRect(o.x - 12, o.y - 14, 24, 28);
      g.fillStyle = COLORS.bg;
      g.font = '12px "Press Start 2P", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('F', o.x, o.y);
    }
  }
  if (s.crash <= 0 || Math.floor(s.crash * 12) % 2 === 0) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(s.x - CAR_W / 2, PLAYER_Y - CAR_H / 2, CAR_W, CAR_H);
    g.fillStyle = COLORS.paper;
    g.fillRect(s.x - CAR_W / 2 + 4, PLAYER_Y - CAR_H / 2 + 8, CAR_W - 8, 14);
  }
  drawSparks(g, s.sparks);

  g.fillStyle = COLORS.muted;
  g.fillRect(W - 60, 60, 20, 300);
  g.fillStyle = s.fuel < 25 ? COLORS.coral : COLORS.gold;
  g.fillRect(W - 60, 360 - s.fuel * 3, 20, s.fuel * 3);
  g.fillStyle = COLORS.cyan;
  g.fillRect(40, 360 - (s.dist / (GOAL * (1 + (s.level - 1) * 0.15))) * 300, 14, 4);
  hud(g, s, `LEVEL ${s.level}   SPEED ${Math.round(s.speed)}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'GOAL!', 200);
  gameOver(g, s.over);
}

const game: GameDefinition<HighwayState> = {
  id: 'highway-hero',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
