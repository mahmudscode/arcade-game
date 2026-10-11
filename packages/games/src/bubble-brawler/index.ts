import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DEFAULT_PLAT, isFloor, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from '../_shared/platformer';

const COLS = 28;
const ROWS = 18;
const CELL = 28;
const OX = (W - COLS * CELL) / 2;
const OY = 50;
const GROUND = 17;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const TRAP_TIME = 7;
const HURRY_AT = 45;
const CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 5, jump: 15 };
const FOE_CFG: PlatConfig = { ...DEFAULT_PLAT, walk: 2.6, jump: 14 };
/** One-way platform layouts: [row, from, to]. A layout is picked by level. */
const LAYOUTS: [number, number, number][][] = [
  [[14, 1, 8], [14, 19, 26], [11, 8, 19], [8, 1, 8], [8, 19, 26], [5, 8, 19]],
  [[14, 3, 24], [11, 1, 10], [11, 17, 26], [8, 5, 22], [5, 1, 9], [5, 18, 26]],
  [[14, 1, 12], [14, 15, 26], [10, 4, 23], [6, 1, 11], [6, 16, 26]],
];

interface Foe {
  b: Body;
  dir: number;
  angry: boolean;
  think: number;
}
interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** Seconds the trapped enemy has been inside. */
  held: number;
  /** The enemy inside (it leaves the foes list while trapped); absent for an empty bubble. */
  trapped?: Foe;
}
interface Fruit {
  x: number;
  y: number;
  vy: number;
  life: number;
  worth: number;
}

export interface BrawlerState {
  me: Body & { alive: boolean; shot: number; invuln: number };
  foes: Foe[];
  bubbles: Bubble[];
  fruit: Fruit[];
  ghost: { on: boolean; x: number; y: number };
  time: number;
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

function worldFor(s: BrawlerState): PlatWorld {
  const layout = LAYOUTS[(s.level - 1) % LAYOUTS.length]!;
  return {
    solid: (tx, ty) => tx < 0 || tx >= COLS || ty >= GROUND,
    platform: (tx, ty) => layout.some(([r, a, b]) => r === ty && tx >= a && tx <= b),
  };
}

function buildLevel(s: BrawlerState, rng: Rng): void {
  s.foes = [];
  s.bubbles = [];
  s.fruit = [];
  s.ghost = { on: false, x: 14, y: 2 };
  s.time = 0;
  const layout = LAYOUTS[(s.level - 1) % LAYOUTS.length]!;
  const count = Math.min(3 + s.level, 9);
  for (let k = 0; k < count; k++) {
    const [row, a, b] = layout[k % layout.length]!;
    const f = newBody(rng.range(a + 1, b), row);
    f.onGround = true;
    s.foes.push({ b: f, dir: rng.pick([-1, 1]), angry: false, think: rng.range(0, 1) });
  }
  Object.assign(s.me, newBody(2.5, GROUND), { alive: true, shot: 0, invuln: 1.5 });
  s.me.onGround = true;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): BrawlerState {
  const s: BrawlerState = {
    me: { ...newBody(2.5, GROUND), alive: true, shot: 0, invuln: 1.5 },
    foes: [],
    bubbles: [],
    fruit: [],
    ghost: { on: false, x: 14, y: 2 },
    time: 0,
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

function loseLife(s: BrawlerState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, px(s.me.x), py(s.me.y - 0.5), COLORS.cyan, 20);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function popBubble(s: BrawlerState, i: number, byHero: boolean, rng: Rng, emit: UpdateContext['emit']): void {
  const b = s.bubbles[i]!;
  s.bubbles.splice(i, 1);
  burst(s.sparks, rng, px(b.x), py(b.y), b.trapped ? COLORS.gold : COLORS.cyan, 8);
  if (b.trapped) {
    if (byHero) {
      s.score += 100;
      s.fruit.push({ x: b.x, y: b.y, vy: 0, life: 9, worth: 500 + Math.min(s.level, 6) * 100 });
      emit('explode');
    } else {
      // It escaped, angrier than before.
      b.trapped.angry = true;
      b.trapped.b.x = b.x;
      b.trapped.b.y = Math.min(b.y + 0.5, GROUND);
      b.trapped.b.vy = 0;
      b.trapped.b.onGround = false;
      s.foes.push(b.trapped);
    }
  } else if (byHero) {
    s.score += 10;
    emit('pickup');
  }
}

function update(s: BrawlerState, input: Input, dt: number, ctx: UpdateContext): void {
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
  const w = worldFor(s);
  const me = s.me;
  s.time += dt;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newBody(2.5, GROUND), { alive: true, shot: 0, invuln: 2.2 });
      me.onGround = true;
    }
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    me.shot = Math.max(0, me.shot - dt);
    stepBody(me, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: false, down: input.held.down, jump: input.pressed.a || input.pressed.up }, dt, CFG);
    if (input.pressed.b && me.shot <= 0) {
      me.shot = 0.3;
      s.bubbles.push({ x: me.x + me.face * 0.8, y: me.y - 0.6, vx: me.face * 9, vy: 0, age: 0, held: 0 });
      emit('fire');
    }
  }

  // Bubbles fly out, then drift up; they catch enemies and hold them.
  for (let i = s.bubbles.length - 1; i >= 0; i--) {
    const b = s.bubbles[i]!;
    b.age += dt;
    if (b.age < 0.4) {
      b.x += b.vx * dt;
    } else {
      b.vx *= 1 - 3 * dt;
      b.x += b.vx * dt;
      b.y -= (b.trapped ? 1.1 : 1.6) * dt;
    }
    b.x = Math.min(COLS - 1, Math.max(1, b.x));
    if (b.y < 1.5) b.y = 1.5;
    if (b.trapped) b.held += dt;
    if (b.trapped && b.held >= TRAP_TIME) {
      popBubble(s, i, false, rng, emit);
      continue;
    }
    if (!b.trapped) {
      const fi = s.foes.findIndex((f) => Math.abs(f.b.x - b.x) < 0.9 && Math.abs(f.b.y - 0.5 - b.y) < 1);
      if (fi >= 0) {
        b.trapped = s.foes[fi]!;
        s.foes.splice(fi, 1);
        b.vx = 0;
        b.age = Math.max(b.age, 0.4);
        emit('pickup');
        continue;
      }
      if (b.age > 9) {
        popBubble(s, i, false, rng, emit);
        continue;
      }
    }
    // Touching a bubble pops it.
    if (me.alive && Math.abs(b.x - me.x) < 0.8 && Math.abs(b.y - (me.y - 0.5)) < 0.9 && b.age > 0.5) popBubble(s, i, true, rng, emit);
  }

  // Fruit falls to a floor and can be collected for a while.
  for (let i = s.fruit.length - 1; i >= 0; i--) {
    const f = s.fruit[i]!;
    f.life -= dt;
    f.vy = Math.min(10, f.vy + 30 * dt);
    const ny = f.y + f.vy * dt;
    const landRow = Math.floor(ny + 1e-6);
    const tx = Math.floor(f.x);
    if (f.vy >= 0 && landRow > Math.floor(f.y - 1e-6) && isFloor(w, tx, landRow)) {
      f.y = landRow;
      f.vy = 0;
    } else f.y = ny;
    if (f.life <= 0 || f.y > GROUND + 1) {
      s.fruit.splice(i, 1);
      continue;
    }
    if (me.alive && Math.abs(f.x - me.x) < 0.8 && Math.abs(f.y - me.y) < 1) {
      s.score += f.worth;
      s.fruit.splice(i, 1);
      emit('pickup');
    }
  }

  // Enemies walk their platforms and turn at edges; angry ones are faster.
  for (const f of s.foes) {
    const b = f.b;
    f.think -= dt;
    const ahead = Math.floor(b.x + f.dir * 0.8);
    if (b.onGround && !isFloor(w, ahead, Math.round(b.y))) f.dir = 0 - f.dir;
    if (b.x < 1.2) f.dir = 1;
    if (b.x > COLS - 1.2) f.dir = -1;
    let jump = false;
    if (f.think <= 0) {
      f.think = rng.range(1.2, 3);
      if (me.alive && me.y < b.y - 2 && b.onGround) jump = true;
      else if (rng.next() < 0.25) f.dir = 0 - f.dir;
    }
    stepBody(b, w, { dir: f.dir, up: false, down: false, jump }, dt, { ...FOE_CFG, walk: FOE_CFG.walk * (f.angry ? 1.7 : 1) + Math.min(s.level, 6) * 0.1 });
    if (b.y >= GROUND) b.y = GROUND;
    if (me.alive && me.invuln <= 0 && Math.abs(b.x - me.x) < 0.7 && Math.abs(b.y - me.y) < 0.85) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  // Hurry up: a ghost starts hunting once you take too long.
  if (s.time >= HURRY_AT && !s.ghost.on) {
    s.ghost.on = true;
    emit('wave');
  }
  if (s.ghost.on && me.alive) {
    const dx = me.x - s.ghost.x;
    const dy = me.y - 0.5 - s.ghost.y;
    const d = Math.hypot(dx, dy) || 1;
    s.ghost.x += (dx / d) * 2.2 * dt;
    s.ghost.y += (dy / d) * 2.2 * dt;
    if (d < 0.6 && me.invuln <= 0) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  if (s.foes.length === 0 && !s.bubbles.some((b) => b.trapped) && me.alive && s.levelDelay <= 0) {
    s.score += 1000 + Math.max(0, Math.floor((HURRY_AT - s.time) * 20));
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

function render(s: BrawlerState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = COLORS.purple;
  g.fillRect(OX, py(GROUND), COLS * CELL, 40);
  const layout = LAYOUTS[(s.level - 1) % LAYOUTS.length]!;
  for (const [row, a, b] of layout) {
    g.fillStyle = COLORS.coral;
    g.fillRect(px(a), py(row), (b - a + 1) * CELL, 9);
  }
  for (const f of s.foes) {
    g.fillStyle = f.angry ? COLORS.coral : '#7BE495';
    g.fillRect(px(f.b.x) - 10, py(f.b.y) - 22, 20, 22);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(f.b.x) - 5, py(f.b.y) - 16, 4, 4);
    g.fillRect(px(f.b.x) + 2, py(f.b.y) - 16, 4, 4);
  }
  for (const b of s.bubbles) {
    g.strokeStyle = b.trapped ? COLORS.gold : COLORS.cyan;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px(b.x), py(b.y), 13, 0, TAU);
    g.stroke();
    if (b.trapped) {
      g.fillStyle = b.held > TRAP_TIME - 1.5 && Math.floor(time * 10) % 2 ? COLORS.coral : '#7BE495';
      g.fillRect(px(b.x) - 6, py(b.y) - 6, 12, 12);
    }
  }
  for (const f of s.fruit) {
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.arc(px(f.x), py(f.y) - 8, 8, 0, TAU);
    g.fill();
  }
  if (s.ghost.on) {
    g.fillStyle = Math.floor(time * 6) % 2 ? COLORS.paper : COLORS.muted;
    g.beginPath();
    g.arc(px(s.ghost.x), py(s.ghost.y), 14, Math.PI, 0);
    g.lineTo(px(s.ghost.x) + 14, py(s.ghost.y) + 14);
    g.lineTo(px(s.ghost.x) - 14, py(s.ghost.y) + 14);
    g.fill();
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(px(s.me.x) - 9, py(s.me.y) - 24, 18, 24);
    g.fillStyle = COLORS.paper;
    g.fillRect(px(s.me.x) - 4, py(s.me.y) - 30, 8, 8);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) - 3 + s.me.face * 3, py(s.me.y) - 18, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `ROUND ${s.level}  ${s.time >= HURRY_AT ? 'HURRY UP!' : ''}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ROUND CLEAR!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<BrawlerState> = {
  id: 'bubble-brawler',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
