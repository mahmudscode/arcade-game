import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 54;
const GROUND = 16;
const TOP = 3;
const START_LIVES = 3;
const BONUS_START = 4000;
const EXTRA_LIFE_EVERY = 20000;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 4.6, climb: 4.2, jump: 13.5, air: 1 };
const FOE_CLIMB = 2.4;
/** Vine columns; the vine runs from the top platform row down to just above the ground. */
const VINES = [2, 5, 8, 11, 14, 17, 20, 23];
/** Island platforms (one-way): [row, from, to]. */
const ISLANDS: [number, number, number][] = [
  [13, 1, 3],
  [13, 7, 9],
  [13, 13, 15],
  [13, 19, 21],
  [10, 4, 6],
  [10, 10, 12],
  [10, 16, 18],
  [10, 22, 24],
  [7, 1, 3],
  [7, 7, 9],
  [7, 13, 15],
  [TOP, 17, 26],
];
const KEY = { x: 25.5, y: TOP };

interface Snap {
  x: number;
  y: number;
  /** Climbing a vine (true) or walking a platform (false). */
  vine: boolean;
  /** Direction of travel: down/up for vines, left/right for islands. */
  dir: number;
}
interface Fruit {
  x: number;
  y: number;
  vy: number;
  /** Hanging on a vine, loose and falling, or gone. */
  state: 'hang' | 'fall';
}

export interface VineState {
  me: Body & { alive: boolean };
  foes: Snap[];
  fruit: Fruit[];
  sparks: Spark[];
  spawnTimer: number;
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

const px = (x: number) => OX + x * CELL;
const py = (y: number) => OY + y * CELL;

const world: PlatWorld = {
  solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= GROUND,
  platform: (tx, ty) => ISLANDS.some(([r, a, b]) => r === ty && tx >= a && tx <= b),
  // Vines run from the top platform to the ground.
  ladder: (tx, ty) => VINES.includes(tx) && ty >= TOP && ty < GROUND,
};

function buildLevel(s: VineState, rng: Rng): void {
  s.foes = [];
  s.fruit = [];
  const picks = [...VINES];
  for (let k = 0; k < 4; k++) {
    const col = picks.splice(rng.int(0, picks.length - 1), 1)[0]!;
    s.fruit.push({ x: col + 0.5, y: rng.int(5, 12) + 0.4, vy: 0, state: 'hang' });
  }
  s.spawnTimer = 3;
  s.bonus = BONUS_START;
  s.bonusTimer = 0;
  Object.assign(s.me, newBody(1.5, GROUND), { alive: true });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): VineState {
  const s: VineState = {
    me: { ...newBody(1.5, GROUND), alive: true },
    foes: [],
    fruit: [],
    sparks: [],
    spawnTimer: 3,
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

function loseLife(s: VineState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: VineState, input: Input, dt: number, ctx: UpdateContext): void {
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
      Object.assign(me, newBody(1.5, GROUND), { alive: true });
      me.onGround = true;
      s.foes = s.foes.filter((f) => Math.hypot(f.x - 1.5, f.y - GROUND) > 5);
    }
  } else {
    // Jumping from vine to vine is the heart of the game: A jumps, also off a vine.
    stepBody(me, world, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: input.held.up, down: input.held.down, jump: input.pressed.a || input.pressed.b }, dt, CFG);
    if (me.x < 0.5) me.x = 0.5;
    if (me.x > COLS - 0.5) me.x = COLS - 0.5;
    // Loose fruit hanging near the hero shakes free when touched.
    for (const f of s.fruit) {
      if (f.state === 'hang' && Math.abs(f.x - me.x) < 0.8 && Math.abs(f.y - (me.y - 0.5)) < 0.8) {
        f.state = 'fall';
        f.vy = 0;
        s.score += 100;
        emit('pickup');
      }
    }
  }

  // Fruit falls and flattens whatever it lands on.
  for (let i = s.fruit.length - 1; i >= 0; i--) {
    const f = s.fruit[i]!;
    if (f.state !== 'fall') continue;
    f.vy = Math.min(12, f.vy + 30 * dt);
    f.y += f.vy * dt;
    const hit = s.foes.findIndex((e) => Math.abs(e.x - f.x) < 0.9 && Math.abs(e.y - 0.5 - f.y) < 1);
    if (hit >= 0) {
      const e = s.foes[hit]!;
      s.score += 400;
      burst(s.sparks, rng, px(e.x), py(e.y), COLORS.gold, 12);
      s.foes.splice(hit, 1);
      s.fruit.splice(i, 1);
      emit('explode');
      continue;
    }
    if (f.y > GROUND + 1) s.fruit.splice(i, 1);
  }

  // Snapjaws come from the top: some drop down the vines, some patrol the islands.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.foes.length < 3 + Math.floor(s.level / 2)) {
    s.spawnTimer = Math.max(2.2, 5 - s.level * 0.3);
    const vine = rng.next() < 0.6;
    s.foes.push(
      vine
        ? { x: VINES[rng.int(0, VINES.length - 1)]! + 0.5, y: TOP + 1, vine: true, dir: 1 }
        : { x: rng.range(18.5, 25.5), y: TOP, vine: false, dir: rng.pick([-1, 1]) },
    );
  }
  for (const e of s.foes) {
    if (e.vine) {
      // Climb down; at the bottom, swing back up.
      e.y += e.dir * FOE_CLIMB * dt;
      if (e.y > GROUND - 0.4) e.dir = -1;
      if (e.y < TOP + 1) e.dir = 1;
    } else {
      e.x += e.dir * 2.2 * dt;
      const isl = ISLANDS.find(([r]) => r === e.y)!;
      if (e.x < isl[1] + 0.3 || e.x > isl[2] + 0.7) e.dir = 0 - e.dir;
    }
    if (me.alive && Math.abs(e.x - me.x) < 0.65 && Math.abs(e.y - me.y) < 0.9) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  s.bonusTimer += dt;
  if (s.bonusTimer >= 1) {
    s.bonusTimer -= 1;
    s.bonus = Math.max(0, s.bonus - 100);
  }
  // Reach the key on the top platform.
  if (me.alive && Math.abs(me.x - KEY.x) < 1.2 && Math.abs(me.y - KEY.y) < 0.2) {
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

function render(s: VineState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = '#1f4a34';
  g.fillRect(OX, py(GROUND), COLS * CELL, 50);
  for (const c of VINES) {
    g.strokeStyle = '#4fb36b';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(px(c + 0.5), py(TOP));
    g.lineTo(px(c + 0.5), py(GROUND));
    g.stroke();
  }
  for (const [row, a, b] of ISLANDS) {
    g.fillStyle = '#9b5a3c';
    g.fillRect(px(a), py(row), (b - a + 1) * CELL, 9);
  }
  g.fillStyle = Math.floor(time * 4) % 2 ? COLORS.gold : COLORS.paper;
  g.fillRect(px(KEY.x) - 6, py(KEY.y) - 20, 12, 20);
  for (const f of s.fruit) {
    g.fillStyle = f.state === 'hang' ? COLORS.coral : COLORS.gold;
    g.beginPath();
    g.arc(px(f.x), py(f.y), 8, 0, 6.3);
    g.fill();
  }
  for (const e of s.foes) {
    g.fillStyle = e.vine ? COLORS.cyan : COLORS.coral;
    g.fillRect(px(e.x) - 9, py(e.y) - 16, 18, 16);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(e.x) - 5, py(e.y) - 12, 4, 4);
    g.fillRect(px(e.x) + 2, py(e.y) - 12, 4, 4);
  }
  if (s.me.alive) {
    g.fillStyle = '#c47a3a';
    g.fillRect(px(s.me.x) - 8, py(s.me.y) - 22, 16, 22);
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 5, py(s.me.y) - 26, 10, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 16, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  BONUS ${s.bonus}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'KEY REACHED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<VineState> = {
  id: 'vine-climber',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
