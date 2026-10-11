import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, pathStep, steerToLadder, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 54;
const FLOORS = [5, 10, 15];
const SEA = 16;
/** Stair columns for each gap between floors. */
const STAIRS: number[][] = [[3, 22], [6, 24]];
const START_LIVES = 3;
const HEARTS_NEEDED = 16;
const MAX_LOST = 3;
const POWER_TIME = 6;
const EXTRA_LIFE_EVERY = 20000;
const CFG: PlatConfig = { ...DEFAULT_PLAT, jump: 0, walk: 4.6, climb: 3.6 };
const BRUTUS_CFG: PlatConfig = { ...CFG, walk: 2.5, climb: 2.5 };
const FLOOR = 1;
const STAIR = 2;

interface Heart {
  x: number;
  y: number;
}
interface Brute {
  b: Body;
  dir: number;
  up: boolean;
  down: boolean;
  think: number;
  /** Seconds stunned (harmless). */
  stun: number;
  /** Seconds in the sea before coming back. */
  gone: number;
}
interface Spinach {
  x: number;
  y: number;
  life: number;
}

export interface SlugState {
  grid: number[];
  me: Body & { alive: boolean; power: number; punch: number };
  brute: Brute;
  hearts: Heart[];
  spinach: Spinach;
  spinachTimer: number;
  heartTimer: number;
  caught: number;
  lost: number;
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

function world(s: SlugState): PlatWorld {
  return {
    solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= SEA || (ty >= 0 && s.grid[idx(tx, ty)] === FLOOR),
    ladder: (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && s.grid[idx(tx, ty)] === STAIR,
  };
}

function buildLevel(s: SlugState): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => 0);
  for (const f of FLOORS) for (let x = 0; x < COLS; x++) s.grid[idx(x, f)] = FLOOR;
  STAIRS.forEach((cols, g) => {
    for (const c of cols) for (let y = FLOORS[g]!; y < FLOORS[g + 1]!; y++) s.grid[idx(c, y)] = STAIR;
  });
  s.hearts = [];
  s.caught = 0;
  s.lost = 0;
  s.heartTimer = 1;
  s.spinach = { x: 0, y: 0, life: 0 };
  s.spinachTimer = 9;
  const b = newBody(24.5, FLOORS[0]!);
  b.onGround = true;
  s.brute = { b, dir: 0, up: false, down: false, think: 0, stun: 0, gone: 0 };
  Object.assign(s.me, newBody(2.5, FLOORS[2]!), { alive: true, power: 0, punch: 0 });
  s.me.onGround = true;
}

function init({ hiScore }: { rng: Rng; hiScore: number }): SlugState {
  const s: SlugState = {
    grid: [],
    me: { ...newBody(2.5, FLOORS[2]!), alive: true, power: 0, punch: 0 },
    brute: { b: newBody(24.5, FLOORS[0]!), dir: 0, up: false, down: false, think: 0, stun: 0, gone: 0 },
    hearts: [],
    spinach: { x: 0, y: 0, life: 0 },
    spinachTimer: 9,
    heartTimer: 1,
    caught: 0,
    lost: 0,
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

function loseLife(s: SlugState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  s.lost = 0;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: SlugState, input: Input, dt: number, ctx: UpdateContext): void {
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
  const w = world(s);
  const me = s.me;
  const br = s.brute;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newBody(2.5, FLOORS[2]!), { alive: true, power: 0, punch: 0 });
      me.onGround = true;
      if (Math.hypot(br.b.x - 2.5, br.b.y - FLOORS[2]!) < 6) br.stun = Math.max(br.stun, 2);
    }
  } else {
    me.power = Math.max(0, me.power - dt);
    me.punch = Math.max(0, me.punch - dt);
    stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: input.held.up, down: input.held.down, jump: false }, dt, CFG);
    if (input.pressed.a && me.punch <= 0) {
      me.punch = 0.25;
      emit('fire');
      // The fist reaches a little way ahead on the same floor.
      if (br.gone <= 0 && Math.abs(br.b.y - me.y) < 0.2 && (br.b.x - me.x) * me.face > -0.1 && Math.abs(br.b.x - me.x) < 1.6) {
        if (me.power > 0) {
          br.gone = 8;
          s.score += 1000;
          burst(s.sparks, rng, px(br.b.x), py(br.b.y), COLORS.gold, 16);
          emit('explode');
        } else {
          br.stun = 1.4;
          br.b.x += me.face * 0.8;
          emit('pickup');
        }
      }
    }
    if (s.spinach.life > 0 && Math.abs(s.spinach.x - me.x) < 0.8 && Math.abs(s.spinach.y - me.y) < 0.5) {
      s.spinach.life = 0;
      me.power = POWER_TIME;
      emit('wave');
    }
    // Catch hearts that fall past.
    for (let i = s.hearts.length - 1; i >= 0; i--) {
      const h = s.hearts[i]!;
      if (Math.abs(h.x - me.x) < 0.8 && h.y > me.y - 1.7 && h.y < me.y + 0.2) {
        s.hearts.splice(i, 1);
        s.caught += 1;
        s.score += 100 * Math.min(s.level, 5);
        emit('pickup');
      }
    }
  }

  // Hearts drift down toward the water.
  s.heartTimer -= dt;
  if (s.heartTimer <= 0 && s.caught + s.hearts.length < HEARTS_NEEDED) {
    s.heartTimer = Math.max(0.9, 1.9 - s.level * 0.1);
    s.hearts.push({ x: rng.int(2, COLS - 3) + 0.5, y: 1 });
  }
  for (let i = s.hearts.length - 1; i >= 0; i--) {
    const h = s.hearts[i]!;
    h.y += (2.8 + Math.min(s.level, 6) * 0.2) * dt;
    if (h.y >= SEA) {
      s.hearts.splice(i, 1);
      s.lost += 1;
      emit('die');
      if (s.lost >= MAX_LOST && me.alive) {
        loseLife(s, rng, emit);
        if (s.over) return;
      }
    }
  }

  // Spinach shows up now and then.
  s.spinachTimer -= dt;
  if (s.spinach.life > 0) s.spinach.life -= dt;
  if (s.spinachTimer <= 0) {
    s.spinachTimer = 18;
    const f = FLOORS[rng.int(0, 2)]!;
    s.spinach = { x: rng.int(2, COLS - 3) + 0.5, y: f, life: 10 };
  }

  // The bruiser chases the sailor over floors and stairs.
  if (br.gone > 0) {
    br.gone -= dt;
    if (br.gone <= 0) {
      br.b.x = 24.5;
      br.b.y = FLOORS[0]!;
      br.b.vy = 0;
      br.b.onGround = true;
      br.b.climbing = false;
    }
  } else if (br.stun > 0) {
    br.stun -= dt;
    stepBody(br.b, w, { dir: 0, up: false, down: false, jump: false }, dt, BRUTUS_CFG);
  } else {
    br.think -= dt;
    if (br.think <= 0 && me.alive) {
      br.think = 0.25;
      const step = pathStep(w, COLS, ROWS, { x: Math.floor(br.b.x), y: Math.floor(br.b.y - 0.01) }, { x: Math.floor(me.x), y: Math.floor(me.y - 0.01) });
      if (step) {
        br.dir = step.dir;
        br.up = step.up;
        br.down = step.down;
        if (br.b.climbing && step.dir !== 0 && !step.up && !step.down) {
          br.dir = 0;
          br.down = true;
        }
      } else {
        br.dir = rng.pick([-1, 1]);
        br.up = false;
        br.down = false;
      }
    }
    // Flee from a powered-up sailor? No: he just keeps coming, but slower.
    const speed = BRUTUS_CFG.walk + Math.min(s.level, 8) * 0.12 - (me.power > 0 ? 0.6 : 0);
    stepBody(br.b, w, { ...steerToLadder(br.b, { dir: br.dir, up: br.up, down: br.down }), jump: false }, dt, { ...BRUTUS_CFG, walk: speed });
    if (me.alive && Math.abs(br.b.x - me.x) < 0.7 && Math.abs(br.b.y - me.y) < 0.8) {
      if (me.power > 0) {
        br.gone = 8;
        s.score += 1000;
        burst(s.sparks, rng, px(br.b.x), py(br.b.y), COLORS.gold, 16);
        emit('explode');
      } else {
        loseLife(s, rng, emit);
        if (s.over) return;
      }
    }
  }

  if (s.caught >= HEARTS_NEEDED && s.levelDelay <= 0 && me.alive) {
    s.score += 1000;
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

function render(s: SlugState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = '#16385a';
  g.fillRect(OX, py(SEA), COLS * CELL, 80);
  for (let x = 0; x < COLS; x++) {
    g.fillStyle = 'rgba(79,227,214,0.25)';
    g.fillRect(px(x), py(SEA) + 2 + Math.sin(time * 3 + x) * 2, CELL - 4, 3);
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === FLOOR) {
        g.fillStyle = '#9b5a3c';
        g.fillRect(px(x), py(y), CELL, 10);
      } else if (c === STAIR) {
        g.fillStyle = COLORS.cyan;
        g.fillRect(px(x) + 7, py(y), 3, CELL);
        g.fillRect(px(x) + CELL - 10, py(y), 3, CELL);
        for (let r = 4; r < CELL; r += 8) g.fillRect(px(x) + 7, py(y) + r, CELL - 14, 2);
      }
    }
  }
  for (const h of s.hearts) {
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.arc(px(h.x) - 4, py(h.y) - 3, 5, 0, 6.3);
    g.arc(px(h.x) + 4, py(h.y) - 3, 5, 0, 6.3);
    g.fill();
    g.beginPath();
    g.moveTo(px(h.x) - 9, py(h.y));
    g.lineTo(px(h.x) + 9, py(h.y));
    g.lineTo(px(h.x), py(h.y) + 10);
    g.fill();
  }
  if (s.spinach.life > 0 && Math.floor(time * 6) % 2 === 0) {
    g.fillStyle = '#4fb36b';
    g.fillRect(px(s.spinach.x) - 8, py(s.spinach.y) - 18, 16, 18);
  }
  if (s.brute.gone <= 0) {
    const b = s.brute.b;
    g.fillStyle = s.brute.stun > 0 ? COLORS.muted : COLORS.purple;
    g.fillRect(px(b.x) - 12, py(b.y) - 32, 24, 32);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(b.x) - 6, py(b.y) - 26, 5, 5);
    g.fillRect(px(b.x) + 2, py(b.y) - 26, 5, 5);
  }
  if (s.me.alive) {
    g.fillStyle = s.me.power > 0 && Math.floor(time * 10) % 2 ? COLORS.gold : COLORS.paper;
    g.fillRect(px(s.me.x) - 9, py(s.me.y) - 26, 18, 26);
    g.fillStyle = COLORS.cyan;
    g.fillRect(px(s.me.x) - 10, py(s.me.y) - 30, 20, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 19, 3, 4);
    if (s.me.punch > 0) {
      g.fillStyle = COLORS.gold;
      g.fillRect(px(s.me.x) + s.me.face * 16 - 6, py(s.me.y) - 18, 14, 10);
    }
  }
  drawSparks(g, s.sparks);
  hud(g, s, `ROUND ${s.level}  HEARTS ${s.caught}/${HEARTS_NEEDED}  MISSED ${s.lost}/${MAX_LOST}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ROUND CLEAR!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<SlugState> = {
  id: 'sailor-slugger',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
