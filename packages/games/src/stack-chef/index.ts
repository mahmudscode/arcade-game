import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, pathStep, steerToLadder, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 60;
/** Feet heights of the floors; the last is the tray the burgers are built on. */
const FLOORS = [3, 6, 9, 12, 15];
const BURGER_X = [3, 9, 15, 21];
const SEGS = 4;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const FALL_SPEED = 7;
const PEPPERS = 5;
const CFG: PlatConfig = { ...DEFAULT_PLAT, jump: 0, walk: 4.4, climb: 3.4, hw: 0.3 };
const ENEMY_CFG: PlatConfig = { ...CFG, walk: 2.9, climb: 2.5 };
/** Ladder columns for each gap between floors. */
const LADDERS: number[][] = [[1, 8, 14, 20, 26], [2, 7, 13, 19, 25], [1, 8, 14, 20, 26], [2, 7, 13, 19, 25]];
const FLOOR = 1;
const LADDER = 2;
const COLORS_BY_LAYER = ['#e6a64b', '#7BE495', '#9b4a2f', '#e6a64b'];

interface Layer {
  burger: number;
  /** Which of the four layers of this burger (0 = top bun ... 3 = bottom bun). */
  k: number;
  /** Floor slot (index into FLOORS) the layer rests on, or the slot it is falling toward. */
  slot: number;
  /** Surface height (like feet y). */
  y: number;
  state: 'rest' | 'fall' | 'done';
  stepped: boolean[];
}
interface Foe {
  b: Body;
  kind: number;
  stun: number;
  dead: number;
  think: number;
  dir: number;
  up: boolean;
  down: boolean;
}

export interface ChefState {
  grid: number[];
  me: Body & { alive: boolean; pepper: number };
  layers: Layer[];
  /** Layers stacked on each burger's tray. */
  stack: number[];
  foes: Foe[];
  puff: { x: number; y: number; t: number };
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

function world(s: ChefState): PlatWorld {
  return {
    solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= ROWS || (ty >= 0 && s.grid[idx(tx, ty)] === FLOOR),
    ladder: (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && s.grid[idx(tx, ty)] === LADDER,
  };
}

function buildLevel(s: ChefState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => 0);
  for (const f of FLOORS) for (let x = 0; x < COLS; x++) s.grid[idx(x, f)] = FLOOR;
  LADDERS.forEach((cols, g) => {
    for (const c of cols) for (let y = FLOORS[g]!; y < FLOORS[g + 1]!; y++) s.grid[idx(c, y)] = LADDER;
  });
  s.layers = [];
  for (let b = 0; b < BURGER_X.length; b++) {
    for (let k = 0; k < 4; k++) s.layers.push({ burger: b, k, slot: k, y: FLOORS[k]!, state: 'rest', stepped: Array.from({ length: SEGS }, () => false) });
  }
  s.stack = BURGER_X.map(() => 0);
  s.foes = [];
  const foes = Math.min(3 + Math.floor(s.level / 2), 6);
  for (let f = 0; f < foes; f++) {
    const b = newBody(f % 2 === 0 ? 1.5 : 26.5, FLOORS[f % 3]!);
    b.onGround = true;
    s.foes.push({ b, kind: f % 3, stun: 0, dead: 0, think: rng.range(0, 0.4), dir: 0, up: false, down: false });
  }
  Object.assign(s.me, newBody(14, FLOORS[4]!), { alive: true, pepper: PEPPERS });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): ChefState {
  const s: ChefState = {
    grid: [],
    me: { ...newBody(14, FLOORS[4]!), alive: true, pepper: PEPPERS },
    layers: [],
    stack: [],
    foes: [],
    puff: { x: 0, y: 0, t: 0 },
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

const layerAt = (s: ChefState, burger: number, slot: number) => s.layers.find((l) => l.burger === burger && l.slot === slot && l.state === 'rest');

function loseLife(s: ChefState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** Sends a layer down: it falls until the slot below is free or it reaches the tray. */
function dropLayer(l: Layer): void {
  l.state = 'fall';
  l.stepped = l.stepped.map(() => true);
}

function update(s: ChefState, input: Input, dt: number, ctx: UpdateContext): void {
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
  s.puff.t = Math.max(0, s.puff.t - dt);
  const w = world(s);
  const me = s.me;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newBody(14, FLOORS[4]!), { alive: true });
      me.onGround = true;
      for (const f of s.foes) if (Math.hypot(f.b.x - 14, f.b.y - FLOORS[4]!) < 6) f.stun = Math.max(f.stun, 1.5);
    }
  } else {
    stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: input.held.up, down: input.held.down, jump: false }, dt, CFG);

    // Walking over a layer's segments pushes them down.
    const slot = FLOORS.findIndex((f) => Math.abs(f - me.y) < 0.02);
    if (slot >= 0 && me.onGround) {
      const tx = Math.floor(me.x);
      BURGER_X.forEach((bx, b) => {
        const l = layerAt(s, b, slot);
        if (l && tx >= bx && tx < bx + SEGS && !l.stepped[tx - bx]) {
          l.stepped[tx - bx] = true;
          s.score += 10;
          if (l.stepped.every(Boolean)) dropLayer(l);
        }
      });
    }

    // Pepper stuns foes ahead on the same floor.
    if (input.pressed.a && me.pepper > 0 && me.onGround && s.puff.t <= 0) {
      me.pepper -= 1;
      s.puff = { x: me.x + me.face * 1.4, y: me.y, t: 0.35 };
      for (const f of s.foes) {
        if (f.dead <= 0 && Math.abs(f.b.y - me.y) < 0.05 && (f.b.x - me.x) * me.face > 0 && Math.abs(f.b.x - me.x) < 2.6) f.stun = 4;
      }
      emit('fire');
    }
  }

  // Falling layers.
  for (const l of s.layers) {
    if (l.state !== 'fall') continue;
    l.y += FALL_SPEED * dt;
    const target = l.slot + 1;
    const floorY = FLOORS[Math.min(target, FLOORS.length - 1)]!;
    // Foes caught under it are squashed.
    for (const f of s.foes) {
      if (f.dead > 0) continue;
      const x = BURGER_X[l.burger]!;
      if (f.b.x >= x - 0.2 && f.b.x <= x + SEGS + 0.2 && Math.abs(f.b.y - l.y) < 0.9) {
        f.dead = 6;
        s.score += 500;
        burst(s.sparks, rng, px(f.b.x), py(f.b.y), COLORS.gold, 12);
        emit('explode');
      }
    }
    if (l.y >= floorY) {
      l.y = floorY;
      l.slot = target;
      if (target >= FLOORS.length - 1) {
        // Onto the tray: stacks above whatever is already there.
        l.state = 'done';
        s.stack[l.burger] = (s.stack[l.burger] ?? 0) + 1;
        s.score += 100;
        emit('pickup');
        if (s.stack[l.burger] === 4) {
          s.score += 1000;
          emit('wave');
        }
      } else {
        const below = layerAt(s, l.burger, target);
        if (below) {
          // Land on a resting layer and knock it down in turn.
          dropLayer(below);
          s.score += 50;
        }
        l.state = 'rest';
        l.stepped = l.stepped.map(() => false);
        emit('pickup');
      }
    }
  }

  // Foes: chase the chef, or wait out a stun or a respawn.
  for (const f of s.foes) {
    const b = f.b;
    if (f.dead > 0) {
      f.dead -= dt;
      if (f.dead <= 0) {
        b.x = rng.next() < 0.5 ? 1.5 : 26.5;
        b.y = FLOORS[0]!;
        b.vy = 0;
        b.onGround = true;
        b.climbing = false;
      }
      continue;
    }
    if (f.stun > 0) {
      f.stun -= dt;
      stepBody(b, w, { dir: 0, up: false, down: false, jump: false }, dt, ENEMY_CFG);
      continue;
    }
    f.think -= dt;
    if (f.think <= 0 && me.alive) {
      f.think = 0.2;
      const step = pathStep(w, COLS, ROWS, { x: Math.floor(b.x), y: Math.floor(b.y - 0.01) }, { x: Math.floor(me.x), y: Math.floor(me.y - 0.01) });
      if (step) {
        f.dir = step.dir;
        f.up = step.up;
        f.down = step.down;
        if (b.climbing && step.dir !== 0 && !step.up && !step.down) {
          // Finish the climb before stepping off.
          f.dir = 0;
          f.down = true;
        }
      } else {
        f.dir = rng.pick([-1, 0, 1]);
        f.up = false;
        f.down = false;
      }
    }
    stepBody(b, w, { ...steerToLadder(b, { dir: f.dir, up: f.up, down: f.down }), jump: false }, dt, { ...ENEMY_CFG, walk: ENEMY_CFG.walk + Math.min(s.level, 8) * 0.12 });
    if (me.alive && Math.abs(b.x - me.x) < 0.6 && Math.abs(b.y - me.y) < 0.8) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  if (s.stack.every((n) => n === 4) && s.levelDelay <= 0 && me.alive) {
    s.score += 2000;
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

function render(s: ChefState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === FLOOR) {
        g.fillStyle = COLORS.purple;
        g.fillRect(px(x), py(y), CELL, 8);
      } else if (c === LADDER) {
        g.fillStyle = COLORS.cyan;
        g.fillRect(px(x) + 7, py(y), 3, CELL);
        g.fillRect(px(x) + CELL - 10, py(y), 3, CELL);
        for (let r = 4; r < CELL; r += 8) g.fillRect(px(x) + 7, py(y) + r, CELL - 14, 2);
      }
    }
  }
  // Trays.
  for (const bx of BURGER_X) {
    g.fillStyle = COLORS.paper;
    g.fillRect(px(bx), py(FLOORS[4]!) + 8, SEGS * CELL, 6);
  }
  for (const l of s.layers) {
    const bx = BURGER_X[l.burger]!;
    // Done layers pile up on the tray.
    const lift = l.state === 'done' ? (l.k === 3 ? 0 : 0) : 0;
    const stackIndex = l.state === 'done' ? s.layers.filter((o) => o.burger === l.burger && o.state === 'done' && s.layers.indexOf(o) <= s.layers.indexOf(l)).length - 1 : 0;
    const y = l.state === 'done' ? py(FLOORS[4]!) - 6 - stackIndex * 9 : py(l.y) - 9 + lift;
    for (let j = 0; j < SEGS; j++) {
      g.fillStyle = COLORS_BY_LAYER[l.k]!;
      g.fillRect(px(bx + j) + 1, y + (l.stepped[j] && l.state === 'rest' ? 4 : 0), CELL - 2, 8);
    }
  }
  for (const f of s.foes) {
    if (f.dead > 0) continue;
    const x = px(f.b.x);
    const y = py(f.b.y);
    g.fillStyle = f.stun > 0 ? COLORS.muted : f.kind === 0 ? COLORS.coral : f.kind === 1 ? '#7BE495' : COLORS.paper;
    g.fillRect(x - 8, y - 22, 16, 22);
    g.fillStyle = COLORS.bg;
    g.fillRect(x - 5, y - 17, 4, 4);
    g.fillRect(x + 2, y - 17, 4, 4);
  }
  if (s.me.alive) {
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 22, 16, 22);
    g.fillStyle = COLORS.gold;
    g.fillRect(px(s.me.x) - 9, py(s.me.y) - 26, 18, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 15, 3, 4);
  }
  if (s.puff.t > 0) {
    g.fillStyle = 'rgba(246,239,255,0.6)';
    g.fillRect(px(s.puff.x) - 14, py(s.puff.y) - 20, 28, 18);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  PEPPER ${s.me.pepper}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ORDER UP!', 270);
  void time;
  gameOver(g, s.over);
}

const game: GameDefinition<ChefState> = {
  id: 'stack-chef',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
