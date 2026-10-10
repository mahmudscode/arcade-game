import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, TAU, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const HORIZON = 230;
const FOCUS = 520;
const EYE = 14;
const NEAR = 8;
const ARENA = 900;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 15000;
const POINTS = { tank: 1000, missile: 2000, saucer: 5000 } as const;

type Kind = 'tank' | 'missile' | 'saucer';

interface Enemy {
  kind: Kind;
  x: number;
  z: number;
  a: number;
  /** Seconds until this enemy may fire (tanks). */
  cd: number;
  /** Saucer drift speed along x. */
  vx: number;
}
interface Shell {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  /** True for the player's shell. */
  mine: boolean;
}
interface Obstacle {
  x: number;
  z: number;
  r: number;
  pyramid: boolean;
}
interface Boom {
  x: number;
  y: number;
  z: number;
  life: number;
}

export interface TankerState {
  me: { x: number; z: number; a: number; alive: boolean; invuln: number };
  enemies: Enemy[];
  shells: Shell[];
  booms: Boom[];
  obstacles: Obstacle[];
  /** Skyline heights by 10-degree bucket. */
  peaks: number[];
  wave: number;
  waveDelay: number;
  saucerTimer: number;
  respawn: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  over: boolean;
}

const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function makeObstacles(rng: Rng): Obstacle[] {
  const out: Obstacle[] = [];
  for (let tries = 0; out.length < 14 && tries < 200; tries++) {
    const x = rng.range(-ARENA + 80, ARENA - 80);
    const z = rng.range(-ARENA + 80, ARENA - 80);
    const r = rng.range(26, 40);
    const pyramid = rng.next() < 0.5;
    if (Math.hypot(x, z) < 160 || out.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 60)) continue;
    out.push({ x, z, r, pyramid });
  }
  return out;
}

function blocked(s: TankerState, x: number, z: number, r: number): boolean {
  if (Math.abs(x) > ARENA || Math.abs(z) > ARENA) return true;
  return s.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
}

function spawnWave(s: TankerState, rng: Rng): void {
  const tanks = Math.min(1 + Math.floor((s.wave - 1) / 3), 3);
  const place = (kind: Kind) => {
    for (let tries = 0; tries < 40; tries++) {
      const ang = rng.range(0, TAU);
      const d = rng.range(520, 760);
      const x = s.me.x + Math.cos(ang) * d;
      const z = s.me.z + Math.sin(ang) * d;
      if (!blocked(s, x, z, 30)) {
        s.enemies.push({ kind, x, z, a: rng.range(0, TAU), cd: rng.range(1.5, 3.5), vx: 0 });
        return;
      }
    }
  };
  for (let i = 0; i < tanks; i++) place('tank');
  if (s.wave >= 3 && s.wave % 2 === 1) place('missile');
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): TankerState {
  const s: TankerState = {
    me: { x: 0, z: 0, a: 0, alive: true, invuln: 1.5 },
    enemies: [],
    shells: [],
    booms: [],
    obstacles: makeObstacles(rng),
    peaks: Array.from({ length: 36 }, () => rng.range(6, 38)),
    wave: 1,
    waveDelay: 0,
    saucerTimer: rng.range(14, 24),
    respawn: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    over: false,
  };
  spawnWave(s, rng);
  return s;
}

function boom(s: TankerState, x: number, y: number, z: number): void {
  s.booms.push({ x, y, z, life: 0.7 });
}

function killPlayer(s: TankerState, emit: UpdateContext['emit']): void {
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.8;
  boom(s, s.me.x, 6, s.me.z);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function moveWithSlide(s: TankerState, e: { x: number; z: number }, dx: number, dz: number, r: number): void {
  if (!blocked(s, e.x + dx, e.z + dz, r)) {
    e.x += dx;
    e.z += dz;
  } else if (!blocked(s, e.x + dx, e.z, r)) e.x += dx;
  else if (!blocked(s, e.x, e.z + dz, r)) e.z += dz;
}

function update(s: TankerState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepEffects(s, dt);
    return;
  }

  const me = s.me;
  const wasAlive = me.alive;
  if (me.alive) {
    me.invuln = Math.max(0, me.invuln - dt);
    if (input.held.left) me.a -= 1.7 * dt;
    if (input.held.right) me.a += 1.7 * dt;
    me.a = norm(me.a);
    const drive = (input.held.up ? 1 : 0) - (input.held.down ? 0.6 : 0);
    if (drive !== 0) moveWithSlide(s, me, Math.cos(me.a) * 130 * drive * dt, Math.sin(me.a) * 130 * drive * dt, 14);
    // One shell in flight at a time, like the arcade tank.
    if ((input.pressed.a || input.pressed.b) && !s.shells.some((sh) => sh.mine)) {
      s.shells.push({ x: me.x, z: me.z, vx: Math.cos(me.a) * 720, vz: Math.sin(me.a) * 720, life: 1.3, mine: true });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) Object.assign(me, { x: 0, z: 0, a: 0, alive: true, invuln: 2.2 });
  }

  // Enemies.
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i]!;
    if (e.kind === 'saucer') {
      e.x += e.vx * dt;
      if (Math.abs(e.x) > ARENA + 60) s.enemies.splice(i, 1);
      continue;
    }
    const dx = me.x - e.x;
    const dz = me.z - e.z;
    const dist = Math.hypot(dx, dz);
    const diff = norm(Math.atan2(dz, dx) - e.a);
    const turnRate = e.kind === 'tank' ? 0.9 : 1.6;
    e.a += clamp(diff, -turnRate * dt, turnRate * dt);
    if (e.kind === 'tank') {
      if (dist > 360 && Math.abs(diff) < 0.7) moveWithSlide(s, e, Math.cos(e.a) * 62 * dt, Math.sin(e.a) * 62 * dt, 26);
      e.cd -= dt;
      if (me.alive && e.cd <= 0 && Math.abs(diff) < 0.12 && dist < 680) {
        s.shells.push({ x: e.x, z: e.z, vx: Math.cos(e.a) * 270, vz: Math.sin(e.a) * 270, life: 3.2, mine: false });
        e.cd = rng.range(2.4, 4.4);
      }
    } else {
      const nx = e.x + Math.cos(e.a) * 195 * dt;
      const nz = e.z + Math.sin(e.a) * 195 * dt;
      if (blocked(s, nx, nz, 12)) {
        boom(s, e.x, 5, e.z);
        s.enemies.splice(i, 1);
        emit('explode');
        continue;
      }
      e.x = nx;
      e.z = nz;
      if (me.alive && me.invuln <= 0 && dist < 24) {
        killPlayer(s, emit);
        boom(s, e.x, 5, e.z);
        s.enemies.splice(i, 1);
      }
    }
  }

  // Shells.
  for (let i = s.shells.length - 1; i >= 0; i--) {
    const sh = s.shells[i]!;
    sh.x += sh.vx * dt;
    sh.z += sh.vz * dt;
    sh.life -= dt;
    if (sh.life <= 0 || blocked(s, sh.x, sh.z, 0)) {
      if (sh.life > 0) boom(s, sh.x, 4, sh.z);
      s.shells.splice(i, 1);
      continue;
    }
    if (sh.mine) {
      const hit = s.enemies.findIndex((e) => Math.hypot(e.x - sh.x, e.z - sh.z) < (e.kind === 'saucer' ? 26 : 24));
      if (hit >= 0) {
        const e = s.enemies[hit]!;
        s.score += POINTS[e.kind];
        boom(s, e.x, e.kind === 'saucer' ? 55 : 8, e.z);
        s.enemies.splice(hit, 1);
        s.shells.splice(i, 1);
        emit('explode');
      }
    } else if (me.alive && me.invuln <= 0 && Math.hypot(me.x - sh.x, me.z - sh.z) < 17) {
      s.shells.splice(i, 1);
      killPlayer(s, emit);
    }
  }

  // Enemy fire in flight is cleared once the tank is lost (after the loops, so indices stay valid).
  if (wasAlive && !me.alive) s.shells = s.shells.filter((sh) => sh.mine);

  // Bonus saucer.
  s.saucerTimer -= dt;
  if (s.saucerTimer <= 0) {
    s.saucerTimer = rng.range(18, 30);
    if (!s.enemies.some((e) => e.kind === 'saucer')) {
      const dir = rng.next() < 0.5 ? 1 : -1;
      s.enemies.push({ kind: 'saucer', x: -dir * (ARENA + 40), z: rng.range(-500, 500), a: 0, cd: 0, vx: dir * 95 });
    }
  }

  // Next wave once the ground threats are gone.
  if (!s.over && !s.enemies.some((e) => e.kind !== 'saucer')) {
    s.waveDelay += dt;
    if (s.waveDelay >= 1.6) {
      s.waveDelay = 0;
      s.wave += 1;
      spawnWave(s, rng);
      emit('wave');
    }
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  stepEffects(s, dt);
  if (s.score > s.hi) s.hi = s.score;
}

function stepEffects(s: TankerState, dt: number): void {
  for (let i = s.booms.length - 1; i >= 0; i--) {
    s.booms[i]!.life -= dt;
    if (s.booms[i]!.life <= 0) s.booms.splice(i, 1);
  }
}

// ---- rendering: tiny wireframe 3D ------------------------------------------------------

type V3 = readonly [number, number, number];
type Seg = readonly [V3, V3];

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Seg[] {
  const c = (x: number, y: number, z: number): V3 => [x, y, z];
  const p = [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1), c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)];
  const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
  return e.map(([a, b]) => [p[a]!, p[b]!] as Seg);
}
const TANK_MODEL: Seg[] = [...box(-22, 22, 0, 10, -14, 14), ...box(-8, 12, 10, 18, -8, 8), [[12, 14, 0], [36, 14, 0]]];
const MISSILE_MODEL: Seg[] = [...box(-18, 18, 3, 11, -4, 4), [[18, 7, 0], [30, 7, 0]]];
const SAUCER_MODEL: Seg[] = (() => {
  const out: Seg[] = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU;
    const a1 = ((i + 1) / 8) * TAU;
    out.push([[Math.cos(a0) * 24, 52, Math.sin(a0) * 24], [Math.cos(a1) * 24, 52, Math.sin(a1) * 24]]);
    out.push([[Math.cos(a0) * 24, 52, Math.sin(a0) * 24], [0, 64, 0]]);
  }
  return out;
})();

class Camera {
  private readonly cos: number;
  private readonly sin: number;
  constructor(private readonly s: TankerState) {
    this.cos = Math.cos(s.me.a);
    this.sin = Math.sin(s.me.a);
  }
  /** Depth along the view direction and screen position of a world point. */
  rel(x: number, y: number, z: number): { f: number; r: number; y: number } {
    const dx = x - this.s.me.x;
    const dz = z - this.s.me.z;
    return { f: dx * this.cos + dz * this.sin, r: -dx * this.sin + dz * this.cos, y: y - EYE };
  }
  line(g: CanvasRenderingContext2D, a: V3, b: V3): void {
    let pa = this.rel(...a);
    let pb = this.rel(...b);
    if (pa.f < NEAR && pb.f < NEAR) return;
    if (pa.f < NEAR) pa = lerpTo(pa, pb);
    else if (pb.f < NEAR) pb = lerpTo(pb, pa);
    g.moveTo(W / 2 + (FOCUS * pa.r) / pa.f, HORIZON - (FOCUS * pa.y) / pa.f);
    g.lineTo(W / 2 + (FOCUS * pb.r) / pb.f, HORIZON - (FOCUS * pb.y) / pb.f);
  }
}
function lerpTo(behind: { f: number; r: number; y: number }, front: { f: number; r: number; y: number }) {
  const t = (NEAR - behind.f) / (front.f - behind.f);
  return { f: NEAR, r: behind.r + (front.r - behind.r) * t, y: behind.y + (front.y - behind.y) * t };
}

function model(g: CanvasRenderingContext2D, cam: Camera, segs: Seg[], x: number, z: number, a: number): void {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const w = (v: V3): V3 => [x + v[0] * c - v[2] * sn, v[1], z + v[0] * sn + v[2] * c];
  for (const [p, q] of segs) cam.line(g, w(p), w(q));
}

function render(s: TankerState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const cam = new Camera(s);
  g.lineWidth = 2;

  // Skyline, drawn by bearing so it turns with the tank.
  g.strokeStyle = COLORS.muted;
  g.beginPath();
  for (let i = 0; i <= 36; i++) {
    const bearing = (i / 36) * TAU;
    const d = norm(bearing - s.me.a);
    if (Math.abs(d) > 1.3) continue;
    const px = W / 2 + FOCUS * Math.tan(d);
    const py = HORIZON - s.peaks[i % 36]! * 1.4;
    if (i === 0 || Math.abs(norm(((i - 1) / 36) * TAU - s.me.a)) > 1.3) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  g.beginPath();
  g.moveTo(0, HORIZON);
  g.lineTo(W, HORIZON);
  g.stroke();

  // Ground grid gives a sense of motion.
  g.strokeStyle = 'rgba(167,139,250,0.28)';
  g.beginPath();
  for (let k = -ARENA; k <= ARENA; k += 150) {
    for (let t = -ARENA; t < ARENA; t += 150) {
      cam.line(g, [k, 0, t], [k, 0, t + 150]);
      cam.line(g, [t, 0, k], [t + 150, 0, k]);
    }
  }
  g.stroke();

  g.strokeStyle = COLORS.purple;
  g.beginPath();
  for (const o of s.obstacles) {
    const k = o.r * 0.8;
    if (o.pyramid) {
      const base: V3[] = [[o.x - k, 0, o.z - k], [o.x + k, 0, o.z - k], [o.x + k, 0, o.z + k], [o.x - k, 0, o.z + k]];
      base.forEach((p, i) => {
        cam.line(g, p, base[(i + 1) % 4]!);
        cam.line(g, p, [o.x, k * 2, o.z]);
      });
    } else for (const [p, q] of box(o.x - k, o.x + k, 0, k * 1.6, o.z - k, o.z + k)) cam.line(g, p, q);
  }
  g.stroke();

  g.strokeStyle = COLORS.coral;
  g.beginPath();
  for (const e of s.enemies) if (e.kind !== 'saucer') model(g, cam, e.kind === 'tank' ? TANK_MODEL : MISSILE_MODEL, e.x, e.z, e.a);
  g.stroke();
  g.strokeStyle = COLORS.gold;
  g.beginPath();
  for (const e of s.enemies) if (e.kind === 'saucer') model(g, cam, SAUCER_MODEL, e.x, e.z, time * 2);
  for (const sh of s.shells) {
    const len = 0.04;
    cam.line(g, [sh.x, 8, sh.z], [sh.x - sh.vx * len, 8, sh.z - sh.vz * len]);
  }
  g.stroke();

  g.strokeStyle = COLORS.cyan;
  g.beginPath();
  for (const b of s.booms) {
    const t = 1 - b.life / 0.7;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const r0 = 6 + t * 20;
      const r1 = 14 + t * 46;
      cam.line(g, [b.x + Math.cos(a) * r0, b.y + Math.sin(a * 2) * r0 * 0.5, b.z + Math.sin(a) * r0], [b.x + Math.cos(a) * r1, b.y + Math.sin(a * 2) * r1 * 0.5 + t * 14, b.z + Math.sin(a) * r1]);
    }
  }
  g.stroke();

  if (s.me.alive) {
    g.strokeStyle = COLORS.paper;
    g.beginPath();
    g.moveTo(W / 2 - 12, HORIZON + 70);
    g.lineTo(W / 2 + 12, HORIZON + 70);
    g.moveTo(W / 2, HORIZON + 58);
    g.lineTo(W / 2, HORIZON + 82);
    g.stroke();
  } else {
    g.fillStyle = 'rgba(255,93,115,0.22)';
    g.fillRect(0, 0, W, H);
  }

  radar(s, g, time);
  hud(g, s, `WAVE ${s.wave}`, s.lives);
  gameOver(g, s.over);
}

function radar(s: TankerState, g: CanvasRenderingContext2D, time: number): void {
  const cx = W / 2;
  const cy = 64;
  const R = 44;
  g.strokeStyle = COLORS.cyan;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.stroke();
  g.globalAlpha = 0.5;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(time * 3) * R, cy + Math.sin(time * 3) * R);
  g.stroke();
  g.globalAlpha = 1;
  const c = Math.cos(s.me.a);
  const n = Math.sin(s.me.a);
  const k = R / 800;
  for (const e of s.enemies) {
    const dx = e.x - s.me.x;
    const dz = e.z - s.me.z;
    const fwd = dx * c + dz * n;
    const right = -dx * n + dz * c;
    const d = Math.hypot(right, fwd) * k;
    if (d > R - 2) continue;
    g.fillStyle = e.kind === 'saucer' ? COLORS.gold : COLORS.coral;
    g.fillRect(cx + right * k - 2, cy - fwd * k - 2, 5, 5);
  }
  g.fillStyle = COLORS.paper;
  g.fillRect(cx - 1, cy - 1, 3, 3);
}

const game: GameDefinition<TankerState> = {
  id: 'grid-tanker',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};
export default game;
