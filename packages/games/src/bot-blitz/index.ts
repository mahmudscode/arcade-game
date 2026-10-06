import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const LEFT = 20;
const RIGHT = W - 20;
const TOP = 44;
const BOTTOM = H - 40;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 25000;

interface Bot { x: number; y: number; kind: 'grunt' | 'hulk'; jitter: number }

export interface BlitzState {
  player: { x: number; y: number; dx: number; dy: number; cool: number; alive: boolean; invuln: number };
  bullets: { x: number; y: number; vx: number; vy: number }[];
  bots: Bot[];
  sparks: Spark[];
  respawn: number;
  waveDelay: number;
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  nextLife: number;
}

function spawnWave(s: BlitzState, rng: Rng): void {
  const grunts = 6 + s.wave * 4;
  const hulks = s.wave >= 3 ? Math.min(2 + Math.floor(s.wave / 2), 8) : 0;
  s.bots = [];
  const place = (kind: Bot['kind']) => {
    // Keep clear of the player's start so a wave never begins on top of them.
    for (let tries = 0; tries < 20; tries++) {
      const x = rng.range(LEFT + 20, RIGHT - 20);
      const y = rng.range(TOP + 20, BOTTOM - 20);
      if (Math.hypot(x - W / 2, y - H / 2) > 160) {
        s.bots.push({ x, y, kind, jitter: rng.range(0, 6.28) });
        return;
      }
    }
  };
  for (let i = 0; i < grunts; i++) place('grunt');
  for (let i = 0; i < hulks; i++) place('hulk');
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): BlitzState {
  const s: BlitzState = {
    player: { x: W / 2, y: H / 2, dx: 0, dy: -1, cool: 0, alive: true, invuln: 1.5 },
    bullets: [],
    bots: [],
    sparks: [],
    respawn: 0,
    waveDelay: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    nextLife: EXTRA_LIFE_EVERY,
  };
  spawnWave(s, rng);
  return s;
}

function update(s: BlitzState, input: Input, dt: number, ctx: UpdateContext): void {
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
  if (p.alive) {
    const mx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const my = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      p.dx = mx / len;
      p.dy = my / len;
      p.x += p.dx * 230 * dt;
      p.y += p.dy * 230 * dt;
    }
    p.x = Math.min(RIGHT, Math.max(LEFT, p.x));
    p.y = Math.min(BOTTOM, Math.max(TOP, p.y));
    p.cool -= dt;
    p.invuln = Math.max(0, p.invuln - dt);
    // Fire in the direction you last moved; hold A to keep shooting.
    if (input.held.a && p.cool <= 0) {
      p.cool = 0.12;
      s.bullets.push({ x: p.x, y: p.y, vx: p.dx * 560, vy: p.dy * 560 });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.player = { x: W / 2, y: H / 2, dx: 0, dy: -1, cool: 0, alive: true, invuln: 2 };
      s.bots = s.bots.filter((b) => Math.hypot(b.x - W / 2, b.y - H / 2) > 140);
    }
  }

  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let remove = b.x < LEFT || b.x > RIGHT || b.y < TOP || b.y > BOTTOM;
    for (let k = s.bots.length - 1; k >= 0 && !remove; k--) {
      const bot = s.bots[k]!;
      if (Math.hypot(bot.x - b.x, bot.y - b.y) < (bot.kind === 'hulk' ? 18 : 12)) {
        remove = true;
        if (bot.kind === 'grunt') {
          s.score += 100;
          burst(s.sparks, rng, bot.x, bot.y, COLORS.coral, 10);
          s.bots.splice(k, 1);
          emit('explode');
        }
      }
    }
    if (remove) s.bullets.splice(i, 1);
  }

  const speedBase = 52 + s.wave * 6;
  for (const bot of s.bots) {
    bot.jitter += dt * 3;
    const sp = bot.kind === 'grunt' ? speedBase : 38;
    const dx = p.x - bot.x;
    const dy = p.y - bot.y;
    const d = Math.hypot(dx, dy) || 1;
    // Grunts wobble so the swarm is not a single clump; hulks plod straight.
    const wob = bot.kind === 'grunt' ? Math.sin(bot.jitter) * 0.5 : 0;
    bot.x += (dx / d + -dy / d * wob) * sp * dt;
    bot.y += (dy / d + dx / d * wob) * sp * dt;
    if (p.alive && p.invuln <= 0 && Math.hypot(dx, dy) < 18) {
      p.alive = false;
      s.lives -= 1;
      s.respawn = 1.3;
      burst(s.sparks, rng, p.x, p.y, COLORS.cyan, 26);
      emit('die');
      if (s.lives <= 0) s.over = true;
      break;
    }
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (!s.over && s.bots.every((b) => b.kind === 'hulk')) {
    if (s.waveDelay <= 0) s.waveDelay = 1.2;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave += 1;
      spawnWave(s, rng);
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: BlitzState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.lineWidth = 2;
  g.strokeRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP);
  for (const bot of s.bots) {
    g.fillStyle = bot.kind === 'hulk' ? COLORS.muted : COLORS.coral;
    const r = bot.kind === 'hulk' ? 15 : 10;
    g.fillRect(bot.x - r, bot.y - r, r * 2, r * 2);
    g.fillStyle = COLORS.bg;
    g.fillRect(bot.x - r / 2, bot.y - r / 2, 4, 4);
    g.fillRect(bot.x + r / 2 - 4, bot.y - r / 2, 4, 4);
  }
  g.fillStyle = COLORS.gold;
  for (const b of s.bullets) g.fillRect(b.x - 3, b.y - 3, 6, 6);
  const p = s.player;
  if (p.alive && (p.invuln <= 0 || Math.floor(p.invuln * 10) % 2 === 0)) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(p.x - 7, p.y - 10, 14, 20);
    g.fillStyle = COLORS.paper;
    g.fillRect(p.x - 3 + p.dx * 5, p.y - 3 + p.dy * 5, 6, 6);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `WAVE ${s.wave}`, s.lives);
  gameOver(g, s.over);
}

const game: GameDefinition<BlitzState> = {
  id: 'bot-blitz',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};
export default game;
