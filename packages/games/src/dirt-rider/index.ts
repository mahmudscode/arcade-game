import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const LANES = 3;
const MAX_SPEED = 62;
const TURBO_SPEED = 90;
const GRAVITY = 32;
const GOOD_PITCH_LOW = -0.45;
const GOOD_PITCH_HIGH = 0.5;
const OVERHEAT = 100;
const CRASH_TIME = 1.5;

interface Ramp {
  x: number;
  /** 1 = a small jump, 2 = a big one. */
  h: number;
}
interface Hurdle {
  x: number;
  lane: number;
}
interface Mud {
  x0: number;
  x1: number;
  lane: number;
}
interface Strip {
  x: number;
  lane: number;
  kind: 'speed' | 'cool';
}
interface Rival {
  x: number;
  lane: number;
  v: number;
}

export interface RiderState {
  bike: { x: number; v: number; lane: number; laneY: number; z: number; vz: number; pitch: number; heat: number; crash: number; stalled: number };
  length: number;
  ramps: Ramp[];
  hurdles: Hurdle[];
  mud: Mud[];
  strips: Strip[];
  rivals: Rival[];
  sparks: Spark[];
  time: number;
  limit: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

function buildTrack(s: RiderState, rng: Rng): void {
  s.length = 3000 + s.level * 600;
  s.ramps = [];
  s.hurdles = [];
  s.mud = [];
  s.strips = [];
  s.rivals = [];
  let x = 220;
  while (x < s.length - 200) {
    const r = rng.next();
    const lane = rng.int(0, LANES - 1);
    if (r < 0.28) s.ramps.push({ x, h: rng.next() < 0.3 + s.level * 0.05 ? 2 : 1 });
    else if (r < 0.5) for (let l = 0; l < LANES; l++) if (l !== lane || rng.next() < 0.4) s.hurdles.push({ x: x + l * 3, lane: l });
    else if (r < 0.66) s.mud.push({ x0: x, x1: x + rng.range(35, 70), lane });
    else if (r < 0.82) s.strips.push({ x, lane, kind: 'speed' });
    else s.strips.push({ x, lane, kind: 'cool' });
    x += rng.range(70, 130);
  }
  const rivals = Math.min(2 + s.level, 6);
  for (let k = 0; k < rivals; k++) s.rivals.push({ x: 500 + k * (s.length / (rivals + 1)), lane: rng.int(0, LANES - 1), v: rng.range(38, 52) });
  s.limit = Math.round(s.length / 42 + 18);
  s.time = 0;
  Object.assign(s.bike, { x: 0, v: 0, lane: 1, laneY: 1, z: 0, vz: 0, pitch: 0, heat: 0, crash: 0, stalled: 0 });
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RiderState {
  const s: RiderState = {
    bike: { x: 0, v: 0, lane: 1, laneY: 1, z: 0, vz: 0, pitch: 0, heat: 0, crash: 0, stalled: 0 },
    length: 3600,
    ramps: [],
    hurdles: [],
    mud: [],
    strips: [],
    rivals: [],
    sparks: [],
    time: 0,
    limit: 100,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  buildTrack(s, rng);
  return s;
}

function crash(s: RiderState, rng: Rng, emit: UpdateContext['emit']): void {
  const b = s.bike;
  if (b.crash > 0) return;
  b.crash = CRASH_TIME;
  b.v = 0;
  b.z = 0;
  b.vz = 0;
  b.pitch = 0;
  burst(s.sparks, rng, 160, 360 + b.laneY * 40, COLORS.coral, 14);
  emit('die');
}

function update(s: RiderState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildTrack(s, rng);
      emit('wave');
    }
    return;
  }
  const b = s.bike;
  s.time += dt;

  if (b.crash > 0) {
    b.crash -= dt;
    b.v = 0;
    return;
  }
  const airborne = b.z > 0 || b.vz > 0;

  // Engine: A is throttle, B is turbo (hotter); an overheated engine cuts out until it cools.
  const throttle = input.held.a || input.held.b;
  if (b.stalled > 0) {
    b.stalled -= dt;
    b.heat = Math.max(30, b.heat - 25 * dt);
    b.v = Math.max(0, b.v - 30 * dt);
    if (b.stalled <= 0) b.heat = 30;
  } else {
    const turbo = input.held.b;
    const cap = turbo ? TURBO_SPEED : MAX_SPEED;
    if (throttle) b.v = Math.min(cap, b.v + (turbo ? 55 : 32) * dt);
    if (!throttle || b.v > MAX_SPEED + 1) b.v = Math.max(0, b.v - (throttle ? 12 : 16) * dt);
    b.heat += (turbo ? 34 : throttle ? 9 : -14) * dt;
    b.heat = Math.max(0, b.heat);
    if (b.heat >= OVERHEAT) {
      b.heat = OVERHEAT;
      b.stalled = 2.6;
      emit('die');
    }
  }

  // Lanes: switch while on the ground; in the air Up/Down tilt the nose instead.
  if (!airborne) {
    if (input.pressed.up && b.lane > 0) b.lane -= 1;
    if (input.pressed.down && b.lane < LANES - 1) b.lane += 1;
  }
  b.laneY += Math.sign(b.lane - b.laneY) * Math.min(Math.abs(b.lane - b.laneY), 7 * dt);

  const prevX = b.x;
  b.x += b.v * dt;

  if (airborne) {
    b.vz -= GRAVITY * dt;
    b.z += b.vz * dt;
    b.pitch += ((input.held.up ? 1 : 0) - (input.held.down ? 1 : 0)) * 1.8 * dt + 0.14 * dt;
    if (b.z <= 0) {
      b.z = 0;
      b.vz = 0;
      // A landing with the nose too high or too low is a crash; a clean one keeps the speed.
      if (b.pitch < GOOD_PITCH_LOW || b.pitch > GOOD_PITCH_HIGH) crash(s, rng, emit);
      else {
        s.score += 50;
        emit('pickup');
      }
      b.pitch = 0;
    }
  } else {
    // Ramps launch you as you leave them.
    for (const r of s.ramps) {
      if (prevX < r.x + 12 && b.x >= r.x + 12 && b.v > 15) {
        b.vz = r.h * b.v * 0.2 + 3;
        b.z = 0.01;
        b.pitch = 0.32;
        emit('fire');
      }
    }
    for (const h of s.hurdles) {
      if (h.lane === b.lane && Math.abs(b.laneY - h.lane) < 0.45 && prevX < h.x + 2 && b.x >= h.x - 1) {
        crash(s, rng, emit);
        b.x = h.x + 3; // thrown clear of the hurdle, so getting going again doesn't hit it twice
        break;
      }
    }
    for (const m of s.mud) if (m.lane === b.lane && b.x > m.x0 && b.x < m.x1 && Math.abs(b.laneY - m.lane) < 0.5) b.v = Math.min(b.v, 22);
  }
  if (b.crash > 0) return;
  if (!airborne) {
    for (const st of s.strips) {
      if (st.lane === b.lane && prevX < st.x && b.x >= st.x) {
        if (st.kind === 'speed') b.v = Math.min(TURBO_SPEED, b.v + 18);
        else b.heat = Math.max(0, b.heat - 35);
        s.score += 25;
        emit('pickup');
      }
    }
  }

  // Rivals bump you if you run into them from behind in the same lane.
  for (const r of s.rivals) {
    r.x += r.v * dt;
    if (r.lane === b.lane && !airborne && Math.abs(b.laneY - r.lane) < 0.5 && b.x > r.x - 3 && b.x < r.x + 4) {
      if (b.v > r.v + 8) {
        b.v = r.v * 0.6;
        emit('pickup');
        b.x = r.x - 3.2;
      }
    }
    // Rivals drift to another lane after being passed.
    if (r.x < b.x - 30 && r.lane === b.lane) r.lane = (r.lane + 1) % LANES;
  }

  b.heat = Math.min(OVERHEAT, b.heat);
  if (Math.floor(b.x / 100) > Math.floor(prevX / 100)) s.score += 20;

  // The finish line.
  if (b.x >= s.length) {
    s.score += Math.max(0, Math.floor((s.limit - s.time) * 60)) + 1500 + s.level * 250;
    s.levelDelay = 1.8;
    emit('wave');
  } else if (s.time >= s.limit) {
    // Out of time: the run is over.
    s.lives -= 1;
    emit('die');
    if (s.lives <= 0) s.over = true;
    else {
      s.time = Math.max(0, s.limit - 20);
      b.x = Math.max(0, b.x - 40);
    }
  }
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: RiderState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const b = s.bike;
  g.fillStyle = '#1d2f55';
  g.fillRect(0, 0, W, 250);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let k = 0; k < 7; k++) {
    const x = ((k * 170 - b.x * 2) % (W + 200) + W + 200) % (W + 200) - 100;
    g.beginPath();
    g.moveTo(x - 80, 250);
    g.lineTo(x, 150 - (k % 3) * 20);
    g.lineTo(x + 80, 250);
    g.fill();
  }
  const laneY = (l: number) => 330 + l * 56;
  const sx = (x: number) => 170 + (x - b.x) * 3.4;
  for (let l = 0; l < LANES; l++) {
    g.fillStyle = l % 2 ? '#6b4a2f' : '#7d5a3c';
    g.fillRect(0, laneY(l) - 22, W, 56);
  }
  for (const m of s.mud) {
    g.fillStyle = '#3a2a18';
    g.fillRect(sx(m.x0), laneY(m.lane) - 12, (m.x1 - m.x0) * 3.4, 38);
  }
  for (const st of s.strips) {
    g.fillStyle = st.kind === 'speed' ? COLORS.gold : COLORS.cyan;
    g.fillRect(sx(st.x), laneY(st.lane) - 6, 26, 24);
  }
  for (const r of s.ramps) {
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.moveTo(sx(r.x), laneY(1) + 30);
    g.lineTo(sx(r.x + 12), laneY(1) + 30 - 22 * r.h);
    g.lineTo(sx(r.x + 12), laneY(1) + 30);
    g.fill();
    g.fillRect(sx(r.x), laneY(0) - 22, 4, 56 * 3);
  }
  for (const h of s.hurdles) {
    g.fillStyle = COLORS.paper;
    g.fillRect(sx(h.x), laneY(h.lane) - 6, 10, 26);
  }
  for (const r of s.rivals) {
    g.fillStyle = COLORS.purple;
    g.fillRect(sx(r.x) - 14, laneY(r.lane) - 8, 28, 18);
  }
  g.fillStyle = Math.floor(time * 6) % 2 ? COLORS.paper : COLORS.bg;
  g.fillRect(sx(s.length), 300, 14, 190);
  // The rider.
  const by = laneY(b.laneY) - b.z * 5;
  g.save();
  g.translate(170, by);
  g.rotate(-(b.crash > 0 ? Math.sin(time * 20) * 0.8 : b.pitch));
  g.fillStyle = b.stalled > 0 ? COLORS.muted : COLORS.cyan;
  g.fillRect(-16, -8, 32, 14);
  g.fillStyle = COLORS.gold;
  g.fillRect(-4, -20, 10, 14);
  g.fillStyle = COLORS.bg;
  g.beginPath();
  g.arc(-12, 8, 6, 0, 6.3);
  g.arc(12, 8, 6, 0, 6.3);
  g.fill();
  g.restore();
  drawSparks(g, s.sparks);
  // Temperature and speed gauges.
  g.fillStyle = COLORS.muted;
  g.fillRect(W - 220, 40, 180, 12);
  g.fillStyle = b.heat > 80 ? COLORS.coral : b.heat > 50 ? COLORS.gold : COLORS.cyan;
  g.fillRect(W - 220, 40, (180 * b.heat) / OVERHEAT, 12);
  g.fillStyle = COLORS.muted;
  g.font = '10px "Press Start 2P", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('TEMP', W - 220, 56);
  hud(g, s, `RACE ${s.level}  TIME ${Math.max(0, Math.ceil(s.limit - s.time))}  ${Math.min(100, Math.floor((b.x / s.length) * 100))}%`, s.lives);
  if (b.stalled > 0) banner(g, 'OVERHEATED!', 200);
  if (s.levelDelay > 0) banner(g, 'RACE COMPLETE!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<RiderState> = {
  id: 'dirt-rider',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
