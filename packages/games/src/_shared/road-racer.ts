import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, clear, gameOver, hud, makeStatus } from './ui';

/** Pseudo-3D racer archetype (R3): scanline road, curves from a seeded track, traffic and a checkpoint clock. */
export interface RoadConfig {
  id: string;
  sky: string;
  grass: [string, string];
  rumble: [string, string];
  road: [string, string];
  /** Maximum curve strength. */
  curve: number;
  /** Cars per 1000 units of track. */
  traffic: number;
  /** Seconds added at each checkpoint. */
  bonusTime: number;
  /** Driving off the road slows you; stronger values hurt more. */
  offroad: number;
  /** Dark tunnel look: draws only lit lane markers and a vignette. */
  tunnel?: boolean;
}

const SEG = 200;
const HORIZON = 210;
const DRAW = 140;
const CHECKPOINT = 3000;
const MAX_SPEED = 330;

interface Car { z: number; x: number; speed: number; color: number }

export interface RoadState {
  /** Curve per segment; the track loops. */
  curves: number[];
  hills: number[];
  z: number;
  x: number;
  speed: number;
  cars: Car[];
  time: number;
  checkpoint: number;
  crash: number;
  passed: number;
  score: number;
  hi: number;
  over: boolean;
}

const CAR_COLORS = [COLORS.coral, COLORS.gold, COLORS.purple, '#7BE495', '#FF9F68'];

export function createRoadRacer(cfg: RoadConfig): GameDefinition<RoadState> {
  const N = 600;
  const trackLen = N * SEG;

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RoadState {
    const curves: number[] = [];
    const hills: number[] = [];
    let i = 0;
    while (i < N) {
      const len = rng.int(20, 60);
      const c = rng.next() < 0.35 ? 0 : rng.range(-cfg.curve, cfg.curve);
      const h = rng.range(-1, 1);
      for (let k = 0; k < len && i < N; k++, i++) {
        const ease = Math.min(1, k / 10, (len - k) / 10);
        curves.push(c * ease || 0);
        hills.push(h * Math.sin((k / len) * Math.PI) * 40 || 0);
      }
    }
    const cars: Car[] = [];
    const count = Math.floor((trackLen / 1000) * cfg.traffic);
    for (let n = 0; n < count; n++) {
      cars.push({ z: rng.range(2500, trackLen - 500), x: rng.pick([-0.6, -0.2, 0.2, 0.6]), speed: rng.range(90, 180), color: rng.int(0, CAR_COLORS.length - 1) });
    }
    return { curves, hills, z: 0, x: 0, speed: 0, cars, time: 45, checkpoint: 1, crash: 0, passed: 0, score: 0, hi: hiScore, over: false };
  }

  const segAt = (s: RoadState, z: number) => Math.floor(((z % trackLen) + trackLen) % trackLen / SEG) % N;

  function update(s: RoadState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    if (s.over) {
      if (input.pressed.a || input.pressed.start) {
        Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
        emit('start');
      }
      return;
    }

    s.time -= dt;
    if (s.time <= 0) {
      s.time = 0;
      s.over = true;
      emit('die');
      return;
    }

    const accel = input.held.a || input.held.up;
    const brake = input.held.down || input.held.b;
    const crashed = s.crash > 0;
    s.crash = Math.max(0, s.crash - dt);
    if (accel && !crashed) s.speed += 140 * dt;
    else s.speed -= 70 * dt;
    if (brake) s.speed -= 260 * dt;
    const offRoad = Math.abs(s.x) > 1;
    const cap = offRoad ? MAX_SPEED * (1 - cfg.offroad) : MAX_SPEED;
    if (s.speed > cap) s.speed -= 260 * dt;
    s.speed = Math.min(MAX_SPEED, Math.max(0, s.speed));

    const steer = ((input.held.right ? 1 : 0) - (input.held.left ? 1 : 0)) * 1.9 * dt * (s.speed / MAX_SPEED + 0.15);
    s.x += steer;
    // Curves push you outward in proportion to speed.
    s.x -= s.curves[segAt(s, s.z)]! * (s.speed / MAX_SPEED) * 0.9 * dt * 3;
    s.x = Math.min(2.2, Math.max(-2.2, s.x));

    const prevZ = s.z;
    s.z += s.speed * dt * 10;
    s.score += Math.floor(s.speed * dt * 0.6);

    for (const c of s.cars) {
      const prev = c.z;
      c.z += c.speed * dt * 10;
      if (c.z >= trackLen) c.z -= trackLen;
      void prev;
      let dz = c.z - s.z;
      if (dz < -trackLen / 2) dz += trackLen;
      if (dz > trackLen / 2) dz -= trackLen;
      if (dz > 0 && dz < 200 && Math.abs(c.x - s.x) < 0.3 && s.crash <= 0) {
        s.crash = 1.2;
        s.speed = Math.min(s.speed, c.speed * 0.5);
        emit('die');
      }
      if (prevZ < c.z && dz < 0 && dz > -s.speed * dt * 10 - c.speed * dt * 10 - 1 && s.speed > c.speed && !s.over) {
        s.passed += 1;
        s.score += 50;
      }
    }

    if (s.z >= s.checkpoint * CHECKPOINT) {
      s.checkpoint += 1;
      s.time += cfg.bonusTime;
      s.score += 500;
      emit('wave');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function render(s: RoadState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    g.fillStyle = cfg.sky;
    g.fillRect(0, 0, W, HORIZON);
    const start = segAt(s, s.z);
    // Project each visible segment from near to far, tracking the horizontal curve offset.
    let x = 0;
    let dx = 0;
    const rows: { y: number; w: number; cx: number; i: number }[] = [];
    for (let n = 0; n < DRAW; n++) {
      const i = (start + n) % N;
      dx += s.curves[i]!;
      x += dx;
      const depth = (n + 1 - (s.z % SEG) / SEG) * SEG;
      const scale = Math.min(1.6, 300 / depth);
      const w = 640 * scale;
      rows.push({ y: HORIZON + (H - HORIZON) * scale - s.hills[i]! * scale * 0.6, w, cx: W / 2 - s.x * w * 0.5 + x * scale, i });
    }
    // Draw back to front.
    for (let n = rows.length - 1; n >= 0; n--) {
      const r = rows[n]!;
      const nextY = n === 0 ? H : rows[n - 1]!.y;
      const top = Math.min(r.y, nextY);
      const bot = Math.max(r.y, nextY);
      const alt = Math.floor(r.i / 3) % 2;
      g.fillStyle = cfg.grass[alt]!;
      g.fillRect(0, top, W, bot - top + 1);
      g.fillStyle = cfg.rumble[alt]!;
      g.fillRect(r.cx - r.w * 0.55, top, r.w * 1.1, bot - top + 1);
      g.fillStyle = cfg.road[alt]!;
      g.fillRect(r.cx - r.w * 0.5, top, r.w, bot - top + 1);
      if (alt === 0) {
        g.fillStyle = COLORS.paper;
        g.fillRect(r.cx - r.w * 0.01, top, r.w * 0.02, bot - top + 1);
      }
    }

    // Traffic, drawn far to near.
    const visible = s.cars
      .map((c) => {
        let dz = c.z - s.z;
        if (dz < -trackLen / 2) dz += trackLen;
        if (dz > trackLen / 2) dz -= trackLen;
        return { c, dz };
      })
      .filter(({ dz }) => dz > 0 && dz < DRAW * SEG)
      .sort((a, b) => b.dz - a.dz);
    for (const { c, dz } of visible) {
      const n = Math.min(DRAW - 1, Math.floor(dz / SEG));
      const r = rows[n]!;
      const w = r.w * 0.22;
      const cx = r.cx + c.x * r.w * 0.5;
      g.fillStyle = CAR_COLORS[c.color]!;
      g.fillRect(cx - w / 2, r.y - w * 0.7, w, w * 0.7);
      g.fillStyle = COLORS.bg;
      g.fillRect(cx - w * 0.35, r.y - w * 0.6, w * 0.7, w * 0.25);
    }

    if (cfg.tunnel) {
      const grad = g.createRadialGradient(W / 2, H * 0.7, 80, W / 2, H * 0.7, 520);
      grad.addColorStop(0, 'rgba(18,10,42,0)');
      grad.addColorStop(1, 'rgba(18,10,42,0.88)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }

    // Player car.
    const shake = s.crash > 0 ? Math.sin(time * 60) * 4 : 0;
    g.fillStyle = COLORS.cyan;
    g.fillRect(W / 2 - 38 + shake, H - 90, 76, 34);
    g.fillStyle = COLORS.paper;
    g.fillRect(W / 2 - 24 + shake, H - 106, 48, 18);
    g.fillStyle = COLORS.bg;
    g.fillRect(W / 2 - 42 + shake, H - 62, 14, 14);
    g.fillRect(W / 2 + 28 + shake, H - 62, 14, 14);

    hud(g, s, `SPEED ${Math.round(s.speed)}   TIME ${Math.ceil(s.time)}   STAGE ${s.checkpoint}`);
    if (s.crash > 0.8) banner(g, 'CRASH!', 200);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.over ? 0 : 1, s.checkpoint) };
}
