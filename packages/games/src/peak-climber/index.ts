import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 24;
const CELL = 30;
const OX = (W - COLS * CELL) / 2;
const SPACING = 3;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 4.6, jump: 16.5, air: 1 };
const SEAL_CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 1.6, jump: 0 };
const EMPTY = 0;
const BRICK = 1;
const ICE = 2;
const GROUND_ROW = 0;

interface Seal {
  b: Body;
  dir: number;
  dead: number;
}
interface Bird {
  x: number;
  y: number;
  dir: number;
}

export interface PeakState {
  /** rows * COLS tiles; row 0 is the ground, rows increase going UP the mountain. */
  grid: number[];
  rows: number;
  me: Body & { alive: boolean; swing: number; invuln: number };
  seals: Seal[];
  birds: Bird[];
  birdTimer: number;
  sealTimer: number;
  best: number;
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

/** Floor f (0 = ground) stands at feet y = -f * SPACING (so up is negative y, like everything else). */
const floorY = (f: number) => -f * SPACING;
const idx = (x: number, f: number) => f * COLS + x;
const sx = (x: number) => OX + x * CELL;

function world(s: PeakState): PlatWorld {
  return {
    solid: (tx, ty) => {
      if (tx < 0 || tx >= COLS) return true;
      // Tile row ty holds floor f when ty === -f*SPACING (the floor's top edge is its feet height).
      if (ty > 0) return true; // below the ground
      if (ty === 0) return true;
      if (-ty % SPACING !== 0) return false;
      const f = -ty / SPACING;
      if (f < 0 || f >= s.rows) return false;
      const c = s.grid[idx(tx, f)];
      return c === BRICK || c === ICE;
    },
  };
}

function buildMountain(s: PeakState, rng: Rng): void {
  s.rows = Math.min(7 + s.level, 11);
  s.grid = Array.from({ length: s.rows * COLS }, () => EMPTY);
  for (let f = 1; f < s.rows; f++) {
    for (let x = 0; x < COLS; x++) s.grid[idx(x, f)] = BRICK;
    // Gaps already open in each floor, in different places.
    for (let g = 0; g < 2; g++) {
      const gx = rng.int(2, COLS - 4);
      s.grid[idx(gx, f)] = EMPTY;
      s.grid[idx(gx + 1, f)] = EMPTY;
    }
  }
  s.seals = [];
  s.birds = [];
  s.birdTimer = 6;
  s.sealTimer = 2;
  s.best = 0;
  Object.assign(s.me, newBody(COLS / 2, 0), { alive: true, swing: 0, invuln: 1.5 });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): PeakState {
  const s: PeakState = {
    grid: [],
    rows: 8,
    me: { ...newBody(COLS / 2, 0), alive: true, swing: 0, invuln: 1.5 },
    seals: [],
    birds: [],
    birdTimer: 6,
    sealTimer: 2,
    best: 0,
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
  buildMountain(s, rng);
  return s;
}

function loseLife(s: PeakState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, sx(s.me.x), 400, COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** The floor index the hero is standing on (or nearest below). */
const heroFloor = (s: PeakState) => Math.max(0, Math.floor(-s.me.y / SPACING + 0.001));

function update(s: PeakState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildMountain(s, rng);
      emit('wave');
    }
    return;
  }
  const w = world(s);
  const me = s.me;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      // Back on the floor you had reached, in the middle of an open stretch.
      const f = Math.min(s.best, s.rows - 1);
      let x = COLS / 2;
      while (x < COLS - 1 && f > 0 && s.grid[idx(Math.floor(x), f)] === EMPTY) x += 1;
      Object.assign(me, newBody(Math.floor(x) + 0.5, floorY(f)), { alive: true, swing: 0, invuln: 2.2 });
      me.onGround = true;
    }
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    me.swing = Math.max(0, me.swing - dt);
    const r = stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: false, down: false, jump: input.pressed.b || input.pressed.up }, dt, CFG);
    // Jumping into a floor knocks bricks out of it.
    if (r.bumped) {
      const f = -r.bumped.ty / SPACING;
      if (Number.isInteger(f) && f >= 1 && f < s.rows && s.grid[idx(r.bumped.tx, f)] === BRICK) {
        s.grid[idx(r.bumped.tx, f)] = EMPTY;
        s.score += 10;
        burst(s.sparks, rng, sx(r.bumped.tx + 0.5), 300, COLORS.cyan, 5);
        emit('pickup');
      } else if (Number.isInteger(f) && s.grid[idx(r.bumped.tx, f)] === ICE) {
        s.grid[idx(r.bumped.tx, f)] = EMPTY;
        emit('pickup');
      }
    }
    if (me.y > 4) loseLife(s, rng, emit);
    if (me.onGround) {
      const f = Math.round(-me.y / SPACING);
      if (Math.abs(me.y - floorY(f)) < 0.01 && f > s.best) {
        s.score += 100 * (f - s.best);
        s.best = f;
        emit('wave');
      }
    }
    if (input.pressed.a && me.swing <= 0) {
      me.swing = 0.22;
      emit('fire');
      for (const sl of s.seals) {
        if (sl.dead <= 0 && Math.abs(sl.b.y - me.y) < 0.2 && (sl.b.x - me.x) * me.face > -0.2 && Math.abs(sl.b.x - me.x) < 1.7) {
          sl.dead = 5;
          s.score += 400;
          burst(s.sparks, rng, sx(sl.b.x), 300, COLORS.gold, 8);
          emit('explode');
        }
      }
      for (let i = s.birds.length - 1; i >= 0; i--) {
        const b = s.birds[i]!;
        if (Math.abs(b.y - (me.y - 1)) < 1.2 && (b.x - me.x) * me.face > -0.2 && Math.abs(b.x - me.x) < 1.9) {
          s.birds.splice(i, 1);
          s.score += 800;
          emit('explode');
        }
      }
    }
  }

  // Seals walk the floors and fill holes with ice.
  s.sealTimer -= dt;
  if (s.sealTimer <= 0 && s.seals.length < 2 + s.level) {
    s.sealTimer = Math.max(3, 7 - s.level * 0.5);
    const f = Math.min(s.rows - 1, Math.max(0, heroFloor(s) + rng.int(-1, 1)));
    const b = newBody(rng.pick([2.5, COLS - 2.5]), floorY(f));
    b.onGround = true;
    s.seals.push({ b, dir: b.x < COLS / 2 ? 1 : -1, dead: 0 });
  }
  for (const sl of s.seals) {
    if (sl.dead > 0) {
      sl.dead -= dt;
      continue;
    }
    const b = sl.b;
    stepBody(b, w, { dir: sl.dir, up: false, down: false, jump: false }, dt, SEAL_CFG);
    const f = Math.round(-b.y / SPACING);
    const ahead = Math.floor(b.x + sl.dir * 0.7);
    if (ahead < 1 || ahead >= COLS - 1) sl.dir = 0 - sl.dir;
    // Stepping over an open gap, a seal plugs it with ice.
    if (f >= 1 && f < s.rows && b.onGround) {
      const under = Math.floor(b.x + sl.dir * 0.5);
      if (s.grid[idx(under, f)] === EMPTY && Math.abs(b.y - floorY(f)) < 0.01) s.grid[idx(under, f)] = ICE;
    }
    if (me.alive && me.invuln <= 0 && Math.abs(b.x - me.x) < 0.7 && Math.abs(b.y - me.y) < 0.9) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }
  s.seals = s.seals.filter((sl) => sl.dead > -50);

  // Birds swoop across at the hero's height.
  s.birdTimer -= dt;
  if (s.birdTimer <= 0 && me.alive) {
    s.birdTimer = Math.max(4, 9 - s.level);
    const dir = rng.next() < 0.5 ? 1 : -1;
    s.birds.push({ x: dir > 0 ? -1 : COLS + 1, y: me.y - 1.5 + rng.range(-0.5, 0.5), dir });
  }
  for (let i = s.birds.length - 1; i >= 0; i--) {
    const b = s.birds[i]!;
    b.x += b.dir * 5 * dt;
    if (b.x < -2 || b.x > COLS + 2) {
      s.birds.splice(i, 1);
      continue;
    }
    if (me.alive && me.invuln <= 0 && Math.abs(b.x - me.x) < 0.8 && Math.abs(b.y - (me.y - 1)) < 0.9) {
      s.birds.splice(i, 1);
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  // The summit: stand on the top floor.
  if (me.alive && s.best >= s.rows - 1 && me.onGround && Math.abs(me.y - floorY(s.rows - 1)) < 0.01) {
    s.score += 1500 + s.level * 300;
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

function render(s: PeakState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = '#1b2d4e';
  g.fillRect(0, 0, W, H);
  // Camera: keep the hero around the lower-middle of the screen.
  const sy = (y: number) => 430 + (y - Math.min(s.me.y, 0)) * CELL;
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let k = 0; k < 20; k++) g.fillRect((k * 83) % W, ((k * 61 - s.me.y * 4) % H + H) % H, 3, 3);
  g.fillStyle = COLORS.paper;
  g.fillRect(OX, sy(0), COLS * CELL, 60);
  for (let f = 1; f < s.rows; f++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, f)];
      if (c === EMPTY) continue;
      g.fillStyle = c === ICE ? COLORS.cyan : f === s.rows - 1 ? COLORS.gold : '#c47a3a';
      g.fillRect(sx(x) + 1, sy(floorY(f)), CELL - 2, 10);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(sx(x) + 1, sy(floorY(f)) + 5, CELL - 2, 2);
    }
  }
  for (const sl of s.seals) {
    if (sl.dead > 0) continue;
    g.fillStyle = COLORS.paper;
    g.fillRect(sx(sl.b.x) - 12, sy(sl.b.y) - 16, 24, 16);
    g.fillStyle = COLORS.bg;
    g.fillRect(sx(sl.b.x) - 6 + sl.dir * 4, sy(sl.b.y) - 12, 4, 4);
  }
  for (const b of s.birds) {
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.ellipse(sx(b.x), sy(b.y), 13, 7, 0, 0, 6.3);
    g.fill();
    g.fillRect(sx(b.x) - 14, sy(b.y) - 10 + (Math.floor(time * 12) % 2) * 6, 10, 3);
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    g.fillStyle = COLORS.coral;
    g.fillRect(sx(s.me.x) - 8, sy(s.me.y) - 26, 16, 26);
    g.fillStyle = COLORS.cyan;
    g.fillRect(sx(s.me.x) - 9, sy(s.me.y) - 31, 18, 7);
    g.fillStyle = COLORS.bg;
    g.fillRect(sx(s.me.x) - 3 + s.me.face * 3, sy(s.me.y) - 20, 3, 4);
    if (s.me.swing > 0) {
      g.fillStyle = COLORS.gold;
      g.fillRect(sx(s.me.x) + s.me.face * 16 - 7, sy(s.me.y) - 20, 14, 10);
    }
  }
  drawSparks(g, s.sparks);
  hud(g, s, `MOUNTAIN ${s.level}  FLOOR ${s.best}/${s.rows - 1}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'SUMMIT REACHED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<PeakState> = {
  id: 'peak-climber',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
