import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const ROAD = 3.6;
const MAILBOX_X = 4.2;
const PORCH_X = 5.6;
const WINDOW_X = 7.2;
const PAPERS = 12;
const PX = 38;
const PZ = 30;
const HOUSE_GAP = 15;

interface House {
  z: number;
  side: number;
  sub: boolean;
  mail: boolean;
  porch: boolean;
  win: boolean;
  /** The subscription was cancelled by a stray paper through the window. */
  angry: boolean;
}
interface Car {
  x: number;
  z: number;
  vz: number;
  parked: boolean;
}
interface Mover {
  x: number;
  z: number;
  vx: number;
  kind: 'dog' | 'kid';
}
interface Hole {
  x: number;
  z: number;
}
interface Bundle {
  x: number;
  z: number;
}
interface Paper {
  x: number;
  z: number;
  vx: number;
  life: number;
}

export interface RouteState {
  rider: { x: number; z: number; speed: number; crash: number; invuln: number };
  length: number;
  houses: House[];
  cars: Car[];
  movers: Mover[];
  holes: Hole[];
  bundles: Bundle[];
  papers: number;
  flying: Paper[];
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

function buildStreet(s: RouteState, rng: Rng): void {
  s.length = 330 + s.level * 40;
  s.houses = [];
  s.cars = [];
  s.movers = [];
  s.holes = [];
  s.bundles = [];
  for (let z = 30, k = 0; z < s.length - 20; z += HOUSE_GAP, k++) {
    for (const side of [-1, 1]) {
      const sub = rng.next() < 0.55;
      s.houses.push({ z: z + (side > 0 ? 6 : 0), side, sub, mail: false, porch: false, win: false, angry: false });
    }
    if (k % 3 === 1) s.bundles.push({ x: rng.range(-2.5, 2.5), z: z + 8 });
  }
  for (let z = 40; z < s.length - 15; z += rng.range(11, 19)) {
    const r = rng.next();
    if (r < 0.34) s.cars.push({ x: rng.range(-ROAD + 0.8, ROAD - 0.8), z, vz: -(5 + s.level * 0.8), parked: false });
    else if (r < 0.5) s.cars.push({ x: rng.pick([-1, 1]) * (ROAD - 0.3), z, vz: 0, parked: true });
    else if (r < 0.72) s.movers.push({ x: rng.pick([-1, 1]) * (ROAD + 1.5), z, vx: 0, kind: 'dog' });
    else if (r < 0.85) s.movers.push({ x: -ROAD - 1, z, vx: 0, kind: 'kid' });
    else s.holes.push({ x: rng.range(-ROAD + 0.6, ROAD - 0.6), z });
  }
  s.papers = PAPERS;
  s.flying = [];
  Object.assign(s.rider, { x: 0, z: 0, speed: 9, crash: 0, invuln: 1.5 });
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RouteState {
  const s: RouteState = {
    rider: { x: 0, z: 0, speed: 9, crash: 0, invuln: 1.5 },
    length: 370,
    houses: [],
    cars: [],
    movers: [],
    holes: [],
    bundles: [],
    papers: PAPERS,
    flying: [],
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
  buildStreet(s, rng);
  return s;
}

function wreck(s: RouteState, rng: Rng, emit: UpdateContext['emit']): void {
  const r = s.rider;
  if (r.crash > 0 || r.invuln > 0) return;
  burst(s.sparks, rng, 400 + r.x * PX, 450, COLORS.coral, 16);
  r.crash = 1.4;
  r.speed = 0;
  s.lives -= 1;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: RouteState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildStreet(s, rng);
      emit('wave');
    }
    return;
  }
  const r = s.rider;
  r.invuln = Math.max(0, r.invuln - dt);

  if (r.crash > 0) {
    r.crash -= dt;
    if (r.crash <= 0) {
      // Back on the bike a little way on, clear of whatever you hit.
      r.z += 6;
      r.x = 0;
      r.speed = 9;
      r.invuln = 2;
      s.cars = s.cars.filter((c) => Math.abs(c.z - r.z) > 6);
      s.movers = s.movers.filter((m) => Math.abs(m.z - r.z) > 6);
    }
  } else {
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    r.x = Math.min(ROAD, Math.max(-ROAD, r.x + dx * 4.2 * dt));
    const target = input.held.up ? 13 : input.held.down ? 5 : 9;
    r.speed += Math.sign(target - r.speed) * Math.min(Math.abs(target - r.speed), 14 * dt);
    r.z += r.speed * dt;

    // Throw a paper to the left (A) or right (B).
    const left = input.pressed.a;
    const right = input.pressed.b;
    if ((left || right) && s.papers > 0) {
      s.papers -= 1;
      s.flying.push({ x: r.x, z: r.z + 0.6, vx: (right ? 1 : -1) * 13, life: 0.75 });
      emit('fire');
    }
  }

  // Papers fly sideways and hit whatever is at their end.
  for (let i = s.flying.length - 1; i >= 0; i--) {
    const p = s.flying[i]!;
    p.x += p.vx * dt;
    p.z += (r.speed + 2) * dt;
    p.life -= dt;
    const side = Math.sign(p.vx);
    const h = s.houses.find((hh) => hh.side === side && Math.abs(hh.z - p.z) < 1.4);
    let done = false;
    if (h) {
      const dist = Math.abs(p.x);
      if (!h.mail && Math.abs(dist - MAILBOX_X) < 0.55 && Math.abs(h.z - p.z) < 1.1) {
        h.mail = true;
        if (h.sub) {
          s.score += 250;
          emit('pickup');
        }
        done = true;
      } else if (!h.win && dist >= WINDOW_X - 0.4) {
        h.win = true;
        if (h.sub) {
          h.angry = true;
          h.sub = false; // a window through a subscriber's house cancels the subscription
          emit('die');
        } else {
          s.score += 400;
          burst(s.sparks, rng, 400 + p.x * PX, 300, COLORS.cyan, 8);
          emit('explode');
        }
        done = true;
      }
    }
    if (done) {
      s.flying.splice(i, 1);
      continue;
    }
    if (p.life <= 0) {
      // A paper that lands on the lawn or porch of a subscriber still counts a little.
      const hh = s.houses.find((q) => q.side === side && Math.abs(q.z - p.z) < 1.8);
      if (hh && hh.sub && !hh.porch && Math.abs(p.x) >= PORCH_X - 0.8 && Math.abs(p.x) < WINDOW_X - 0.4) {
        hh.porch = true;
        s.score += 100;
        emit('pickup');
      }
      s.flying.splice(i, 1);
    }
  }

  // Traffic and critters.
  for (const c of s.cars) {
    c.z += c.vz * dt;
    if (r.crash <= 0 && Math.abs(c.x - r.x) < 1.1 && Math.abs(c.z - r.z) < 1.6) wreck(s, rng, emit);
  }
  for (const m of s.movers) {
    if (Math.abs(m.z - r.z) < 22) m.vx = (m.kind === 'dog' ? 3.4 : 2.2) * (m.x < 0 ? 1 : -1);
    m.x += m.vx * dt;
    if (m.x > ROAD + 4 || m.x < -ROAD - 4) m.vx = 0;
    if (r.crash <= 0 && Math.abs(m.x - r.x) < 0.9 && Math.abs(m.z - r.z) < 1.1) wreck(s, rng, emit);
  }
  for (const hole of s.holes) if (r.crash <= 0 && Math.abs(hole.x - r.x) < 0.8 && Math.abs(hole.z - r.z) < 0.9) wreck(s, rng, emit);
  for (let i = s.bundles.length - 1; i >= 0; i--) {
    const b = s.bundles[i]!;
    if (r.crash <= 0 && Math.abs(b.x - r.x) < 1 && Math.abs(b.z - r.z) < 1.2) {
      s.papers = Math.min(PAPERS + 6, s.papers + 10);
      s.bundles.splice(i, 1);
      s.score += 50;
      emit('pickup');
    }
  }

  // The end of the street.
  if (r.z >= s.length && r.crash <= 0) {
    const subs = s.houses.filter((h) => h.sub || h.angry);
    const kept = subs.filter((h) => h.sub);
    const delivered = kept.filter((h) => h.mail || h.porch);
    s.score += delivered.length * 100 + (kept.length > 0 && delivered.length === kept.length ? 2000 : 0) + s.papers * 20;
    s.levelDelay = 2;
    emit('wave');
  }
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: RouteState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const r = s.rider;
  const sy = (z: number) => 460 - (z - r.z) * PZ * 0.55;
  const sx = (x: number) => 400 + x * PX;
  g.fillStyle = '#244a30';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#4a4a55';
  g.fillRect(sx(-ROAD - 0.6), 0, (ROAD * 2 + 1.2) * PX, H);
  g.fillStyle = COLORS.muted;
  for (let z = Math.floor(r.z / 6) * 6 - 6; z < r.z + 40; z += 6) g.fillRect(sx(0) - 2, sy(z), 4, 18);
  g.fillStyle = '#b9b0a0';
  g.fillRect(sx(-ROAD - 1.3), 0, 0.7 * PX, H);
  g.fillRect(sx(ROAD + 0.6), 0, 0.7 * PX, H);
  for (const h of s.houses) {
    const y = sy(h.z);
    if (y < -60 || y > H + 60) continue;
    const x0 = h.side * WINDOW_X;
    g.fillStyle = h.sub ? '#d9c9a0' : h.angry ? '#a05050' : '#8a7a8a';
    g.fillRect(sx(h.side > 0 ? 5.2 : -9.2), y - 32, 4 * PX, 64);
    g.fillStyle = h.win ? COLORS.bg : COLORS.cyan;
    g.fillRect(sx(x0) - 10, y - 12, 20, 20);
    g.fillStyle = h.mail && h.sub ? COLORS.gold : COLORS.coral;
    g.fillRect(sx(h.side * MAILBOX_X) - 6, y - 8, 12, 14);
    if (h.sub && !h.mail && !h.porch) {
      g.fillStyle = COLORS.gold;
      g.fillRect(sx(h.side * MAILBOX_X) - 3, y - 14, 6, 4);
    }
  }
  for (const hole of s.holes) {
    g.fillStyle = COLORS.bg;
    g.beginPath();
    g.ellipse(sx(hole.x), sy(hole.z), 15, 9, 0, 0, 6.3);
    g.fill();
  }
  for (const b of s.bundles) {
    g.fillStyle = COLORS.paper;
    g.fillRect(sx(b.x) - 10, sy(b.z) - 8, 20, 14);
  }
  for (const c of s.cars) {
    g.fillStyle = c.parked ? COLORS.purple : COLORS.coral;
    g.fillRect(sx(c.x) - 20, sy(c.z) - 26, 40, 52);
    g.fillStyle = COLORS.bg;
    g.fillRect(sx(c.x) - 14, sy(c.z) - 16, 28, 14);
  }
  for (const m of s.movers) {
    g.fillStyle = m.kind === 'dog' ? COLORS.gold : COLORS.cyan;
    g.fillRect(sx(m.x) - 10, sy(m.z) - 8, m.kind === 'dog' ? 24 : 14, m.kind === 'dog' ? 14 : 22);
  }
  for (const p of s.flying) {
    g.fillStyle = COLORS.paper;
    g.fillRect(sx(p.x) - 5, sy(p.z) - 4, 10, 8);
  }
  if (r.crash <= 0 || Math.floor(time * 12) % 2) {
    g.fillStyle = r.invuln > 0 && Math.floor(time * 10) % 2 === 0 ? COLORS.paper : COLORS.cyan;
    g.fillRect(sx(r.x) - 6, 440, 12, 36);
    g.fillStyle = COLORS.gold;
    g.fillRect(sx(r.x) - 9, 428, 18, 16);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `DAY ${s.level}  PAPERS ${s.papers}  ${Math.min(100, Math.floor((r.z / s.length) * 100))}%`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ROUTE COMPLETE!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<RouteState> = {
  id: 'route-rider',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
