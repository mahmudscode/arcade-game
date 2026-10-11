import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 56;
/** Standing heights of the tiers (feet y); the last is the ground. */
const TIERS = [4, 7, 10, 13, 16];
const GROUND = 16;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const FLIP_TIME = 6;
const POW_USES = 3;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 4.8, jump: 16.4 };
const EMPTY = 0;
const SOLID = 1;
const POW = 2;

/** Which columns each tier covers (the rest are gaps you can jump or fall through). */
const SPANS: Record<number, [number, number][]> = {
  4: [[0, 9], [18, 27]],
  7: [[4, 11], [16, 23]],
  10: [[0, 9], [18, 27]],
  13: [[4, 11], [16, 23]],
  16: [[0, 27]],
};

interface Enemy {
  b: Body;
  kind: number;
  dir: number;
  /** Seconds left flipped over (0 = on its feet). */
  flipped: number;
  /** Speeds up after being woken up. */
  angry: boolean;
  /** Bumps needed to flip (crabs take two). */
  armor: number;
}

export interface BumperState {
  grid: number[];
  me: Body & { alive: boolean };
  enemies: Enemy[];
  /** Enemies still to come this level. */
  queue: number;
  spawnTimer: number;
  /** Fireballs sweep across a floor; jump them or move off the floor. */
  fireballs: { x: number; y: number; dir: number }[];
  fireTimer: number;
  powLeft: number;
  /** Tiles that were just hit, for the little shake animation: [tx, ty, time]. */
  shakes: [number, number, number][];
  combo: number;
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
const px = (x: number) => OX + x * CELL;
const py = (y: number) => OY + y * CELL;

function world(s: BumperState): PlatWorld {
  return {
    solid: (tx, ty) => {
      if (ty >= ROWS) return true;
      if (ty < 0 || tx < 0 || tx >= COLS) return false; // the sides wrap
      return s.grid[idx(tx, ty)] !== EMPTY;
    },
  };
}

function buildLevel(s: BumperState): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => EMPTY);
  for (const tier of TIERS) {
    for (const [a, b] of SPANS[tier]!) for (let x = a; x <= b; x++) s.grid[idx(x, tier)] = SOLID;
  }
  for (let x = 0; x < COLS; x++) s.grid[idx(x, 17)] = SOLID;
  // The POW block hangs in the middle of the lowest platform tier.
  s.grid[idx(13, 13)] = POW;
  s.grid[idx(14, 13)] = POW;
  s.powLeft = POW_USES;
  s.enemies = [];
  s.queue = Math.min(4 + s.level, 11);
  s.spawnTimer = 1;
  s.fireballs = [];
  s.fireTimer = 9;
  s.shakes = [];
  s.combo = 0;
  Object.assign(s.me, newBody(14, GROUND), { alive: true });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): BumperState {
  void rng;
  const s: BumperState = {
    grid: [],
    me: { ...newBody(14, GROUND), alive: true },
    enemies: [],
    queue: 0,
    spawnTimer: 1,
    fireballs: [],
    fireTimer: 9,
    powLeft: POW_USES,
    shakes: [],
    combo: 0,
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
  buildLevel(s);
  return s;
}

function loseLife(s: BumperState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function flip(s: BumperState, e: Enemy, emit: UpdateContext['emit']): void {
  if (e.flipped > 0) {
    // Hitting a flipped enemy wakes it up, angrier than before.
    e.flipped = 0;
    e.angry = true;
    return;
  }
  e.armor -= 1;
  if (e.armor <= 0) {
    e.flipped = FLIP_TIME;
    e.b.vx = 0;
    emit('pickup');
  } else e.angry = true;
}

function bump(s: BumperState, tx: number, ty: number, emit: UpdateContext['emit']): void {
  s.shakes.push([tx, ty, 0.2]);
  if (s.grid[idx(tx, ty)] === POW && s.powLeft > 0) {
    s.powLeft -= 1;
    s.grid[idx(13, 13)] = s.grid[idx(14, 13)] = s.powLeft > 0 ? POW : EMPTY;
    // The shockwave flips everything standing on a floor.
    for (const e of s.enemies) if (e.b.onGround) flip(s, e, emit);
    emit('explode');
    return;
  }
  // Enemies standing on the bumped tile (or the one beside it) are flipped.
  for (const e of s.enemies) {
    if (e.b.onGround && Math.abs(e.b.y - ty) < 0.05 && Math.abs(e.b.x - (tx + 0.5)) < 1.2) flip(s, e, emit);
  }
}

function spawnEnemy(s: BumperState, rng: Rng): void {
  const fromLeft = rng.next() < 0.5;
  const kind = s.level >= 2 && rng.next() < 0.4 ? 1 : 0;
  const b = newBody(fromLeft ? 1.5 : 26.5, TIERS[0]!);
  b.onGround = true;
  s.enemies.push({ b, kind, dir: fromLeft ? 1 : -1, flipped: 0, angry: false, armor: kind === 1 ? 2 : 1 });
  s.queue -= 1;
}

function update(s: BumperState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildLevel(s);
      emit('wave');
    }
    return;
  }
  for (const sh of s.shakes) sh[2] -= dt;
  s.shakes = s.shakes.filter((sh) => sh[2] > 0);
  const w = world(s);
  const me = s.me;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newBody(14, GROUND), { alive: true });
      me.onGround = true;
      // Nothing may be camping the respawn spot.
      s.enemies = s.enemies.filter((e) => Math.hypot(e.b.x - 14, e.b.y - GROUND) > 4 || e.flipped > 0);
    }
  } else {
    const r = stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: false, down: false, jump: input.pressed.a || input.pressed.up || input.pressed.b }, dt, CFG);
    if (r.bumped) bump(s, r.bumped.tx, r.bumped.ty, emit);
    // Screen wrap.
    if (me.x < 0) me.x += COLS;
    if (me.x >= COLS) me.x -= COLS;
  }

  // Enemies queue in from the top corners.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.queue > 0 && s.enemies.length < Math.min(3 + Math.floor(s.level / 2), 6)) {
    s.spawnTimer = Math.max(1.8, 3.4 - s.level * 0.2);
    spawnEnemy(s, rng);
  }
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i]!;
    const b = e.b;
    if (e.flipped > 0) {
      e.flipped -= dt;
      stepBody(b, w, { dir: 0, up: false, down: false, jump: false }, dt, CFG);
      if (e.flipped <= 0) e.angry = true;
    } else {
      const speed = (e.angry ? 1.55 : 1) * (0.62 + Math.min(s.level, 8) * 0.04);
      stepBody(b, w, { dir: e.dir * speed, up: false, down: false, jump: false }, dt, { ...CFG, walk: CFG.walk * 0.55 });
    }
    // Enemies leave by the bottom corners and re-enter from the top.
    if (b.y >= GROUND - 0.01 && (b.x < -0.4 || b.x > COLS + 0.4)) {
      b.x = e.dir > 0 ? 1.5 : 26.5;
      b.y = TIERS[0]!;
      b.vy = 0;
      e.dir = b.x < 14 ? 1 : -1;
      continue;
    }
    if (b.x < -0.6) b.x += COLS;
    if (b.x > COLS + 0.6) b.x -= COLS;
    // Turn around if it walked into the middle of nowhere on the ground.
    if (!me.alive) continue;
    const dx = Math.abs(b.x - me.x);
    if (dx < 0.65 && Math.abs(b.y - me.y) < 0.9) {
      if (e.flipped > 0) {
        e.flipped = 0;
        s.combo += 1;
        s.score += 800 * Math.min(s.combo, 4);
        burst(s.sparks, rng, px(b.x), py(b.y), COLORS.gold, 12);
        s.enemies.splice(i, 1);
        emit('explode');
      } else {
        loseLife(s, rng, emit);
        if (s.over) return;
      }
    }
  }
  if (s.enemies.every((e) => e.flipped <= 0)) s.combo = 0;

  // A fireball sweeps the floor the hero is standing on.
  s.fireTimer -= dt;
  if (s.fireTimer <= 0 && me.alive) {
    s.fireTimer = Math.max(5, 11 - s.level * 0.6);
    const tier = TIERS.reduce((best, t) => (Math.abs(t - me.y) < Math.abs(best - me.y) ? t : best), GROUND);
    // It enters from the side the hero is farther from, and sweeps across.
    const dir = me.x < 14 ? -1 : 1;
    s.fireballs.push({ x: dir < 0 ? COLS + 1 : -1, y: tier, dir });
  }
  for (let i = s.fireballs.length - 1; i >= 0; i--) {
    const f = s.fireballs[i]!;
    f.x += f.dir * 6 * dt;
    if (f.x < -2 || f.x > COLS + 2) {
      s.fireballs.splice(i, 1);
      continue;
    }
    if (me.alive && Math.abs(f.x - me.x) < 0.5 && me.y > f.y - 0.55 && me.y <= f.y + 0.3) {
      loseLife(s, rng, emit);
      s.fireballs.splice(i, 1);
      if (s.over) return;
    }
  }

  if (s.queue === 0 && s.enemies.length === 0 && s.levelDelay <= 0 && me.alive) {
    s.score += 1000;
    s.levelDelay = 1.6;
    emit('wave');
  }
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: BumperState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === EMPTY) continue;
      const lift = s.shakes.some((sh) => sh[0] === x && sh[1] === y) ? -5 : 0;
      g.fillStyle = c === POW ? COLORS.cyan : y === 17 ? COLORS.purple : COLORS.coral;
      g.fillRect(px(x) + 1, py(y) + 1 + lift, CELL - 2, CELL - 2);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(px(x) + 1, py(y) + CELL / 2 + lift, CELL - 2, 2);
    }
  }
  if (s.powLeft > 0) {
    g.fillStyle = COLORS.bg;
    g.font = '10px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText('POW', px(14), py(13) + 8);
  }
  for (const f of s.fireballs) {
    g.fillStyle = Math.floor(time * 14) % 2 ? COLORS.gold : COLORS.coral;
    g.beginPath();
    g.arc(px(f.x), py(f.y) - 7, 7, 0, 6.3);
    g.fill();
  }
  for (const e of s.enemies) {
    const x = px(e.b.x);
    const y = py(e.b.y);
    g.fillStyle = e.kind === 1 ? COLORS.coral : '#7BE495';
    if (e.flipped > 0) {
      g.fillRect(x - 11, y - 12, 22, 12);
      g.fillStyle = COLORS.bg;
      g.fillRect(x - 6, y - 8, 4, 4);
      g.fillRect(x + 2, y - 8, 4, 4);
      if (e.flipped < 1.5 && Math.floor(time * 10) % 2) {
        g.fillStyle = COLORS.paper;
        g.fillRect(x - 11, y - 14, 22, 2);
      }
    } else {
      g.beginPath();
      g.arc(x, y - 10, 12, Math.PI, 0);
      g.lineTo(x + 12, y);
      g.lineTo(x - 12, y);
      g.fill();
      g.fillStyle = e.angry ? COLORS.paper : COLORS.bg;
      g.fillRect(x - 6 + e.dir * 2, y - 12, 4, 4);
      g.fillRect(x + 2 + e.dir * 2, y - 12, 4, 4);
    }
  }
  if (s.me.alive) {
    g.fillStyle = COLORS.gold;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 24, 16, 24);
    g.fillStyle = COLORS.coral;
    g.fillRect(px(s.me.x) - 9, py(s.me.y) - 26, 18, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 17, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  LEFT ${s.queue + s.enemies.length}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'PIPES CLEARED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<BumperState> = {
  id: 'pipe-bumper',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
