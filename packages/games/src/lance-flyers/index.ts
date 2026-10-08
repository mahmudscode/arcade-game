import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, W, type Spark } from '../_shared';

const GRAVITY = 520;
const FLAP = 185;
const MAX_FALL = 380;
const HW = 12;
const BODY_H = 28;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const MAX_WAVE = 30;
const EGG_HATCH = 7;
const TIER_POINTS = [500, 750, 1000];
const TIER_COLORS = [COLORS.coral, COLORS.purple, COLORS.gold];
const TIER_SPEED = [105, 145, 185];

const PLATFORMS = [
  { x: 0, y: 510, w: W, h: 60 },
  { x: 280, y: 395, w: 240, h: 16 },
  { x: 40, y: 315, w: 200, h: 16 },
  { x: 560, y: 315, w: 200, h: 16 },
  { x: 300, y: 225, w: 200, h: 16 },
  { x: 0, y: 140, w: 140, h: 16 },
  { x: 660, y: 140, w: 140, h: 16 },
];
const SPAWNS = [{ x: 120, y: 315 }, { x: 680, y: 315 }, { x: 400, y: 225 }, { x: 70, y: 140 }, { x: 730, y: 140 }];

interface Body {
  x: number;
  /** Feet position. */
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
}

interface Knight extends Body {
  tier: number;
  dir: 1 | -1;
  think: number;
  delay: number;
}

interface Egg extends Body {
  tier: number;
  age: number;
}

export interface JoustState {
  player: Body & { alive: boolean; dir: 1 | -1; invuln: number };
  knights: Knight[];
  eggs: Egg[];
  toSpawn: number;
  spawnCd: number;
  eggChain: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  respawn: number;
  waveDelay: number;
  nextLife: number;
}

/** Shared physics: gravity, platform landing, head bumps, side pushes, horizontal wrap. */
function step(b: Body, hw: number, h: number, dt: number): void {
  const prevFeet = b.y;
  b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.x < -hw) b.x += W + hw * 2;
  if (b.x > W + hw) b.x -= W + hw * 2;
  b.ground = false;
  for (const p of PLATFORMS) {
    if (b.x + hw <= p.x || b.x - hw >= p.x + p.w) continue;
    if (b.vy >= 0 && prevFeet <= p.y + 1 && b.y >= p.y) {
      b.y = p.y;
      b.vy = 0;
      b.ground = true;
    } else if (b.vy < 0 && b.y - h < p.y + p.h && prevFeet - h >= p.y + p.h - 1) {
      b.y = p.y + p.h + h;
      b.vy = 40;
    } else if (b.y > p.y + 3 && b.y - h < p.y + p.h - 3) {
      // Hit the side of a platform: shove out and bounce.
      b.x += b.x < p.x + p.w / 2 ? -(b.x + hw - p.x) : p.x + p.w - (b.x - hw);
      b.vx *= -0.4;
    }
  }
}

function spawnKnight(s: JoustState, tier: number, x?: number, y?: number, delay = 0): void {
  const sp = SPAWNS[s.knights.length % SPAWNS.length]!;
  s.knights.push({ x: x ?? sp.x, y: y ?? sp.y, vx: 0, vy: 0, ground: false, tier, dir: 1, think: 0.3, delay });
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): JoustState {
  void rng;
  return {
    player: { x: W / 2, y: 510, vx: 0, vy: 0, ground: true, alive: true, dir: 1, invuln: 1.5 },
    knights: [],
    eggs: [],
    toSpawn: 4,
    spawnCd: 0.5,
    eggChain: 0,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    respawn: 0,
    waveDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
}

function killPlayer(s: JoustState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = s.player;
  if (!p.alive || p.invuln > 0) return;
  burst(s.sparks, rng, p.x, p.y - 14, COLORS.cyan, 24);
  emit('die');
  p.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  if (s.lives <= 0) s.over = true;
}

function update(s: JoustState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  const p = s.player;
  p.invuln = Math.max(0, p.invuln - dt);

  if (p.alive) {
    const accel = p.ground ? 700 : 380;
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    if (dx !== 0) {
      p.vx += dx * accel * dt;
      p.dir = dx > 0 ? 1 : -1;
    } else if (p.ground) {
      p.vx *= Math.max(0, 1 - 6 * dt);
    }
    p.vx = Math.max(-230, Math.min(230, p.vx));
    if (input.pressed.a || input.pressed.up) {
      p.vy = Math.max(-260, p.vy - FLAP);
      p.ground = false;
      emit('fire');
    }
    step(p, HW, BODY_H, dt);
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(p, { x: W / 2, y: 510, vx: 0, vy: 0, ground: true, alive: true, invuln: 2 });
    }
  }

  // Spawn the wave's knights one at a time.
  s.spawnCd -= dt;
  if (s.toSpawn > 0 && s.spawnCd <= 0) {
    s.spawnCd = 1.1;
    s.toSpawn -= 1;
    const tier = Math.min(2, Math.floor((s.wave - 1) / 3) + (s.wave > 1 && s.toSpawn % 4 === 0 ? 1 : 0));
    spawnKnight(s, Math.min(2, tier));
  }

  // Knights flap toward the player's height and sweep sideways.
  for (const k of s.knights) {
    k.think -= dt;
    if (k.think <= 0) {
      k.think = rng.range(0.25, 0.6);
      const target = p.alive ? p.y - (k.tier >= 1 ? 40 : -20 + rng.range(-80, 80)) : 200;
      if (k.y > target && rng.next() < 0.75) {
        k.vy = Math.max(-240, k.vy - FLAP);
        k.ground = false;
      }
      if (rng.next() < 0.7) k.dir = p.alive && p.x < k.x ? -1 : 1;
      else k.dir = rng.pick<1 | -1>([-1, 1]);
    }
    k.vx += k.dir * 240 * dt;
    const max = TIER_SPEED[k.tier]! + Math.min(s.wave, MAX_WAVE) * 2;
    k.vx = Math.max(-max, Math.min(max, k.vx));
    step(k, HW, BODY_H, dt);
  }

  // Jousting: whoever is higher wins; level hits bounce.
  for (let i = s.knights.length - 1; i >= 0; i--) {
    const k = s.knights[i]!;
    if (!p.alive || Math.abs(k.x - p.x) > 22 || Math.abs(k.y - p.y) > 24) continue;
    if (p.y < k.y - 6) {
      s.score += TIER_POINTS[k.tier]!;
      burst(s.sparks, rng, k.x, k.y - 14, TIER_COLORS[k.tier]!, 14);
      emit('explode');
      s.eggs.push({ x: k.x, y: k.y, vx: k.vx * 0.5, vy: -120, ground: false, tier: k.tier, age: 0 });
      s.knights.splice(i, 1);
    } else if (k.y < p.y - 6) {
      killPlayer(s, rng, emit);
    } else {
      const push = p.x < k.x ? -1 : 1;
      p.vx = push * 160;
      k.vx = -push * 160;
    }
  }

  // Eggs: collect them before they hatch into tougher knights.
  for (let i = s.eggs.length - 1; i >= 0; i--) {
    const e = s.eggs[i]!;
    e.age += dt;
    step(e, 6, 10, dt);
    if (e.ground) e.vx *= Math.max(0, 1 - 4 * dt);
    if (p.alive && Math.abs(e.x - p.x) < 20 && Math.abs(e.y - p.y) < 26) {
      s.eggChain += 1;
      s.score += 250 * Math.min(s.eggChain, 4);
      emit('pickup');
      s.eggs.splice(i, 1);
    } else if (e.age > EGG_HATCH) {
      spawnKnight(s, Math.min(2, e.tier + 1), e.x, e.y);
      s.eggs.splice(i, 1);
    }
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (!s.over && s.toSpawn === 0 && s.knights.length === 0 && s.eggs.length === 0) {
    if (s.waveDelay <= 0) s.waveDelay = 1.6;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave += 1;
      s.toSpawn = Math.min(3 + s.wave, 10);
      s.eggChain = 0;
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function drawRider(g: CanvasRenderingContext2D, x: number, y: number, dir: number, color: string, mount: string, flap: boolean): void {
  g.fillStyle = mount;
  g.beginPath();
  g.ellipse(x, y - 10, 13, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x + dir * 12 - 3, y - 20, 7, 6);
  g.fillRect(x - 12, y - 16 + (flap ? -5 : 3), 24, 4);
  g.fillStyle = COLORS.paper;
  g.fillRect(x - 3, y - 26, 7, 12);
  g.fillStyle = color;
  g.fillRect(x - 4, y - 32, 9, 7);
  g.fillRect(x + dir * 6, y - 26, dir * 14, 2);
  g.fillStyle = mount;
  g.fillRect(x - 6, y - 2, 3, 3);
  g.fillRect(x + 3, y - 2, 3, 3);
}

function render(s: JoustState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = '#ff5d73';
  g.globalAlpha = 0.35 + 0.15 * Math.sin(time * 3);
  g.fillRect(0, 548, W, 22);
  g.globalAlpha = 1;
  g.fillStyle = '#3b2a7a';
  for (const p of PLATFORMS) {
    g.fillRect(p.x, p.y, p.w, p.h);
  }
  g.fillStyle = COLORS.purple;
  for (const p of PLATFORMS) g.fillRect(p.x, p.y, p.w, 4);

  for (const e of s.eggs) {
    g.fillStyle = e.age > EGG_HATCH - 2 && Math.floor(time * 10) % 2 === 0 ? COLORS.coral : COLORS.paper;
    g.beginPath();
    g.ellipse(e.x, e.y - 6, 6, 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  const flap = Math.floor(time * 8) % 2 === 0;
  for (const k of s.knights) drawRider(g, k.x, k.y, k.dir, TIER_COLORS[k.tier]!, k.tier === 0 ? '#8a6fd0' : k.tier === 1 ? '#6a8fd0' : '#d0a24a', flap && !k.ground);
  if (s.player.alive && (s.player.invuln <= 0 || Math.floor(time * 12) % 2 === 0)) {
    drawRider(g, s.player.x, s.player.y, s.player.dir, COLORS.cyan, COLORS.gold, flap && !s.player.ground);
  }
  drawSparks(g, s.sparks);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `WAVE ${s.wave}`, s.lives);
  gameOver(g, s.over);
}

const lanceFlyers: GameDefinition<JoustState> = {
  id: 'lance-flyers',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};

export default lanceFlyers;
