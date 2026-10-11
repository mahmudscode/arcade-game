import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, isFloor, newBody, pathStep, steerToLadder, stepBody, type Body, type Intent, type PathStep, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 16;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 92;
/** Standing heights of the floors (feet y); the last is the stone ground. Each floor is two bricks thick. */
const FLOORS = [2, 5, 8, 11, 14];
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const HOLE_TIME = 7;
const TRAP_TIME = 3.5;
const EMPTY = 0;
const BRICK = 1;
const STONE = 2;
const LADDER = 3;
const CFG: PlatConfig = { ...DEFAULT_PLAT, jump: 0, walk: 4.6, climb: 3.4, hw: 0.3 };
const GUARD_CFG: PlatConfig = { ...CFG, walk: 3.4, climb: 2.8 };

interface Hole {
  x: number;
  y: number;
  t: number;
}
interface Guard {
  b: Body;
  /** Seconds left stuck in a hole. */
  trapped: number;
  think: number;
  dir: number;
  up: boolean;
  down: boolean;
}

export interface RaiderState {
  grid: number[];
  holes: Hole[];
  gold: { x: number; y: number }[];
  /** True once every piece of gold is taken and the escape ladder has appeared. */
  open: boolean;
  me: Body & { alive: boolean; digCd: number };
  guards: Guard[];
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
const holeAt = (s: RaiderState, x: number, y: number) => s.holes.find((h) => h.x === x && h.y === y);

function world(s: RaiderState): PlatWorld {
  return {
    solid: (tx, ty) => {
      if (tx < 0 || tx >= COLS || ty >= ROWS) return true;
      if (ty < 0) return false;
      const c = s.grid[idx(tx, ty)];
      return c === STONE || (c === BRICK && !holeAt(s, tx, ty));
    },
    ladder: (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && s.grid[idx(tx, ty)] === LADDER,
  };
}

function buildLevel(s: RaiderState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => EMPTY);
  for (let x = 0; x < COLS; x++) {
    s.grid[idx(x, 14)] = STONE;
    s.grid[idx(x, 15)] = STONE;
    for (const f of FLOORS.slice(0, -1)) {
      s.grid[idx(x, f)] = BRICK;
      s.grid[idx(x, f + 1)] = BRICK;
    }
  }
  // Ladders between each pair of floors, in different columns, plus a few gaps in the bricks.
  const used = new Set<number>();
  for (let k = 0; k < FLOORS.length - 1; k++) {
    const count = 2 + (k % 2);
    for (let n = 0; n < count; n++) {
      let c = rng.int(2, COLS - 3);
      for (let tries = 0; used.has(c) && tries < 20; tries++) c = rng.int(2, COLS - 3);
      used.add(c);
      for (let y = FLOORS[k]!; y < FLOORS[k + 1]!; y++) s.grid[idx(c, y)] = LADDER;
    }
  }
  s.holes = [];
  s.open = false;
  s.gold = [];
  const want = Math.min(5 + s.level, 12);
  for (let tries = 0; s.gold.length < want && tries < 200; tries++) {
    const f = rng.pick(FLOORS);
    const x = rng.int(1, COLS - 2);
    if (s.grid[idx(x, f - 1)] !== EMPTY || s.gold.some((g) => g.x === x && g.y === f - 1) || x < 3) continue;
    s.gold.push({ x, y: f - 1 });
  }
  Object.assign(s.me, newBody(1.5, 14), { alive: true, digCd: 0 });
  s.me.onGround = true;
  s.guards = [];
  const guards = Math.min(2 + Math.floor(s.level / 2), 5);
  for (let g = 0; g < guards; g++) spawnGuard(s, rng, true);
}

function spawnGuard(s: RaiderState, rng: Rng, farFromPlayer: boolean): void {
  for (let tries = 0; tries < 60; tries++) {
    const f = rng.pick(FLOORS.slice(0, 4));
    const x = rng.int(2, COLS - 3);
    if (s.grid[idx(x, f - 1)] !== EMPTY || s.grid[idx(x, f)] === LADDER || (farFromPlayer && Math.hypot(x - s.me.x, f - s.me.y) < 9)) continue;
    const b = newBody(x + 0.5, f);
    b.onGround = true;
    s.guards.push({ b, trapped: 0, think: rng.range(0, 0.3), dir: 0, up: false, down: false });
    return;
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RaiderState {
  const s: RaiderState = {
    grid: [],
    holes: [],
    gold: [],
    open: false,
    me: { ...newBody(1.5, 14), alive: true, digCd: 0 },
    guards: [],
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

function guardStep(s: RaiderState, w: PlatWorld, fx: number, fy: number, tx: number, ty: number): PathStep | null {
  return pathStep(w, COLS, ROWS, { x: fx, y: fy }, { x: tx, y: ty }, (x, r, push) => {
    // A guard in a pit can scramble out to either side.
    if (holeAt(s, x, r + 1) === undefined && holeAt(s, x, r)) {
      for (const dx of [-1, 1]) if (!w.solid(x + dx, r - 1) && isFloor(w, x + dx, r)) push(x + dx, r - 1);
    }
  });
}

function loseLife(s: RaiderState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: RaiderState, input: Input, dt: number, ctx: UpdateContext): void {
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
      Object.assign(me, newBody(1.5, 14), { alive: true, digCd: 0 });
      me.onGround = true;
      for (const g of s.guards) {
        if (Math.hypot(g.b.x - 1.5, g.b.y - 14) < 6) {
          g.b.x = 20.5;
          g.b.y = 2;
        }
      }
    }
  } else {
    me.digCd = Math.max(0, me.digCd - dt);
    const intent: Intent = { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: input.held.up, down: input.held.down, jump: false };
    // Standing in a pit you dug: press up to scramble out onto the floor.
    const pit = holeAt(s, Math.floor(me.x), Math.floor(me.y - 0.05));
    if (pit && me.onGround && input.held.up) {
      // Scramble out onto the floor beside the pit, so the feet are over solid brick.
      me.x = pit.x + 0.5 + (me.face >= 0 ? 0.85 : -0.85);
      me.y = pit.y;
      me.onGround = true;
    }
    stepBody(me, w, intent, dt, CFG);

    // Dig a pit diagonally in front of the feet.
    const dig = input.pressed.a ? -1 : input.pressed.b ? 1 : 0;
    if (dig !== 0 && me.digCd <= 0 && me.onGround && !me.climbing) {
      const tx = Math.floor(me.x) + dig;
      const ty = Math.round(me.y);
      if (s.grid[idx(tx, ty)] === BRICK && !holeAt(s, tx, ty) && !w.solid(tx, ty - 1)) {
        s.holes.push({ x: tx, y: ty, t: HOLE_TIME });
        me.digCd = 0.35;
        burst(s.sparks, rng, px(tx + 0.5), py(ty), COLORS.gold, 6);
        emit('fire');
      }
    }

    for (let i = s.gold.length - 1; i >= 0; i--) {
      const g = s.gold[i]!;
      if (Math.abs(g.x + 0.5 - me.x) < 0.6 && Math.abs(g.y + 0.5 - (me.y - 0.45)) < 0.6) {
        s.gold.splice(i, 1);
        s.score += 250;
        emit('pickup');
      }
    }
    if (!s.open && s.gold.length === 0) {
      // The way out appears on the highest floor.
      s.open = true;
      for (let y = 0; y <= 1; y++) s.grid[idx(14, y)] = LADDER;
      emit('wave');
    }
    if (s.open && me.y <= 0.2) {
      s.score += 500 + s.level * 100;
      s.levelDelay = 1.4;
      emit('wave');
    }
  }

  // Holes refill; whoever is inside is lost.
  for (let i = s.holes.length - 1; i >= 0; i--) {
    const h = s.holes[i]!;
    h.t -= dt;
    if (h.t > 0) continue;
    s.holes.splice(i, 1);
    for (let k = s.guards.length - 1; k >= 0; k--) {
      const g = s.guards[k]!;
      if (Math.floor(g.b.x) === h.x && Math.floor(g.b.y - 0.05) === h.y) {
        s.score += 75;
        burst(s.sparks, rng, px(g.b.x), py(g.b.y), COLORS.coral, 12);
        s.guards.splice(k, 1);
        spawnGuard(s, rng, false);
        const born = s.guards[s.guards.length - 1];
        if (born) {
          born.b.x = 2 + rng.int(0, COLS - 4) + 0.5;
          born.b.y = 2;
          born.b.onGround = false;
        }
        emit('explode');
      }
    }
    if (me.alive && Math.floor(me.x) === h.x && Math.floor(me.y - 0.05) === h.y) loseLife(s, rng, emit);
  }

  // Guards.
  for (const g of s.guards) {
    const b = g.b;
    if (g.trapped > 0) {
      g.trapped -= dt;
      if (g.trapped <= 0) {
        // Climb out onto the floor, toward the player.
        b.y = Math.floor(b.y - 0.05);
        b.x = Math.floor(b.x) + 0.5 + Math.sign(me.x - b.x || 1) * 0.6;
        b.onGround = true;
      }
      continue;
    }
    const inPit = !!holeAt(s, Math.floor(b.x), Math.floor(b.y - 0.05)) && b.onGround;
    if (inPit) {
      g.trapped = TRAP_TIME;
      b.vx = 0;
      continue;
    }
    g.think -= dt;
    if (g.think <= 0 && me.alive) {
      g.think = 0.18;
      const step = guardStep(s, w, Math.floor(b.x), Math.floor(b.y - 0.01), Math.floor(me.x), Math.floor(me.y - 0.01));
      if (step) {
        g.dir = step.dir;
        g.up = step.up;
        g.down = step.down;
        // Still on a ladder but the route says "sideways": finish the climb first.
        if (b.climbing && step.dir !== 0 && !step.up && !step.down) {
          g.dir = 0;
          const floorBelow = isFloor(w, Math.floor(b.x), Math.floor(b.y - 0.01) + 1);
          g.down = floorBelow;
          g.up = !floorBelow;
        }
      } else {
        g.dir = rng.pick([-1, 0, 1]);
        g.up = false;
        g.down = false;
      }
    }
    stepBody(b, w, { ...steerToLadder(b, { dir: g.dir, up: g.up, down: g.down }), jump: false }, dt, GUARD_CFG);
    if (me.alive && Math.abs(b.x - me.x) < 0.55 && Math.abs(b.y - me.y) < 0.8) loseLife(s, rng, emit);
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: RaiderState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      const X = px(x);
      const Y = py(y);
      if (c === BRICK && !holeAt(s, x, y)) {
        g.fillStyle = '#9b5a3c';
        g.fillRect(X + 1, Y + 1, CELL - 2, CELL - 2);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(X + 1, Y + CELL / 2, CELL - 2, 2);
        g.fillRect(X + CELL / 2, Y + 1, 2, CELL / 2);
      } else if (c === STONE) {
        g.fillStyle = COLORS.purple;
        g.fillRect(X + 1, Y + 1, CELL - 2, CELL - 2);
      } else if (c === LADDER) {
        g.fillStyle = COLORS.cyan;
        g.fillRect(X + 6, Y, 3, CELL);
        g.fillRect(X + CELL - 9, Y, 3, CELL);
        for (let r = 4; r < CELL; r += 8) g.fillRect(X + 6, Y + r, CELL - 12, 2);
      }
    }
  }
  for (const h of s.holes) {
    if (h.t < 1.5 && Math.floor(time * 10) % 2) {
      g.fillStyle = 'rgba(155,90,60,0.5)';
      g.fillRect(px(h.x) + 1, py(h.y) + 1, CELL - 2, CELL - 2);
    }
  }
  for (const gd of s.gold) {
    g.fillStyle = COLORS.gold;
    g.fillRect(px(gd.x) + 7, py(gd.y) + 14, CELL - 14, CELL - 16);
    g.fillStyle = COLORS.paper;
    g.fillRect(px(gd.x) + 9, py(gd.y) + 16, 4, 3);
  }
  for (const gu of s.guards) {
    g.fillStyle = gu.trapped > 0 ? COLORS.muted : COLORS.coral;
    g.fillRect(px(gu.b.x) - 8, py(gu.b.y) - 22, 16, 22);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(gu.b.x) - 5, py(gu.b.y) - 18, 4, 4);
    g.fillRect(px(gu.b.x) + 2, py(gu.b.y) - 18, 4, 4);
  }
  if (s.me.alive) {
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 22, 16, 22);
    g.fillStyle = COLORS.cyan;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 22, 16, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 14, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  GOLD ${s.gold.length}`, s.lives);
  if (s.open && s.levelDelay <= 0) banner(g, 'CLIMB TO THE TOP!', 56);
  if (s.levelDelay > 0) banner(g, 'ESCAPED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<RaiderState> = {
  id: 'gold-raider',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
