import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, isFloor, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 52;
const FLOORS = [3, 6, 9, 12, 15];
const GROUND = 15;
/** Elevator shafts: first column (each car is two tiles wide). */
const SHAFTS = [8, 18];
const CAR_SPEED = 3.4;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 4.6, jump: 12.5 };
const GUARD_CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 2.4, jump: 0 };
const EXIT = { x: 14.5, y: GROUND };

interface Car {
  x: number;
  /** Feet height of the car's floor. */
  y: number;
}
interface Door {
  x: number;
  y: number;
  /** Holds a document (red door). */
  doc: boolean;
  opened: boolean;
}
interface Guard {
  b: Body;
  dir: number;
  cd: number;
  think: number;
}
interface Shot {
  x: number;
  y: number;
  dir: number;
  mine: boolean;
  /** Foe shots are either high (standing height) or low. */
  high: boolean;
}

export interface LiftState {
  grid: number[];
  cars: Car[];
  me: Body & { alive: boolean; crouch: boolean; cd: number; invuln: number };
  doors: Door[];
  guards: Guard[];
  shots: Shot[];
  docs: number;
  /** Seconds left on the mission clock. */
  clock: number;
  spawnTimer: number;
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
const shaftOf = (x: number) => SHAFTS.findIndex((a) => x >= a && x < a + 2);

function world(s: LiftState): PlatWorld {
  return {
    solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= ROWS || (ty >= 0 && s.grid[idx(tx, ty)] === 1),
    // A car is a floor under its feet: the row at (or just below) its top.
    platform: (tx, ty) => s.cars.some((c) => tx >= c.x && tx < c.x + 2 && ty === Math.ceil(c.y - 1e-9)),
  };
}

function buildLevel(s: LiftState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, () => 0);
  for (const f of FLOORS) for (let x = 0; x < COLS; x++) if (f === GROUND || shaftOf(x) < 0) s.grid[idx(x, f)] = 1;
  s.cars = SHAFTS.map((x, i) => ({ x, y: i === 0 ? FLOORS[0]! : GROUND }));
  s.doors = [];
  const docs = Math.min(4 + s.level, 8);
  for (let n = 0; n < docs + 5 && s.doors.length < docs + 5; n++) {
    const f = FLOORS[n % 4]!;
    const x = rng.int(1, COLS - 2);
    if (shaftOf(x) >= 0 || shaftOf(x - 1) >= 0 || s.doors.some((d) => d.y === f && Math.abs(d.x - (x + 0.5)) < 2.5)) continue;
    s.doors.push({ x: x + 0.5, y: f, doc: s.doors.filter((d) => d.doc).length < docs, opened: false });
  }
  s.docs = 0;
  s.clock = 120 + needed(s) * 12;
  s.guards = [];
  s.shots = [];
  s.spawnTimer = 4;
  Object.assign(s.me, newBody(3.5, FLOORS[0]!), { alive: true, crouch: false, cd: 0, invuln: 1.5 });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): LiftState {
  const s: LiftState = {
    grid: [],
    cars: [],
    me: { ...newBody(3.5, FLOORS[0]!), alive: true, crouch: false, cd: 0, invuln: 1.5 },
    doors: [],
    guards: [],
    shots: [],
    docs: 0,
    clock: 150,
    spawnTimer: 4,
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

const needed = (s: LiftState) => s.doors.filter((d) => d.doc).length;

function loseLife(s: LiftState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: LiftState, input: Input, dt: number, ctx: UpdateContext): void {
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

  // The car the hero is standing on, if any.
  const riding = me.alive ? s.cars.find((c) => me.x >= c.x + 0.1 && me.x <= c.x + 1.9 && me.onGround && Math.abs(me.y - c.y) < 1) : undefined;
  if (riding) {
    const dir = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    riding.y = Math.min(GROUND, Math.max(FLOORS[0]!, riding.y + dir * CAR_SPEED * dt));
  }

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newBody(3.5, FLOORS[0]!), { alive: true, crouch: false, cd: 0, invuln: 2.2 });
      me.onGround = true;
      s.shots = s.shots.filter((x) => x.mine);
    }
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    me.cd = Math.max(0, me.cd - dt);
    const onCar = !!riding;
    me.crouch = input.held.down && me.onGround && !onCar;
    const dir = me.crouch ? 0 : (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const jump = input.pressed.b && !me.crouch;
    if (dir !== 0) me.face = dir;
    if (riding && !jump) {
      // The car owns the hero's height; the hero can only shuffle sideways (and step off the edge).
      me.y = riding.y;
      me.vy = 0;
      me.onGround = true;
      me.x = Math.min(COLS - 0.5, Math.max(0.5, me.x + dir * CFG.walk * 0.8 * dt));
    } else {
      if (riding && jump) {
        // Hop off the car: leave the ground so the normal physics takes over.
        me.onGround = false;
        me.y -= 0.02;
      }
      stepBody(me, w, { dir, up: false, down: false, jump: jump && !riding }, dt, CFG);
      if (riding && jump) me.vy = -CFG.jump;
      // Landing on a car: stand on its exact top.
      if (me.onGround) {
        const car = s.cars.find((c) => me.x >= c.x + 0.1 && me.x <= c.x + 1.9 && Math.abs(me.y - Math.ceil(c.y - 1e-9)) < 1e-6);
        if (car) me.y = car.y;
      }
    }
    if (input.pressed.a && me.cd <= 0) {
      me.cd = 0.25;
      s.shots.push({ x: me.x + me.face * 0.6, y: me.y - (me.crouch ? 0.5 : 1.1), dir: me.face, mine: true, high: !me.crouch });
      emit('fire');
    }
    // Step into a door.
    if (input.pressed.up) {
      const d = s.doors.find((dd) => !dd.opened && dd.doc && Math.abs(dd.y - me.y) < 0.1 && Math.abs(dd.x - me.x) < 0.8);
      if (d) {
        d.opened = true;
        s.docs += 1;
        s.score += 500;
        emit('wave');
      }
    }
  }

  // Guards come out of doors, patrol, and shoot when lined up.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.guards.length < 2 + Math.floor(s.level / 2) + 1) {
    const d = s.doors[rng.int(0, s.doors.length - 1)];
    const clear = d && (Math.abs(d.x - me.x) > 4 || Math.abs(d.y - me.y) > 0.5);
    // A door too close to the agent is skipped; try another soon.
    s.spawnTimer = clear ? Math.max(2.6, 5.5 - s.level * 0.3) : 0.4;
    if (d && clear) {
      const b = newBody(d.x, d.y);
      b.onGround = true;
      s.guards.push({ b, dir: Math.sign(me.x - d.x) || 1, cd: rng.range(1, 2.2), think: rng.range(0.5, 1.5) });
    }
  }
  for (let gi = s.guards.length - 1; gi >= 0; gi--) {
    const g = s.guards[gi]!;
    const b = g.b;
    g.think -= dt;
    g.cd -= dt;
    if (g.think <= 0) {
      g.think = rng.range(0.6, 1.6);
      if (me.alive && Math.abs(b.y - me.y) < 0.1) g.dir = Math.sign(me.x - b.x) || 1;
      else g.dir = rng.pick([-1, 1, 0]);
    }
    const sameFloor = me.alive && Math.abs(b.y - me.y) < 0.1;
    // Guards turn back at the edge of a floor (an open shaft counts as an edge).
    if (b.onGround && g.dir !== 0 && !isFloor(w, Math.floor(b.x + g.dir * 0.75), Math.round(b.y))) g.dir = 0 - g.dir;
    stepBody(b, w, { dir: sameFloor && Math.abs(b.x - me.x) < 4 ? 0 : g.dir, up: false, down: false, jump: false }, dt, GUARD_CFG);
    if (b.x < 0.8) g.dir = 1;
    if (b.x > COLS - 0.8) g.dir = -1;
    if (sameFloor && g.cd <= 0 && Math.abs(b.x - me.x) < 12) {
      s.shots.push({ x: b.x, y: b.y - (rng.next() < 0.7 ? 1.1 : 0.45), dir: Math.sign(me.x - b.x) || 1, mine: false, high: false });
      s.shots[s.shots.length - 1]!.high = s.shots[s.shots.length - 1]!.y < b.y - 0.8;
      g.cd = Math.max(1.3, 2.6 - s.level * 0.15) + rng.range(0, 0.8);
    }
    if (b.y > GROUND + 0.5) s.guards.splice(gi, 1);
  }

  // Shots.
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.x += sh.dir * (sh.mine ? 13 : 8) * dt;
    if (sh.x < 0 || sh.x > COLS) {
      s.shots.splice(i, 1);
      continue;
    }
    if (sh.mine) {
      const gi = s.guards.findIndex((g) => Math.abs(g.b.x - sh.x) < 0.6 && Math.abs(g.b.y - (sh.y + (sh.high ? 1.1 : 0.5))) < 0.4);
      if (gi >= 0) {
        const g = s.guards[gi]!;
        s.score += 150;
        burst(s.sparks, rng, px(g.b.x), py(g.b.y), COLORS.gold, 10);
        s.guards.splice(gi, 1);
        s.shots.splice(i, 1);
        emit('explode');
      }
    } else if (me.alive && me.invuln <= 0 && Math.abs(sh.x - me.x) < 0.5 && Math.abs((sh.y + (sh.high ? 1.1 : 0.45)) - me.y) < 0.6) {
      // A crouching hero ducks under the high shots.
      if (sh.high && me.crouch) continue;
      s.shots.splice(i, 1);
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  // The mission clock: run out of time and the agent is caught.
  if (me.alive) {
    s.clock -= dt;
    if (s.clock <= 0) {
      s.clock = 60;
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  // The exit: only once every document is in the bag.
  if (me.alive && s.docs >= needed(s) && Math.abs(me.x - EXIT.x) < 1.2 && Math.abs(me.y - EXIT.y) < 0.1) {
    s.score += 1000 + s.level * 200 + Math.floor(s.clock) * 5;
    s.levelDelay = 1.8;
    emit('wave');
  }
  if (me.alive && me.y > GROUND + 0.05) me.y = GROUND;
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: LiftState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (s.grid[idx(x, y)] !== 1) continue;
      g.fillStyle = y === GROUND ? COLORS.purple : '#5a4a99';
      g.fillRect(px(x), py(y), CELL, 9);
    }
  }
  for (const a of SHAFTS) {
    g.fillStyle = 'rgba(79,227,214,0.08)';
    g.fillRect(px(a), py(FLOORS[0]!), 2 * CELL, (GROUND - FLOORS[0]!) * CELL);
  }
  for (const c of s.cars) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(px(c.x), py(c.y) - 2, 2 * CELL, 8);
    g.fillRect(px(c.x), py(c.y) - 34, 3, 32);
    g.fillRect(px(c.x) + 2 * CELL - 3, py(c.y) - 34, 3, 32);
  }
  for (const d of s.doors) {
    g.fillStyle = d.doc ? (d.opened ? COLORS.muted : COLORS.coral) : '#3a3070';
    g.fillRect(px(d.x) - 9, py(d.y) - 32, 18, 32);
  }
  g.fillStyle = s.docs >= needed(s) && Math.floor(time * 5) % 2 ? COLORS.gold : COLORS.paper;
  g.fillRect(px(EXIT.x) - 10, py(EXIT.y) - 30, 20, 30);
  for (const gd of s.guards) {
    g.fillStyle = '#222233';
    g.fillRect(px(gd.b.x) - 8, py(gd.b.y) - 26, 16, 26);
    g.fillStyle = COLORS.coral;
    g.fillRect(px(gd.b.x) - 3, py(gd.b.y) - 22, 6, 4);
  }
  for (const sh of s.shots) {
    g.fillStyle = sh.mine ? COLORS.gold : COLORS.coral;
    g.fillRect(px(sh.x) - 4, py(sh.y + (sh.high ? 1.1 : 0.5)) - 28 + (sh.high ? 0 : 14), 8, 4);
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    const h = s.me.crouch ? 14 : 26;
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - h, 16, h);
    g.fillStyle = COLORS.gold;
    g.fillRect(px(s.me.x) - 9, py(s.me.y) - h - 3, 18, 5);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - h + 5, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  DOCS ${s.docs}/${needed(s)}  TIME ${Math.ceil(s.clock)}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'MISSION COMPLETE!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<LiftState> = {
  id: 'lift-agent',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
