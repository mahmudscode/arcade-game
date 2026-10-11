import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 26;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const SPACING = 5;
/** Falling farther than this from the peak of a fall is fatal. */
const FATAL_FALL = 3.3;
const AIR_MAX = 100;
const GHOST_AT = 70;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 3.6, climb: 3, jump: 11.5, air: 0.7 };
const SOLID = 1;
const ROPE = 2;

interface Bat {
  x: number;
  y: number;
  dir: number;
  t: number;
}
interface Spider {
  x: number;
  y: number;
  dir: number;
  top: number;
  bottom: number;
}
interface Item {
  x: number;
  y: number;
  kind: 'air' | 'treasure' | 'flare';
}

export interface DelverState {
  /** tiers * SPACING rows; row 0 is the top of the cave. */
  grid: number[];
  tiers: number;
  me: Body & { alive: boolean; air: number; flares: number; peak: number; invuln: number };
  bats: Bat[];
  spiders: Spider[];
  items: Item[];
  ghost: { x: number; y: number; on: boolean; scared: number };
  flare: { x: number; y: number; t: number };
  clock: number;
  exit: { x: number; y: number };
  sparks: Spark[];
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const idx = (x: number, y: number) => y * COLS + x;
const floorRow = (t: number) => (t + 1) * SPACING - 1;
const px = (x: number) => OX + x * CELL;

function world(s: DelverState): PlatWorld {
  const rows = s.tiers * SPACING;
  return {
    solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= rows || (ty >= 0 && s.grid[idx(tx, ty)] === SOLID),
    ladder: (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < rows && s.grid[idx(tx, ty)] === ROPE,
  };
}

function buildCave(s: DelverState, rng: Rng): void {
  s.tiers = Math.min(4 + s.level, 9);
  const rows = s.tiers * SPACING;
  s.grid = Array.from({ length: COLS * rows }, () => 0);
  // Each tier has a floor with a 2-wide hole; a rope hangs down one column of it, the other is a deadly drop.
  const holes: number[] = [];
  for (let t = 0; t < s.tiers; t++) {
    const fr = floorRow(t);
    for (let x = 0; x < COLS; x++) s.grid[idx(x, fr)] = SOLID;
    if (t < s.tiers - 1) {
      const hx = (t % 2 === 0 ? rng.int(14, COLS - 4) : rng.int(2, 10));
      holes.push(hx);
      s.grid[idx(hx, fr)] = ROPE;
      s.grid[idx(hx + 1, fr)] = 0;
      for (let y = fr + 1; y < floorRow(t + 1); y++) s.grid[idx(hx, y)] = ROPE;
    }
  }
  s.bats = [];
  s.spiders = [];
  s.items = [];
  for (let t = 0; t < s.tiers; t++) {
    const fr = floorRow(t);
    if (rng.next() < 0.7 + s.level * 0.05) s.bats.push({ x: rng.range(3, COLS - 3), y: fr - rng.range(1.5, 3), dir: rng.pick([-1, 1]), t: rng.range(0, 6) });
    if (t < s.tiers - 1 && rng.next() < 0.45) {
      const hx = holes[t]!;
      s.spiders.push({ x: hx + 0.5, y: fr + 1.5, dir: 1, top: fr + 1.5, bottom: floorRow(t + 1) - 1 });
    }
    for (let k = 0; k < 2; k++) {
      const x = rng.int(2, COLS - 3);
      if (s.grid[idx(x, fr)] !== SOLID) continue;
      const roll = rng.next();
      s.items.push({ x: x + 0.5, y: fr - 0.6, kind: roll < 0.35 ? 'air' : roll < 0.5 ? 'flare' : 'treasure' });
    }
  }
  const lastFloor = floorRow(s.tiers - 1);
  s.exit = { x: COLS - 3.5, y: lastFloor };
  s.ghost = { x: 2, y: 2, on: false, scared: 0 };
  s.flare = { x: 0, y: 0, t: 0 };
  s.clock = 0;
  Object.assign(s.me, newBody(2.5, floorRow(0)), { alive: true, air: AIR_MAX, flares: 4, peak: floorRow(0), invuln: 1.5 });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): DelverState {
  const s: DelverState = {
    grid: [],
    tiers: 5,
    me: { ...newBody(2.5, floorRow(0)), alive: true, air: AIR_MAX, flares: 4, peak: floorRow(0), invuln: 1.5 },
    bats: [],
    spiders: [],
    items: [],
    ghost: { x: 2, y: 2, on: false, scared: 0 },
    flare: { x: 0, y: 0, t: 0 },
    clock: 0,
    exit: { x: 20, y: 0 },
    sparks: [],
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  buildCave(s, rng);
  return s;
}

function loseLife(s: DelverState, rng: Rng, emit: UpdateContext['emit']): void {
  void rng;
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.6;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: DelverState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildCave(s, rng);
      emit('wave');
    }
    return;
  }
  const w = world(s);
  const me = s.me;
  s.flare.t = Math.max(0, s.flare.t - dt);

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      // Back at the top of the tier you last reached, with a fresh breath of air.
      const t = Math.max(0, Math.min(s.tiers - 1, Math.floor(me.y / SPACING)));
      Object.assign(me, newBody(2.5, floorRow(t)), { alive: true, air: AIR_MAX, peak: floorRow(t), invuln: 2.4 });
      me.onGround = true;
      s.ghost.on = false;
      s.clock = 0;
    }
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    s.clock += dt;
    me.air -= (1.9 + s.level * 0.12) * dt;
    if (me.air <= 0) {
      me.air = 0;
      loseLife(s, rng, emit);
      if (s.over) return;
    }
    const wasAir = !me.onGround && !me.climbing;
    const prevPeak = me.peak;
    const r = stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: input.held.up, down: input.held.down, jump: input.pressed.b }, dt, CFG);
    // Fall damage: measured from the highest point reached since the feet last left a surface.
    if (r.landed && wasAir) {
      const fell = me.y - prevPeak;
      me.peak = me.y;
      if (fell > FATAL_FALL) {
        loseLife(s, rng, emit);
        if (s.over) return;
      }
    } else if (me.climbing || me.onGround) me.peak = me.y;
    else me.peak = Math.min(me.peak, me.y);
    if (input.pressed.a && me.flares > 0 && s.flare.t <= 0) {
      me.flares -= 1;
      s.flare = { x: me.x, y: me.y - 1, t: 1.2 };
      if (s.ghost.on && Math.hypot(s.ghost.x - me.x, s.ghost.y - (me.y - 1)) < 8) s.ghost.scared = 6;
      emit('fire');
    }
    for (let i = s.items.length - 1; i >= 0; i--) {
      const it = s.items[i]!;
      if (Math.abs(it.x - me.x) < 0.7 && Math.abs(it.y - (me.y - 0.6)) < 0.9) {
        s.items.splice(i, 1);
        if (it.kind === 'air') me.air = Math.min(AIR_MAX, me.air + 38);
        else if (it.kind === 'flare') me.flares += 2;
        else s.score += 500;
        emit('pickup');
      }
    }
    if (Math.abs(me.x - s.exit.x) < 1 && Math.abs(me.y - s.exit.y) < 0.1) {
      s.score += 2000 + Math.floor(me.air) * 20;
      s.levelDelay = 1.8;
      emit('wave');
    }
  }

  // Bats patrol the tiers, spiders ride the ropes.
  for (const b of s.bats) {
    b.t += dt;
    b.x += b.dir * 2.2 * dt;
    if (b.x < 1.5 || b.x > COLS - 1.5) b.dir = 0 - b.dir;
    const base = b.y;
    if (me.alive && me.invuln <= 0 && Math.abs(b.x - me.x) < 0.8 && Math.abs(base + Math.sin(b.t * 3) * 0.6 - (me.y - 1)) < 0.9) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }
  for (const sp of s.spiders) {
    sp.y += sp.dir * 1.5 * dt;
    if (sp.y > sp.bottom) sp.dir = -1;
    if (sp.y < sp.top) sp.dir = 1;
    if (me.alive && me.invuln <= 0 && Math.abs(sp.x - me.x) < 0.8 && Math.abs(sp.y - (me.y - 0.8)) < 0.9) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  // The ghost: it arrives after a while and drifts through the walls toward you.
  if (s.clock >= GHOST_AT && !s.ghost.on && me.alive) {
    s.ghost = { x: me.x < COLS / 2 ? COLS - 2 : 2, y: me.y - 4, on: true, scared: 0 };
    emit('wave');
  }
  if (s.ghost.on && me.alive) {
    const g = s.ghost;
    g.scared = Math.max(0, g.scared - dt);
    const dx = me.x - g.x;
    const dy = me.y - 1 - g.y;
    const d = Math.hypot(dx, dy) || 1;
    const v = (1.7 + s.level * 0.15) * (g.scared > 0 ? -1.4 : 1);
    g.x += (dx / d) * v * dt;
    g.y += (dy / d) * v * dt;
    if (g.scared <= 0 && d < 0.9 && me.invuln <= 0) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: DelverState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const sy = (y: number) => 300 + (y - s.me.y) * CELL;
  g.fillStyle = '#17121f';
  g.fillRect(0, 0, W, H);
  const rows = s.tiers * SPACING;
  const r0 = Math.max(0, Math.floor(s.me.y - 12));
  const r1 = Math.min(rows - 1, Math.ceil(s.me.y + 12));
  for (let y = r0; y <= r1; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === SOLID) {
        g.fillStyle = (x + y) % 2 ? '#4a3a5f' : '#42325a';
        g.fillRect(px(x), sy(y), CELL, CELL);
      } else if (c === ROPE) {
        g.fillStyle = COLORS.gold;
        g.fillRect(px(x) + CELL / 2 - 2, sy(y), 4, CELL);
      }
    }
  }
  g.fillStyle = Math.floor(time * 3) % 2 ? COLORS.cyan : COLORS.paper;
  g.fillRect(px(s.exit.x) - 12, sy(s.exit.y) - 40, 24, 40);
  for (const it of s.items) {
    g.fillStyle = it.kind === 'air' ? COLORS.cyan : it.kind === 'flare' ? COLORS.coral : COLORS.gold;
    g.beginPath();
    g.arc(px(it.x), sy(it.y), 8, 0, 6.3);
    g.fill();
  }
  for (const b of s.bats) {
    g.fillStyle = COLORS.purple;
    const by = b.y + Math.sin(b.t * 3) * 0.6;
    g.fillRect(px(b.x) - 12, sy(by) - 4, 24, 8);
    g.fillRect(px(b.x) - 14, sy(by) - 10 + (Math.floor(time * 12) % 2) * 8, 8, 3);
  }
  for (const sp of s.spiders) {
    g.strokeStyle = COLORS.muted;
    g.beginPath();
    g.moveTo(px(sp.x), sy(sp.top));
    g.lineTo(px(sp.x), sy(sp.y));
    g.stroke();
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.arc(px(sp.x), sy(sp.y), 8, 0, 6.3);
    g.fill();
  }
  if (s.flare.t > 0) {
    g.fillStyle = `rgba(255,201,60,${Math.min(0.4, s.flare.t)})`;
    g.beginPath();
    g.arc(px(s.flare.x), sy(s.flare.y), 8 * CELL * (1 - s.flare.t / 1.2 * 0.4), 0, 6.3);
    g.fill();
  }
  if (s.ghost.on) {
    g.fillStyle = s.ghost.scared > 0 ? COLORS.muted : COLORS.paper;
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(px(s.ghost.x), sy(s.ghost.y), 14, Math.PI, 0);
    g.lineTo(px(s.ghost.x) + 14, sy(s.ghost.y) + 14);
    g.lineTo(px(s.ghost.x) - 14, sy(s.ghost.y) + 14);
    g.fill();
    g.globalAlpha = 1;
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    g.fillStyle = COLORS.coral;
    g.fillRect(px(s.me.x) - 8, sy(s.me.y) - 26, 16, 26);
    g.fillStyle = COLORS.gold;
    g.fillRect(px(s.me.x) - 9, sy(s.me.y) - 31, 18, 7);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, sy(s.me.y) - 19, 3, 4);
  }
  drawSparks(g, s.sparks);
  // Air meter.
  g.fillStyle = COLORS.muted;
  g.fillRect(W / 2 - 100, 40, 200, 10);
  g.fillStyle = s.me.air > 25 ? COLORS.cyan : COLORS.coral;
  g.fillRect(W / 2 - 100, 40, (200 * s.me.air) / AIR_MAX, 10);
  hud(g, s, `CAVE ${s.level}  FLARES ${s.me.flares}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'CAVE CLEARED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<DelverState> = {
  id: 'deep-delver',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
