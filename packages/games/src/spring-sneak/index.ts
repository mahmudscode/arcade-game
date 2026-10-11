import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 52;
/** Feet heights of the floors, top to bottom. The bottom one is the ground that holds the trampolines. */
const FLOORS = [3, 6, 9, 12, 15];
const GROUND = 15;
/** Trampoline shafts: [first column, width]. Floors have an opening here. */
const SHAFTS: [number, number][] = [[3, 2], [13, 2], [23, 2]];
const BOUNCE = 17.2;
const MAX_BOUNCES = 6;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const BLAST_RANGE = 9;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 4.6, jump: 0, air: 1 };
const CAT_CFG: PlatConfig = { ...CFG, walk: 2.8 };

interface Cat {
  b: Body;
  dir: number;
  stun: number;
  gone: number;
  think: number;
}
interface Loot {
  x: number;
  y: number;
  kind: number;
}
interface Door {
  x: number;
  y: number;
  used: boolean;
}

export interface SneakState {
  grid: number[];
  me: Body & { alive: boolean };
  cats: Cat[];
  loot: Loot[];
  doors: Door[];
  /** Bounces left on each trampoline before it snaps. */
  tramp: number[];
  blast: { y: number; x: number; t: number };
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
const inShaft = (x: number) => SHAFTS.findIndex(([a, w]) => x >= a && x < a + w);

function world(s: SneakState): PlatWorld {
  return { solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= ROWS || (ty >= 0 && s.grid[idx(tx, ty)] === 1) };
}

function buildLevel(s: SneakState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => 0);
  for (const f of FLOORS) for (let x = 0; x < COLS; x++) if (f === GROUND || inShaft(x) < 0) s.grid[idx(x, f)] = 1;
  s.tramp = SHAFTS.map(() => MAX_BOUNCES);
  s.loot = [];
  const want = Math.min(6 + s.level, 11);
  for (let tries = 0; s.loot.length < want && tries < 200; tries++) {
    const f = rng.pick(FLOORS);
    const x = rng.int(1, COLS - 2);
    if (inShaft(x) >= 0 || s.loot.some((l) => l.x === x + 0.5 && l.y === f)) continue;
    s.loot.push({ x: x + 0.5, y: f, kind: s.loot.length % 4 });
  }
  s.doors = [];
  for (let n = 0; n < 4; n++) {
    const f = FLOORS[n % 4]!;
    const x = rng.int(1, COLS - 2);
    if (inShaft(x) < 0 && !s.doors.some((d) => Math.abs(d.x - (x + 0.5)) < 3 && d.y === f)) s.doors.push({ x: x + 0.5, y: f, used: false });
  }
  s.cats = [];
  const cats = Math.min(2 + Math.floor(s.level / 2), 5);
  for (let c = 0; c < cats; c++) {
    const b = newBody(rng.pick([1.5, 8.5, 18.5, 26.5]), FLOORS[c % 4]!);
    b.onGround = true;
    s.cats.push({ b, dir: rng.pick([-1, 1]), stun: 0, gone: 0, think: rng.range(0, 1) });
  }
  s.blast = { y: 0, x: 0, t: 0 };
  Object.assign(s.me, newBody(10, GROUND), { alive: true });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): SneakState {
  const s: SneakState = {
    grid: [],
    me: { ...newBody(10, GROUND), alive: true },
    cats: [],
    loot: [],
    doors: [],
    tramp: [],
    blast: { y: 0, x: 0, t: 0 },
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

function loseLife(s: SneakState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** A body landing on a trampoline at the foot of a shaft is thrown back up. Returns true if it bounced. */
function trampolineBounce(s: SneakState, b: Body, landed: boolean, emit: UpdateContext['emit']): boolean {
  const col = inShaft(Math.floor(b.x));
  if (col < 0 || !landed || Math.abs(b.y - GROUND) > 0.01 || Math.abs(b.x - (SHAFTS[col]![0] + 1)) > 1.1) return false;
  if (s.tramp[col]! <= 0) return false;
  // Lift the feet just off the floor, otherwise the physics still sees it standing there.
  b.y = GROUND - 0.01;
  b.vy = -BOUNCE;
  b.onGround = false;
  s.tramp[col] = s.tramp[col]! - 1;
  emit('fire');
  return true;
}

function update(s: SneakState, input: Input, dt: number, ctx: UpdateContext): void {
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
  s.blast.t = Math.max(0, s.blast.t - dt);
  const w = world(s);
  const me = s.me;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newBody(10, GROUND), { alive: true });
      me.onGround = true;
      for (const c of s.cats) if (Math.hypot(c.b.x - 10, c.b.y - GROUND) < 6) c.stun = Math.max(c.stun, 2);
    }
  } else {
    // Mid-air you can still steer; walking off a floor edge drops you down the shaft.
    const r = stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: false, down: false, jump: false }, dt, CFG);
    trampolineBounce(s, me, r.landed, emit);

    for (let i = s.loot.length - 1; i >= 0; i--) {
      const l = s.loot[i]!;
      if (Math.abs(l.x - me.x) < 0.7 && Math.abs(l.y - me.y) < 0.9) {
        s.loot.splice(i, 1);
        s.score += 200 + l.kind * 100;
        emit('pickup');
      }
    }
    // A power door blasts the cats along its floor.
    if (input.pressed.a) {
      const door = s.doors.find((d) => !d.used && Math.abs(d.y - me.y) < 0.05 && Math.abs(d.x - me.x) < 1.6);
      if (door) {
        door.used = true;
        s.blast = { x: door.x, y: door.y, t: 0.5 };
        let hit = 0;
        for (const c of s.cats) {
          if (c.gone <= 0 && Math.abs(c.b.y - door.y) < 0.1 && Math.abs(c.b.x - door.x) < BLAST_RANGE) {
            hit += 1;
            c.gone = 6;
            s.score += 200 * 2 ** Math.min(hit - 1, 3);
            burst(s.sparks, rng, px(c.b.x), py(c.b.y), COLORS.gold, 10);
          }
        }
        emit(hit > 0 ? 'explode' : 'pickup');
      }
    }
  }

  // Cats: pad along the floor toward the hero; bounce if they fall onto a trampoline.
  for (const c of s.cats) {
    const b = c.b;
    if (c.gone > 0) {
      c.gone -= dt;
      if (c.gone <= 0) {
        b.x = rng.pick([1.5, 26.5]);
        b.y = FLOORS[0]!;
        b.vy = 0;
        b.onGround = true;
      }
      continue;
    }
    if (c.stun > 0) {
      c.stun -= dt;
      continue;
    }
    c.think -= dt;
    if (c.think <= 0) {
      c.think = rng.range(0.4, 1.0);
      c.dir = me.alive && Math.abs(b.y - me.y) < 0.1 && rng.next() < 0.9 ? Math.sign(me.x - b.x) || 1 : rng.pick([-1, 1, c.dir]);
    }
    const r = stepBody(b, w, { dir: c.dir, up: false, down: false, jump: false }, dt, { ...CAT_CFG, walk: CAT_CFG.walk + Math.min(s.level, 8) * 0.12 });
    if (trampolineBounce(s, b, r.landed, emit)) b.vx = rng.pick([-3, 3]);
    if (b.x < 0.6) c.dir = 1;
    if (b.x > COLS - 0.6) c.dir = -1;
    if (me.alive && Math.abs(b.x - me.x) < 0.65 && Math.abs(b.y - me.y) < 0.8) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  if (s.loot.length === 0 && me.alive && s.levelDelay <= 0) {
    s.score += 1000 + s.doors.filter((d) => !d.used).length * 200;
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

function render(s: SneakState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (s.grid[idx(x, y)] !== 1) continue;
      g.fillStyle = y === GROUND ? COLORS.purple : COLORS.coral;
      g.fillRect(px(x) + 1, py(y), CELL - 2, 10);
    }
  }
  SHAFTS.forEach(([a, wd], i) => {
    const left = s.tramp[i]!;
    g.fillStyle = left > 3 ? COLORS.cyan : left > 0 ? COLORS.gold : 'rgba(255,93,115,0.4)';
    g.fillRect(px(a), py(GROUND) + 2, wd * CELL, 6);
    g.fillStyle = 'rgba(246,239,255,0.12)';
    g.fillRect(px(a), py(FLOORS[0]!), wd * CELL, (GROUND - FLOORS[0]!) * CELL);
  });
  for (const d of s.doors) {
    g.fillStyle = d.used ? COLORS.muted : Math.floor(time * 4) % 2 ? COLORS.gold : COLORS.coral;
    g.fillRect(px(d.x) - 8, py(d.y) - 30, 16, 30);
  }
  if (s.blast.t > 0) {
    g.fillStyle = 'rgba(255,201,60,0.45)';
    g.fillRect(px(s.blast.x - BLAST_RANGE), py(s.blast.y) - 26, 2 * BLAST_RANGE * CELL, 24);
  }
  for (const l of s.loot) {
    g.fillStyle = [COLORS.cyan, COLORS.paper, COLORS.gold, COLORS.purple][l.kind]!;
    g.fillRect(px(l.x) - 9, py(l.y) - 18, 18, 16);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(l.x) - 5, py(l.y) - 14, 10, 6);
  }
  for (const c of s.cats) {
    if (c.gone > 0) continue;
    const x = px(c.b.x);
    const y = py(c.b.y);
    g.fillStyle = c.stun > 0 ? COLORS.muted : COLORS.coral;
    g.fillRect(x - 10, y - 18, 20, 18);
    g.fillRect(x - 10, y - 24, 6, 6);
    g.fillRect(x + 4, y - 24, 6, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(x - 5, y - 13, 3, 3);
    g.fillRect(x + 3, y - 13, 3, 3);
  }
  if (s.me.alive) {
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 22, 16, 22);
    g.fillStyle = COLORS.cyan;
    g.fillRect(px(s.me.x) - 9, py(s.me.y) - 26, 18, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 15, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  LOOT ${s.loot.length}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ALL LOOT RECOVERED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<SneakState> = {
  id: 'spring-sneak',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
