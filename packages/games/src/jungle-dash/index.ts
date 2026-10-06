import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const GROUND = H - 150;
const PLAYER_X = 160;
const GRAVITY = 2200;
const JUMP = 800;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 5000;

type Kind = 'log' | 'pit' | 'scorpion' | 'gem';
interface Thing { x: number; kind: Kind; w: number }

export interface JungleState {
  y: number;
  vy: number;
  things: Thing[];
  dist: number;
  nextSpawn: number;
  hurt: number;
  sparks: Spark[];
  time: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  nextLife: number;
}

function init({ hiScore }: { rng: Rng; hiScore: number }): JungleState {
  return { y: 0, vy: 0, things: [], dist: 0, nextSpawn: 600, hurt: 0, sparks: [], time: 0, score: 0, hi: hiScore, lives: START_LIVES, level: 1, over: false, nextLife: EXTRA_LIFE_EVERY };
}

const speedOf = (level: number) => 280 + level * 28;

function update(s: JungleState, input: Input, dt: number, ctx: UpdateContext): void {
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
  s.time += dt;
  s.level = 1 + Math.floor(s.dist / 4000);
  const speed = speedOf(s.level);
  s.dist += speed * dt;
  s.score += Math.floor(speed * dt * 0.05);
  s.hurt = Math.max(0, s.hurt - dt);

  const onGround = s.y <= 0 && s.vy <= 0;
  if ((input.pressed.a || input.pressed.up) && onGround) {
    s.vy = JUMP;
    emit('fire');
  }
  s.vy -= GRAVITY * dt;
  s.y += s.vy * dt;
  if (s.y < 0) {
    s.y = 0;
    s.vy = 0;
  }

  if (s.dist >= s.nextSpawn) {
    const kind = rng.pick<Kind>(['log', 'log', 'pit', 'scorpion', 'gem']);
    const w = kind === 'pit' ? rng.range(90, 150) : kind === 'log' ? 44 : 36;
    s.things.push({ x: W + 60, kind, w });
    s.nextSpawn = s.dist + rng.range(420, 760) * (kind === 'pit' ? 1.15 : 1);
  }

  for (let i = s.things.length - 1; i >= 0; i--) {
    const t = s.things[i]!;
    t.x -= speed * dt;
    if (t.x + t.w < -20) {
      s.things.splice(i, 1);
      continue;
    }
    const overlap = PLAYER_X + 14 > t.x && PLAYER_X - 14 < t.x + t.w;
    if (!overlap) continue;
    if (t.kind === 'gem') {
      if (s.y < 90) {
        s.score += 250;
        emit('pickup');
        s.things.splice(i, 1);
      }
    } else if (s.hurt <= 0) {
      const height = t.kind === 'pit' ? -1 : t.kind === 'log' ? 34 : 26;
      const hit = t.kind === 'pit' ? s.y <= 4 && PLAYER_X > t.x + 14 && PLAYER_X < t.x + t.w - 14 : s.y < height;
      if (hit) {
        s.lives -= 1;
        s.hurt = 1.5;
        s.vy = 0;
        burst(s.sparks, rng, PLAYER_X, GROUND - s.y - 20, COLORS.coral, 16);
        emit('die');
        if (s.lives <= 0) s.over = true;
        if (t.kind === 'pit') s.things.splice(i, 1);
      }
    }
  }
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: JungleState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = '#0f2a1d';
  g.fillRect(0, 0, W, GROUND);
  // Parallax trees.
  g.fillStyle = '#17412c';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 130 - s.dist * 0.2) % (W + 130) + W + 130) % (W + 130) - 40;
    g.fillRect(x, 60, 30, GROUND - 60);
    g.beginPath();
    g.arc(x + 15, 60, 55, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#3d5a2a';
  g.fillRect(0, GROUND, W, 20);
  g.fillStyle = '#2b1d4a';
  g.fillRect(0, GROUND + 20, W, H - GROUND - 20);

  for (const t of s.things) {
    if (t.kind === 'pit') {
      g.fillStyle = COLORS.bg;
      g.fillRect(t.x, GROUND, t.w, 20);
    } else if (t.kind === 'log') {
      g.fillStyle = '#8a5a2b';
      g.fillRect(t.x, GROUND - 30, t.w, 30);
    } else if (t.kind === 'scorpion') {
      g.fillStyle = COLORS.coral;
      g.fillRect(t.x, GROUND - 22, t.w, 22);
      g.fillRect(t.x + t.w - 8, GROUND - 38, 6, 18);
    } else {
      g.fillStyle = COLORS.gold;
      g.beginPath();
      g.moveTo(t.x + t.w / 2, GROUND - 130);
      g.lineTo(t.x + t.w, GROUND - 110);
      g.lineTo(t.x + t.w / 2, GROUND - 90);
      g.lineTo(t.x, GROUND - 110);
      g.fill();
    }
  }
  if (s.hurt <= 0 || Math.floor(time * 14) % 2 === 0) {
    const py = GROUND - s.y;
    g.fillStyle = COLORS.cyan;
    g.fillRect(PLAYER_X - 12, py - 46, 24, 30);
    g.fillStyle = COLORS.paper;
    g.fillRect(PLAYER_X - 9, py - 62, 18, 16);
    g.fillStyle = COLORS.cyan;
    const step = s.y > 0 ? 0 : Math.sin(s.dist * 0.05) * 8;
    g.fillRect(PLAYER_X - 10 + step, py - 16, 8, 16);
    g.fillRect(PLAYER_X + 2 - step, py - 16, 8, 16);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  gameOver(g, s.over);
}

const game: GameDefinition<JungleState> = {
  id: 'jungle-dash',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
