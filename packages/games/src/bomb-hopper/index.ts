import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 50;
const GROUND = 17;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const BOMBS = 24;
const GLIDE_FALL = 3;
const POWER_TIME = 6;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 5, jump: 15.5, air: 1 };
/** One-way platforms: [row, from column, to column]. */
const PLATFORMS: [number, number, number][] = [
  [14, 2, 8],
  [14, 19, 25],
  [11, 10, 17],
  [8, 1, 6],
  [8, 21, 26],
  [5, 8, 19],
];

interface Bomb {
  x: number;
  y: number;
}
interface Foe {
  /** 0 walks a platform, 1 flies and bounces. */
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Platform row it patrols (walkers). */
  row: number;
  /** Seconds before it re-enters after being eaten. */
  gone: number;
}

export interface HopperState {
  me: Body & { alive: boolean; power: number };
  bombs: Bomb[];
  /** Index into `bombs` of the lit one (bonus), or -1. */
  lit: number;
  foes: Foe[];
  ball: { x: number; y: number; life: number };
  ballTimer: number;
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

const px = (x: number) => OX + x * CELL;
const py = (y: number) => OY + y * CELL;

const world: PlatWorld = {
  solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= GROUND,
  platform: (tx, ty) => PLATFORMS.some(([r, a, b]) => r === ty && tx >= a && tx <= b),
};

function placeBombs(s: HopperState, rng: Rng): void {
  const spots: Bomb[] = [];
  for (const [row, a, b] of PLATFORMS) for (let x = a; x <= b; x++) spots.push({ x: x + 0.5, y: row - 1.4 });
  for (let x = 1; x < COLS - 1; x += 2) for (const y of [3, 6.5, 9.5, 12.5, 15.5]) if (!PLATFORMS.some(([r, a, b]) => Math.abs(r - y) < 1.2 && x >= a - 1 && x <= b + 1)) spots.push({ x: x + 0.5, y });
  s.bombs = [];
  while (s.bombs.length < BOMBS && spots.length > 0) s.bombs.push(spots.splice(rng.int(0, spots.length - 1), 1)[0]!);
  s.lit = s.bombs.length > 0 ? 0 : -1;
}

function spawnFoes(s: HopperState, rng: Rng): void {
  s.foes = [];
  const count = Math.min(2 + s.level, 7);
  for (let k = 0; k < count; k++) {
    if (k % 2 === 0) {
      const [row, a, b] = PLATFORMS[rng.int(0, PLATFORMS.length - 1)]!;
      s.foes.push({ kind: 0, x: rng.range(a + 1, b), y: row, vx: rng.next() < 0.5 ? 2.2 : -2.2, vy: 0, row, gone: 0 });
    } else {
      s.foes.push({ kind: 1, x: rng.range(2, COLS - 2), y: rng.range(2, 6), vx: rng.next() < 0.5 ? 2.4 : -2.4, vy: rng.next() < 0.5 ? 1.6 : -1.6, row: 0, gone: 0 });
    }
  }
}

function buildLevel(s: HopperState, rng: Rng): void {
  placeBombs(s, rng);
  spawnFoes(s, rng);
  s.ball = { x: 0, y: 0, life: 0 };
  s.ballTimer = 10;
  s.combo = 0;
  Object.assign(s.me, newBody(14, GROUND), { alive: true, power: 0 });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): HopperState {
  const s: HopperState = {
    me: { ...newBody(14, GROUND), alive: true, power: 0 },
    bombs: [],
    lit: -1,
    foes: [],
    ball: { x: 0, y: 0, life: 0 },
    ballTimer: 10,
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
  buildLevel(s, rng);
  return s;
}

function loseLife(s: HopperState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** Lights the nearest remaining bomb to the one just taken (or the first). */
function relight(s: HopperState, near: Bomb | null): void {
  if (s.bombs.length === 0) {
    s.lit = -1;
    return;
  }
  let best = 0;
  let bestD = Infinity;
  s.bombs.forEach((b, i) => {
    const d = near ? Math.hypot(b.x - near.x, b.y - near.y) : i;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  s.lit = best;
}

function update(s: HopperState, input: Input, dt: number, ctx: UpdateContext): void {
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
  const me = s.me;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newBody(14, GROUND), { alive: true, power: 0 });
      me.onGround = true;
      for (const f of s.foes) if (Math.hypot(f.x - 14, f.y - GROUND) < 5) f.gone = Math.max(f.gone, 2);
    }
  } else {
    me.power = Math.max(0, me.power - dt);
    const holdJump = input.held.a || input.held.up;
    stepBody(me, world, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: false, down: input.held.down, jump: input.pressed.a || input.pressed.up }, dt, CFG);
    // Hold jump while falling to glide.
    if (holdJump && !me.onGround && me.vy > GLIDE_FALL) me.vy = GLIDE_FALL;
    if (me.y < 1) {
      me.y = 1;
      me.vy = Math.max(0, me.vy);
    }

    for (let i = s.bombs.length - 1; i >= 0; i--) {
      const b = s.bombs[i]!;
      if (Math.abs(b.x - me.x) < 0.7 && Math.abs(b.y - (me.y - 0.45)) < 0.75) {
        const wasLit = i === s.lit;
        s.score += wasLit ? 300 : 100;
        s.bombs.splice(i, 1);
        burst(s.sparks, rng, px(b.x), py(b.y), COLORS.gold, 6);
        emit('pickup');
        relight(s, b);
        if (wasLit) emit('wave');
      }
    }
    if (s.ball.life > 0 && Math.abs(s.ball.x - me.x) < 0.8 && Math.abs(s.ball.y - (me.y - 0.45)) < 0.8) {
      s.ball.life = 0;
      me.power = POWER_TIME;
      s.combo = 0;
      emit('wave');
    }
  }

  // The power ball shows up now and then.
  s.ballTimer -= dt;
  if (s.ball.life > 0) s.ball.life -= dt;
  if (s.ballTimer <= 0) {
    s.ballTimer = 16;
    const [row, a, b] = PLATFORMS[rng.int(0, PLATFORMS.length - 1)]!;
    s.ball = { x: rng.range(a + 0.5, b + 0.5), y: row - 0.6, life: 9 };
  }

  for (const f of s.foes) {
    if (f.gone > 0) {
      f.gone -= dt;
      continue;
    }
    if (f.kind === 0) {
      f.x += f.vx * dt;
      const [, a, b] = PLATFORMS.find((p) => p[0] === f.row)!;
      if (f.x < a + 0.3 || f.x > b + 0.7) {
        f.vx = 0 - f.vx;
        f.x = Math.min(b + 0.7, Math.max(a + 0.3, f.x));
      }
      f.y = f.row;
    } else {
      // Flyers bounce around, drifting toward the hero.
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < 1 || f.x > COLS - 1) f.vx = 0 - f.vx;
      if (f.y < 1.5 || f.y > GROUND - 0.2) f.vy = 0 - f.vy;
      f.x = Math.min(COLS - 1, Math.max(1, f.x));
      f.y = Math.min(GROUND - 0.2, Math.max(1.5, f.y));
      if (me.alive) {
        f.vx += Math.sign(me.x - f.x) * 0.5 * dt;
        f.vy += Math.sign(me.y - 0.5 - f.y) * 0.5 * dt;
        f.vx = Math.max(-2.8, Math.min(2.8, f.vx));
        f.vy = Math.max(-2.2, Math.min(2.2, f.vy));
      }
    }
    if (!me.alive) continue;
    if (Math.abs(f.x - me.x) < 0.7 && Math.abs(f.y - 0.5 - (me.y - 0.5)) < 0.8) {
      if (me.power > 0) {
        s.combo += 1;
        s.score += 200 * 2 ** Math.min(s.combo - 1, 4);
        burst(s.sparks, rng, px(f.x), py(f.y), COLORS.coral, 10);
        f.gone = 5;
        f.x = f.kind === 0 ? f.x : rng.range(2, COLS - 2);
        emit('explode');
      } else {
        loseLife(s, rng, emit);
        if (s.over) return;
      }
    }
  }

  if (s.bombs.length === 0 && me.alive && s.levelDelay <= 0) {
    s.score += 1000 + s.level * 500;
    s.levelDelay = 1.8;
    emit('wave');
  }
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: HopperState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = COLORS.purple;
  g.fillRect(OX, py(GROUND), COLS * CELL, 40);
  for (const [row, a, b] of PLATFORMS) {
    g.fillStyle = COLORS.coral;
    g.fillRect(px(a), py(row), (b - a + 1) * CELL, 8);
  }
  s.bombs.forEach((b, i) => {
    const lit = i === s.lit;
    g.fillStyle = lit && Math.floor(time * 8) % 2 ? COLORS.gold : COLORS.paper;
    g.beginPath();
    g.arc(px(b.x), py(b.y), 9, 0, TAU);
    g.fill();
    g.fillStyle = lit ? COLORS.coral : COLORS.bg;
    g.fillRect(px(b.x) - 1, py(b.y) - 14, 3, 6);
  });
  if (s.ball.life > 0) {
    g.fillStyle = Math.floor(time * 10) % 2 ? COLORS.cyan : COLORS.paper;
    g.beginPath();
    g.arc(px(s.ball.x), py(s.ball.y), 10, 0, TAU);
    g.fill();
  }
  for (const f of s.foes) {
    if (f.gone > 0) continue;
    g.fillStyle = s.me.power > 0 ? COLORS.gold : f.kind === 0 ? '#7BE495' : COLORS.coral;
    if (f.kind === 0) g.fillRect(px(f.x) - 10, py(f.y) - 20, 20, 20);
    else {
      g.beginPath();
      g.ellipse(px(f.x), py(f.y) - 12, 13, 8, 0, 0, TAU);
      g.fill();
      g.fillRect(px(f.x) - 16, py(f.y) - 18 + (Math.floor(time * 12) % 2) * 4, 8, 3);
    }
    g.fillStyle = COLORS.bg;
    g.fillRect(px(f.x) - 5, py(f.y) - 14, 4, 4);
    g.fillRect(px(f.x) + 2, py(f.y) - 14, 4, 4);
  }
  if (s.me.alive) {
    g.fillStyle = s.me.power > 0 && Math.floor(time * 10) % 2 ? COLORS.gold : COLORS.cyan;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 24, 16, 24);
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 9, py(s.me.y) - 26, 18, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 17, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  BOMBS ${s.bombs.length}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ALL BOMBS TAKEN!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<HopperState> = {
  id: 'bomb-hopper',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
