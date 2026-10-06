import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const CX = W / 2;
const CY = H / 2;
const RINGS = [{ r: 56, n: 8, speed: 0.9 }, { r: 92, n: 12, speed: -0.6 }, { r: 128, n: 16, speed: 0.4 }];
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const TAU = Math.PI * 2;

export interface CrusherState {
  ship: { x: number; y: number; vx: number; vy: number; angle: number; cool: number; invuln: number; alive: boolean };
  bullets: { x: number; y: number; vx: number; vy: number; life: number }[];
  shots: { x: number; y: number; vx: number; vy: number }[];
  /** Per ring, whether each segment is still intact. */
  segs: boolean[][];
  spin: number[];
  coreTimer: number;
  coreHit: number;
  sparks: Spark[];
  respawn: number;
  waveDelay: number;
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  nextLife: number;
}

function newCastle(s: CrusherState): void {
  s.segs = RINGS.map((r) => Array.from({ length: r.n }, () => true));
  s.spin = RINGS.map(() => 0);
  s.coreTimer = 2.5;
  s.coreHit = 0;
  s.shots = [];
}

function resetShip(s: CrusherState): void {
  s.ship = { x: 120, y: CY, vx: 0, vy: 0, angle: 0, cool: 0, invuln: 2, alive: true };
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): CrusherState {
  void rng;
  const s: CrusherState = {
    ship: { x: 120, y: CY, vx: 0, vy: 0, angle: 0, cool: 0, invuln: 2, alive: true },
    bullets: [],
    shots: [],
    segs: [],
    spin: [],
    coreTimer: 0,
    coreHit: 0,
    sparks: [],
    respawn: 0,
    waveDelay: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    nextLife: EXTRA_LIFE_EVERY,
  };
  newCastle(s);
  return s;
}

const segPos = (s: CrusherState, ring: number, i: number) => {
  const r = RINGS[ring]!;
  const a = s.spin[ring]! + (i / r.n) * TAU;
  return { x: CX + Math.cos(a) * r.r, y: CY + Math.sin(a) * r.r };
};

function update(s: CrusherState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  RINGS.forEach((r, i) => (s.spin[i]! += r.speed * (1 + s.wave * 0.08) * dt));

  const ship = s.ship;
  if (ship.alive) {
    if (input.held.left) ship.angle -= 4 * dt;
    if (input.held.right) ship.angle += 4 * dt;
    if (input.held.up || input.held.b) {
      ship.vx += Math.cos(ship.angle) * 220 * dt;
      ship.vy += Math.sin(ship.angle) * 220 * dt;
    }
    ship.vx *= 1 - 0.5 * dt;
    ship.vy *= 1 - 0.5 * dt;
    ship.x = (ship.x + ship.vx * dt + W) % W;
    ship.y = (ship.y + ship.vy * dt + H) % H;
    ship.cool -= dt;
    ship.invuln = Math.max(0, ship.invuln - dt);
    if (input.held.a && ship.cool <= 0 && s.bullets.length < 6) {
      ship.cool = 0.2;
      s.bullets.push({ x: ship.x + Math.cos(ship.angle) * 14, y: ship.y + Math.sin(ship.angle) * 14, vx: Math.cos(ship.angle) * 520, vy: Math.sin(ship.angle) * 520, life: 1.1 });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) resetShip(s);
  }

  // Core fires at the ship.
  s.coreTimer -= dt;
  if (s.coreTimer <= 0 && ship.alive) {
    s.coreTimer = Math.max(0.9, 2.4 - s.wave * 0.12);
    const a = Math.atan2(ship.y - CY, ship.x - CX);
    s.shots.push({ x: CX, y: CY, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230 });
  }
  s.coreHit = Math.max(0, s.coreHit - dt);

  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    if (sh.x < 0 || sh.x > W || sh.y < 0 || sh.y > H) s.shots.splice(i, 1);
    else if (ship.alive && ship.invuln <= 0 && Math.hypot(sh.x - ship.x, sh.y - ship.y) < 12) {
      s.shots.splice(i, 1);
      killShip(s, rng, emit);
    }
  }

  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.x = (b.x + b.vx * dt + W) % W;
    b.y = (b.y + b.vy * dt + H) % H;
    b.life -= dt;
    let remove = b.life <= 0;
    for (let ring = 0; ring < RINGS.length && !remove; ring++) {
      for (let k = 0; k < RINGS[ring]!.n; k++) {
        if (!s.segs[ring]![k]) continue;
        const p = segPos(s, ring, k);
        if (Math.hypot(p.x - b.x, p.y - b.y) < 13) {
          s.segs[ring]![k] = false;
          s.score += 50 * (RINGS.length - ring);
          burst(s.sparks, rng, p.x, p.y, COLORS.gold, 6);
          emit('explode');
          remove = true;
          break;
        }
      }
    }
    // The core is only vulnerable once every ring has a gap that lets a shot through.
    if (!remove && Math.hypot(b.x - CX, b.y - CY) < 20) {
      s.coreHit = 0.3;
      s.score += 1000;
      burst(s.sparks, rng, CX, CY, COLORS.coral, 40);
      emit('wave');
      s.shots = [];
      s.bullets = [];
      s.waveDelay = 1.3;
      newCastle(s);
      s.wave += 1;
      break;
    }
    if (remove) s.bullets.splice(i, 1);
  }

  // Ring segments hurt the ship on contact.
  if (ship.alive && ship.invuln <= 0) {
    for (let ring = 0; ring < RINGS.length; ring++) {
      for (let k = 0; k < RINGS[ring]!.n; k++) {
        if (!s.segs[ring]![k]) continue;
        const p = segPos(s, ring, k);
        if (Math.hypot(p.x - ship.x, p.y - ship.y) < 17) {
          killShip(s, rng, emit);
          ring = RINGS.length;
          break;
        }
      }
    }
  }
  // Rings slowly rebuild so camping at one gap is not free.
  s.segs.forEach((ring, ri) => {
    if (rng.next() < dt * 0.15) {
      const gaps = ring.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (gaps.length > 0 && ri > 0) ring[rng.pick(gaps)] = true;
    }
  });

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function killShip(s: CrusherState, rng: Rng, emit: UpdateContext['emit']): void {
  const ship = s.ship;
  ship.alive = false;
  s.lives -= 1;
  s.respawn = 1.3;
  burst(s.sparks, rng, ship.x, ship.y, COLORS.cyan, 24);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function render(s: CrusherState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  s.segs.forEach((ring, ri) => {
    ring.forEach((alive, k) => {
      if (!alive) return;
      const p = segPos(s, ri, k);
      g.fillStyle = [COLORS.purple, COLORS.cyan, COLORS.gold][ri]!;
      g.fillRect(p.x - 9, p.y - 9, 18, 18);
    });
  });
  g.fillStyle = s.coreHit > 0 ? COLORS.paper : COLORS.coral;
  g.beginPath();
  g.arc(CX, CY, 16 + Math.sin(time * 6) * 2, 0, TAU);
  g.fill();
  g.fillStyle = COLORS.coral;
  for (const sh of s.shots) g.fillRect(sh.x - 3, sh.y - 3, 7, 7);
  g.fillStyle = COLORS.gold;
  for (const b of s.bullets) g.fillRect(b.x - 2, b.y - 2, 5, 5);
  const ship = s.ship;
  if (ship.alive && (ship.invuln <= 0 || Math.floor(ship.invuln * 10) % 2 === 0)) {
    g.save();
    g.translate(ship.x, ship.y);
    g.rotate(ship.angle);
    g.fillStyle = COLORS.cyan;
    g.beginPath();
    g.moveTo(15, 0);
    g.lineTo(-11, 10);
    g.lineTo(-6, 0);
    g.lineTo(-11, -10);
    g.closePath();
    g.fill();
    g.restore();
  }
  drawSparks(g, s.sparks);
  hud(g, s, `WAVE ${s.wave}`, s.lives);
  gameOver(g, s.over);
}

const game: GameDefinition<CrusherState> = {
  id: 'core-crusher',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};
export default game;
