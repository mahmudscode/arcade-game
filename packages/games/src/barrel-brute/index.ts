import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 54;
/** Standing heights (feet y) of the girders, bottom to top; each girder is one tile thick below the feet. */
const GIRDERS = [16, 13, 10, 7, 4];
const START_LIVES = 3;
const BONUS_START = 5000;
const EXTRA_LIFE_EVERY = 20000;
const HAMMER_TIME = 8;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 4.4, climb: 3.2, jump: 11.2 };
const SOLID = 1;
const LADDER = 2;

interface Barrel {
  x: number;
  y: number;
  dir: number;
  /** Rolling along a girder (false) or tumbling through the air (true). */
  falling: boolean;
  vy: number;
  /** Set once the hero has hopped it, so a jump scores only once. */
  scored: boolean;
}
interface Pickup {
  x: number;
  y: number;
  kind: number;
}

export interface BruteState {
  grid: number[];
  me: Body & { alive: boolean; hammer: number };
  barrels: Barrel[];
  pickups: Pickup[];
  sparks: Spark[];
  throwTimer: number;
  bonus: number;
  bonusTimer: number;
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
const px = (x: number) => OX + x * CELL;
const py = (y: number) => OY + y * CELL;
/** Which way a girder runs downhill: the barrels roll in this direction on that girder. */
const downhill = (k: number) => (k % 2 === 0 ? 1 : -1);
/** The hero's goal: the platform at the top. */
const GOAL = { x: 3.5, y: GIRDERS[GIRDERS.length - 1]! };

function world(s: BruteState): PlatWorld {
  return {
    solid: (tx, ty) => tx < 0 || tx >= COLS || (ty >= 0 && ty < ROWS && s.grid[idx(tx, ty)] === SOLID) || ty >= ROWS,
    ladder: (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && s.grid[idx(tx, ty)] === LADDER,
  };
}

function buildLevel(s: BruteState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => 0);
  GIRDERS.forEach((f, k) => {
    // Each girder stops short of one wall, so barrels drop to the next one.
    const gapLeft = k % 2 === 1;
    for (let x = 0; x < COLS; x++) {
      const gap = gapLeft ? x < 2 : x >= COLS - 2;
      if (!gap && !(k === GIRDERS.length - 1 && x > 8)) s.grid[idx(x, f)] = SOLID;
    }
  });
  // Ladders between girders (two each, one of them "broken" later by being unused by barrels).
  for (let k = 0; k < GIRDERS.length - 1; k++) {
    const used = new Set<number>();
    for (let n = 0; n < 2; n++) {
      let c = rng.int(4, COLS - 5);
      for (let t = 0; used.has(c) && t < 10; t++) c = rng.int(4, COLS - 5);
      used.add(c);
      for (let y = GIRDERS[k + 1]!; y < GIRDERS[k]!; y++) s.grid[idx(c, y)] = LADDER;
    }
  }
  s.barrels = [];
  s.pickups = [];
  // A hammer on each of two middle girders.
  for (const k of [1, 3]) s.pickups.push({ x: rng.int(6, COLS - 7) + 0.5, y: GIRDERS[k]! - 1, kind: 0 });
  s.throwTimer = 2;
  s.bonus = BONUS_START;
  s.bonusTimer = 0;
  resetHero(s);
}

function resetHero(s: BruteState): void {
  Object.assign(s.me, newBody(2.5, GIRDERS[0]!), { alive: true, hammer: 0 });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): BruteState {
  const s: BruteState = {
    grid: [],
    me: { ...newBody(2.5, GIRDERS[0]!), alive: true, hammer: 0 },
    barrels: [],
    pickups: [],
    sparks: [],
    throwTimer: 2,
    bonus: BONUS_START,
    bonusTimer: 0,
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  buildLevel(s, rng);
  return s;
}

function loseLife(s: BruteState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  s.barrels = s.barrels.filter((b) => Math.hypot(b.x - 2.5, b.y - GIRDERS[0]!) > 5);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** Girder index whose top the barrel is rolling on, or -1 when it is between girders. */
const girderOf = (y: number) => GIRDERS.findIndex((g) => Math.abs(g - y) < 0.01);

function update(s: BruteState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildLevel(s, rng);
      emit('wave');
    }
    return;
  }
  const w = world(s);
  const me = s.me;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) resetHero(s);
  } else {
    me.hammer = Math.max(0, me.hammer - dt);
    const jump = input.pressed.a || input.pressed.b;
    // The hammer keeps you walking; jumping is for barrel-hopping.
    const r = stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: input.held.up, down: input.held.down, jump: jump && me.hammer <= 0 }, dt, CFG);
    if (r.landed) emit('pickup');
    me.x = Math.min(COLS - 0.5, Math.max(0.5, me.x));
    for (let i = s.pickups.length - 1; i >= 0; i--) {
      const p = s.pickups[i]!;
      if (Math.abs(p.x - me.x) < 0.7 && Math.abs(p.y - me.y) < 0.9) {
        s.pickups.splice(i, 1);
        me.hammer = HAMMER_TIME;
        emit('wave');
      }
    }
    if (me.y > GIRDERS[0]! + 0.5) loseLife(s, rng, emit);
  }

  // The brute rolls barrels from the top-right.
  s.throwTimer -= dt;
  if (s.throwTimer <= 0) {
    s.throwTimer = Math.max(1.3, 3.2 - s.level * 0.25) + rng.range(0, 1);
    const top = GIRDERS.length - 1;
    s.barrels.push({ x: 9.5, y: GIRDERS[top]!, dir: downhill(top), falling: true, vy: 0, scored: false });
    emit('fire');
  }

  // Barrels roll downhill along each girder and drop wherever the girder ends (or has a ladder in it).
  for (let i = s.barrels.length - 1; i >= 0; i--) {
    const b = s.barrels[i]!;
    if (!b.falling) {
      b.x += b.dir * (3.2 + s.level * 0.15) * dt;
      const tile = b.x >= 0 && b.x < COLS ? s.grid[idx(Math.floor(b.x), b.y)] : 0;
      if (tile !== SOLID) {
        b.falling = true;
        b.vy = 0;
      }
    } else {
      const prev = b.y;
      b.vy = Math.min(14, b.vy + 30 * dt);
      b.y += b.vy * dt;
      const tx = Math.floor(b.x);
      const land = GIRDERS.findIndex((gy) => gy > prev + 1e-9 && b.y >= gy && tx >= 0 && tx < COLS && s.grid[idx(tx, gy)] === SOLID);
      if (land >= 0) {
        b.y = GIRDERS[land]!;
        b.vy = 0;
        b.falling = false;
        b.dir = downhill(land);
      }
    }
    if (b.y > GIRDERS[0]! + 1.5 || b.x < -1 || b.x > COLS + 1) {
      s.barrels.splice(i, 1);
      continue;
    }
    if (!me.alive) continue;
    const dx = Math.abs(b.x - me.x);
    // Hopping a barrel scores once.
    if (!b.scored && dx < 0.5 && me.y <= b.y - 0.8 && me.y > b.y - 2.4 && !me.onGround) {
      b.scored = true;
      s.score += 100;
      emit('pickup');
    }
    if (dx < 0.55 && Math.abs(b.y - me.y) < 0.8) {
      if (me.hammer > 0) {
        s.score += 300;
        burst(s.sparks, rng, px(b.x), py(b.y), COLORS.gold, 10);
        s.barrels.splice(i, 1);
        emit('explode');
      } else {
        loseLife(s, rng, emit);
        if (s.over) return;
      }
    }
  }

  // Bonus counts down; the goal ends the level.
  s.bonusTimer += dt;
  if (s.bonusTimer >= 1) {
    s.bonusTimer -= 1;
    s.bonus = Math.max(0, s.bonus - 100);
  }
  if (me.alive && Math.abs(me.x - GOAL.x) < 1.2 && Math.abs(me.y - GOAL.y) < 0.2) {
    s.score += s.bonus + 1000;
    s.levelDelay = 1.8;
    emit('wave');
  }
  if (me.alive && s.bonus === 0) loseLife(s, rng, emit);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: BruteState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === SOLID) {
        g.fillStyle = COLORS.coral;
        g.fillRect(px(x) + 1, py(y) + 4, CELL - 2, CELL - 8);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(px(x) + 1, py(y) + CELL / 2, CELL - 2, 2);
      } else if (c === LADDER) {
        g.fillStyle = COLORS.cyan;
        g.fillRect(px(x) + 7, py(y), 3, CELL);
        g.fillRect(px(x) + CELL - 10, py(y), 3, CELL);
        for (let r = 4; r < CELL; r += 8) g.fillRect(px(x) + 7, py(y) + r, CELL - 14, 2);
      }
    }
  }
  // The brute and the goal.
  g.fillStyle = COLORS.purple;
  g.fillRect(px(9) - 4, py(GIRDERS[GIRDERS.length - 1]! - 2), 46, 56);
  g.fillStyle = COLORS.bg;
  g.fillRect(px(9) + 8, py(GIRDERS[GIRDERS.length - 1]! - 2) + 10, 7, 7);
  g.fillRect(px(9) + 24, py(GIRDERS[GIRDERS.length - 1]! - 2) + 10, 7, 7);
  g.fillStyle = Math.floor(time * 3) % 2 ? COLORS.gold : COLORS.paper;
  g.fillRect(px(GOAL.x) - 8, py(GOAL.y) - 24, 16, 24);
  for (const p of s.pickups) {
    g.fillStyle = COLORS.gold;
    g.fillRect(px(p.x) - 10, py(p.y + 0.2) - 4, 20, 8);
    g.fillRect(px(p.x) - 2, py(p.y + 0.6) - 4, 4, 14);
  }
  for (const b of s.barrels) {
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.arc(px(b.x), py(b.y) - 9, 9, 0, TAU);
    g.fill();
    g.strokeStyle = COLORS.bg;
    g.beginPath();
    g.moveTo(px(b.x) - 9, py(b.y) - 9);
    g.lineTo(px(b.x) + 9, py(b.y) - 9);
    g.stroke();
  }
  if (s.me.alive) {
    g.fillStyle = s.me.hammer > 0 && Math.floor(time * 10) % 2 ? COLORS.paper : COLORS.cyan;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 24, 16, 24);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 18, 3, 4);
    if (s.me.hammer > 0) {
      g.fillStyle = COLORS.gold;
      g.fillRect(px(s.me.x) + s.me.face * 12 - 5, py(s.me.y) - 34, 10, 14);
    }
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  BONUS ${s.bonus}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'RESCUED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<BruteState> = {
  id: 'barrel-brute',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
