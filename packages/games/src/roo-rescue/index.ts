import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, pathStep, steerToLadder, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 54;
/** Feet heights of the floors, bottom to top. */
const FLOORS = [16, 12, 8, 4];
const START_LIVES = 3;
const BONUS_START = 4000;
const EXTRA_LIFE_EVERY = 20000;
const PUNCH_TIME = 0.22;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 4.6, climb: 3.4, jump: 13 };
const MONKEY_CFG: PlatConfig = { ...CFG, jump: 0, walk: 2.3, climb: 2.4 };
const SOLID = 1;
const LADDER = 2;
const GOAL = { x: 25.5, y: FLOORS[FLOORS.length - 1]! };

interface Monkey {
  b: Body;
  dir: number;
  up: boolean;
  down: boolean;
  think: number;
  cd: number;
  /** Seconds before it comes back after being knocked out. */
  gone: number;
}
interface Apple {
  x: number;
  y: number;
  dir: number;
}

export interface RooState {
  grid: number[];
  me: Body & { alive: boolean; punch: number };
  monkeys: Monkey[];
  apples: Apple[];
  sparks: Spark[];
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

function world(s: RooState): PlatWorld {
  return {
    solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= ROWS || (ty >= 0 && s.grid[idx(tx, ty)] === SOLID),
    ladder: (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && s.grid[idx(tx, ty)] === LADDER,
  };
}

function buildLevel(s: RooState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => 0);
  for (const f of FLOORS) for (let x = 0; x < COLS; x++) s.grid[idx(x, f)] = SOLID;
  for (let k = 0; k < FLOORS.length - 1; k++) {
    const lower = FLOORS[k]!;
    const upper = FLOORS[k + 1]!;
    const used = new Set<number>();
    for (let n = 0; n < 2; n++) {
      let c = rng.int(3, COLS - 4);
      for (let t = 0; used.has(c) && t < 10; t++) c = rng.int(3, COLS - 4);
      used.add(c);
      for (let y = upper; y < lower; y++) s.grid[idx(c, y)] = LADDER;
    }
  }
  s.monkeys = [];
  const count = Math.min(2 + Math.floor(s.level / 2), 4);
  for (let m = 0; m < count; m++) {
    const f = FLOORS[1 + (m % 3)]!;
    const b = newBody(rng.range(6, 22), f);
    b.onGround = true;
    s.monkeys.push({ b, dir: rng.pick([-1, 1]), up: false, down: false, think: rng.range(0, 0.5), cd: rng.range(1.5, 3), gone: 0 });
  }
  s.apples = [];
  s.bonus = BONUS_START;
  s.bonusTimer = 0;
  Object.assign(s.me, newBody(2.5, FLOORS[0]!), { alive: true, punch: 0 });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RooState {
  const s: RooState = {
    grid: [],
    me: { ...newBody(2.5, FLOORS[0]!), alive: true, punch: 0 },
    monkeys: [],
    apples: [],
    sparks: [],
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

function loseLife(s: RooState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  s.apples = s.apples.filter((a) => Math.abs(a.x - 2.5) > 4 || Math.abs(a.y - FLOORS[0]!) > 1);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: RooState, input: Input, dt: number, ctx: UpdateContext): void {
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
    if (s.respawn <= 0) {
      Object.assign(me, newBody(2.5, FLOORS[0]!), { alive: true, punch: 0 });
      me.onGround = true;
    }
  } else {
    me.punch = Math.max(0, me.punch - dt);
    // A: punch, B / Up-jump: jump. Climbing uses Up/Down on a ladder.
    const nearLadder = w.ladder?.(Math.floor(me.x), Math.floor(me.y - 0.01)) || w.ladder?.(Math.floor(me.x), Math.floor(me.y + 0.01));
    const jump = input.pressed.b || (input.pressed.up && !nearLadder);
    stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: input.held.up, down: input.held.down, jump }, dt, CFG);
    if (input.pressed.a && me.punch <= 0) {
      me.punch = PUNCH_TIME;
      emit('fire');
    }
    // The fist reaches a little in front of the hero.
    if (me.punch > 0) {
      const reachX = (e: { x: number }) => (e.x - me.x) * me.face > -0.2 && Math.abs(e.x - me.x) < 1.5;
      for (let i = s.apples.length - 1; i >= 0; i--) {
        const a = s.apples[i]!;
        if (reachX(a) && Math.abs(a.y - me.y) < 1) {
          s.apples.splice(i, 1);
          s.score += 200;
          emit('pickup');
        }
      }
      for (const m of s.monkeys) {
        if (m.gone <= 0 && reachX(m.b) && Math.abs(m.b.y - me.y) < 1) {
          m.gone = 8;
          s.score += 800;
          burst(s.sparks, rng, px(m.b.x), py(m.b.y), COLORS.gold, 12);
          emit('explode');
        }
      }
    }
  }

  // Monkeys: chase over floors and ladders, and throw apples along the floor.
  for (const m of s.monkeys) {
    const b = m.b;
    if (m.gone > 0) {
      m.gone -= dt;
      if (m.gone <= 0) {
        b.x = rng.pick([6.5, 22.5]);
        b.y = FLOORS[3]!;
        b.vy = 0;
        b.onGround = true;
        b.climbing = false;
      }
      continue;
    }
    m.think -= dt;
    if (m.think <= 0 && me.alive) {
      m.think = 0.35;
      const sameFloor = Math.abs(b.y - me.y) < 0.1;
      if (sameFloor) {
        m.dir = Math.abs(b.x - me.x) > 5 ? Math.sign(me.x - b.x) : rng.pick([-1, 1, 0]);
        m.up = false;
        m.down = false;
      } else {
        const step = pathStep(w, COLS, ROWS, { x: Math.floor(b.x), y: Math.floor(b.y - 0.01) }, { x: Math.floor(me.x), y: Math.floor(me.y - 0.01) });
        if (step) {
          m.dir = step.dir;
          m.up = step.up;
          m.down = step.down;
          if (b.climbing && step.dir !== 0 && !step.up && !step.down) {
            m.dir = 0;
            m.down = true;
          }
        } else {
          m.dir = rng.pick([-1, 1]);
          m.up = false;
          m.down = false;
        }
      }
    }
    stepBody(b, w, { ...steerToLadder(b, { dir: m.dir, up: m.up, down: m.down }), jump: false }, dt, { ...MONKEY_CFG, walk: MONKEY_CFG.walk + Math.min(s.level, 8) * 0.1 });
    m.cd -= dt;
    if (m.cd <= 0 && me.alive && Math.abs(b.y - me.y) < 0.1 && Math.abs(b.x - me.x) < 12 && !b.climbing) {
      s.apples.push({ x: b.x, y: b.y, dir: Math.sign(me.x - b.x) || 1 });
      m.cd = Math.max(1.6, 3.6 - s.level * 0.2) + rng.range(0, 1);
    }
    if (me.alive && Math.abs(b.x - me.x) < 0.6 && Math.abs(b.y - me.y) < 0.8 && me.punch <= 0) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }
  for (let i = s.apples.length - 1; i >= 0; i--) {
    const a = s.apples[i]!;
    a.x += a.dir * 6.2 * dt;
    if (a.x < -1 || a.x > COLS + 1) {
      s.apples.splice(i, 1);
      continue;
    }
    if (me.alive && Math.abs(a.x - me.x) < 0.5 && Math.abs(a.y - me.y) < 0.8) {
      s.apples.splice(i, 1);
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  s.bonusTimer += dt;
  if (s.bonusTimer >= 1) {
    s.bonusTimer -= 1;
    s.bonus = Math.max(0, s.bonus - 80);
  }
  if (me.alive && Math.abs(me.x - GOAL.x) < 1.3 && Math.abs(me.y - GOAL.y) < 0.2) {
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

function render(s: RooState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === SOLID) {
        g.fillStyle = '#9b5a3c';
        g.fillRect(px(x) + 1, py(y), CELL - 2, 10);
      } else if (c === LADDER) {
        g.fillStyle = COLORS.cyan;
        g.fillRect(px(x) + 7, py(y), 3, CELL);
        g.fillRect(px(x) + CELL - 10, py(y), 3, CELL);
        for (let r = 4; r < CELL; r += 8) g.fillRect(px(x) + 7, py(y) + r, CELL - 14, 2);
      }
    }
  }
  g.fillStyle = Math.floor(time * 3) % 2 ? COLORS.gold : COLORS.paper;
  g.fillRect(px(GOAL.x) - 7, py(GOAL.y) - 18, 14, 18);
  for (const m of s.monkeys) {
    if (m.gone > 0) continue;
    g.fillStyle = '#c47a3a';
    g.fillRect(px(m.b.x) - 10, py(m.b.y) - 22, 20, 22);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(m.b.x) - 5, py(m.b.y) - 17, 4, 4);
    g.fillRect(px(m.b.x) + 2, py(m.b.y) - 17, 4, 4);
  }
  for (const a of s.apples) {
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.arc(px(a.x), py(a.y) - 7, 7, 0, 6.3);
    g.fill();
  }
  if (s.me.alive) {
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 24, 16, 24);
    g.fillStyle = COLORS.gold;
    g.fillRect(px(s.me.x) - 6, py(s.me.y) - 30, 4, 7);
    g.fillRect(px(s.me.x) + 2, py(s.me.y) - 30, 4, 7);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 18, 3, 4);
    if (s.me.punch > 0) {
      g.fillStyle = COLORS.coral;
      g.fillRect(px(s.me.x) + s.me.face * 14 - 6, py(s.me.y) - 16, 14, 10);
    }
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  BONUS ${s.bonus}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'JOEY RESCUED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<RooState> = {
  id: 'roo-rescue',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
