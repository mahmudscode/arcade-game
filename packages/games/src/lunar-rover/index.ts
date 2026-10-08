import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, TAU, W, type Spark } from '../_shared';

const GROUND = 470;
const GRAVITY = 1000;
const JUMP = 400;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const CHECKPOINT = 3200;
const MAX_LEVEL = 30;
const ROVER_MIN = 100;
const ROVER_MAX = 320;

interface Obstacle {
  kind: 'crater' | 'rock';
  x: number;
  w: number;
}

interface Alien {
  x: number;
  y: number;
  vx: number;
  cd: number;
  phase: number;
}

export interface RoverState {
  rover: { x: number; y: number; vy: number; alive: boolean };
  obstacles: Obstacle[];
  aliens: Alien[];
  bombs: { x: number; y: number }[];
  shots: { x: number; y: number; vx: number; vy: number }[];
  fireCd: number;
  scroll: number;
  /** Pixels until the next obstacle may appear. */
  gap: number;
  alienCd: number;
  dist: number;
  scoredDist: number;
  checkpoints: number;
  note: string;
  noteTimer: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  respawn: number;
  grace: number;
  nextLife: number;
}

function init({ hiScore }: { rng: Rng; hiScore: number }): RoverState {
  return {
    rover: { x: 190, y: GROUND, vy: 0, alive: true },
    obstacles: [],
    aliens: [],
    bombs: [],
    shots: [],
    fireCd: 0,
    scroll: 0,
    gap: 500,
    alienCd: 4,
    dist: 0,
    scoredDist: 0,
    checkpoints: 0,
    note: 'CHECKPOINT A',
    noteTimer: 1.4,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    respawn: 0,
    grace: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
}

function crash(s: RoverState, rng: Rng, emit: UpdateContext['emit']): void {
  const r = s.rover;
  if (!r.alive) return;
  burst(s.sparks, rng, r.x, r.y - 10, COLORS.gold, 26);
  emit('die');
  r.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  if (s.lives <= 0) s.over = true;
}

function update(s: RoverState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  s.noteTimer = Math.max(0, s.noteTimer - dt);
  s.fireCd = Math.max(0, s.fireCd - dt);
  s.grace = Math.max(0, s.grace - dt);

  const lvl = Math.min(s.level, MAX_LEVEL);
  const speed = 190 + lvl * 9;
  const r = s.rover;

  if (r.alive) {
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    r.x = Math.min(ROVER_MAX, Math.max(ROVER_MIN, r.x + dx * 90 * dt));
    if ((input.pressed.a || input.pressed.up) && r.y >= GROUND) {
      r.vy = -JUMP;
      emit('pickup');
    }
    r.vy += GRAVITY * dt;
    r.y += r.vy * dt;
    // Craters: the wheels drop in unless the rover is airborne above them.
    const over = s.obstacles.find((o) => o.kind === 'crater' && r.x > o.x + 6 && r.x < o.x + o.w - 6);
    if (r.y >= GROUND && !over) {
      r.y = GROUND;
      r.vy = 0;
    } else if (r.y >= GROUND + 14 && over) {
      if (s.grace <= 0) {
        crash(s, rng, emit);
      } else {
        r.y = GROUND;
        r.vy = 0;
      }
    }
    if ((input.pressed.b || (input.held.b && s.fireCd <= 0)) && s.fireCd <= 0 && s.shots.length < 6) {
      s.fireCd = 0.28;
      s.shots.push({ x: r.x + 24, y: r.y - 12, vx: 520, vy: 0 }, { x: r.x, y: r.y - 24, vx: 0, vy: -480 });
      emit('fire');
    }
    s.dist += speed * dt;
    s.scroll += speed * dt;
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(r, { x: 190, y: GROUND, vy: 0, alive: true });
      s.obstacles = s.obstacles.filter((o) => o.x > W);
      s.bombs = [];
      s.aliens = [];
      s.grace = 1.5;
      s.gap = Math.max(s.gap, 350);
    }
  }
  const moving = r.alive ? speed : 0;

  // Terrain scrolls left; new hazards appear on the right.
  for (const o of s.obstacles) o.x -= moving * dt;
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);
  s.gap -= moving * dt;
  if (s.gap <= 0) {
    const crater = rng.next() < 0.5;
    const w = crater ? rng.int(60, 90) : rng.int(22, 34);
    s.obstacles.push({ kind: crater ? 'crater' : 'rock', x: W + 40, w });
    s.gap = rng.range(300, 520) - lvl * 4;
  }

  // Rocks stop the rover unless it clears them.
  for (let i = s.obstacles.length - 1; i >= 0; i--) {
    const o = s.obstacles[i]!;
    if (o.kind === 'rock' && r.alive && s.grace <= 0 && r.x + 18 > o.x && r.x - 18 < o.x + o.w && r.y > GROUND - 22) crash(s, rng, emit);
  }

  // Aliens strafe overhead and bomb the ground, leaving craters.
  s.alienCd -= dt;
  if (s.alienCd <= 0 && s.aliens.length < 3) {
    s.alienCd = Math.max(2, 5 - lvl * 0.15) * rng.range(0.7, 1.3);
    const fromLeft = rng.next() < 0.5;
    s.aliens.push({ x: fromLeft ? -30 : W + 30, y: rng.range(80, 220), vx: (fromLeft ? 1 : -1) * rng.range(90, 150), cd: rng.range(0.8, 1.8), phase: rng.range(0, TAU) });
  }
  for (let i = s.aliens.length - 1; i >= 0; i--) {
    const a = s.aliens[i]!;
    a.x += a.vx * dt;
    a.phase += dt * 3;
    a.y += Math.sin(a.phase) * 30 * dt;
    a.cd -= dt;
    if (a.cd <= 0 && a.x > 30 && a.x < W - 30) {
      a.cd = rng.range(1, 2.2);
      s.bombs.push({ x: a.x, y: a.y + 10 });
    }
    if (a.x < -60 || a.x > W + 60) s.aliens.splice(i, 1);
  }

  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    let spent = sh.x > W || sh.y < 0;
    for (let k = s.aliens.length - 1; k >= 0 && !spent; k--) {
      const a = s.aliens[k]!;
      if (Math.abs(sh.x - a.x) < 20 && Math.abs(sh.y - a.y) < 12) {
        s.score += 100;
        burst(s.sparks, rng, a.x, a.y, COLORS.coral, 12);
        emit('explode');
        s.aliens.splice(k, 1);
        spent = true;
      }
    }
    for (let k = s.obstacles.length - 1; k >= 0 && !spent; k--) {
      const o = s.obstacles[k]!;
      if (o.kind === 'rock' && sh.vx > 0 && sh.x > o.x && sh.x < o.x + o.w && sh.y > GROUND - 28) {
        s.score += 50;
        burst(s.sparks, rng, o.x + o.w / 2, GROUND - 10, COLORS.muted, 8);
        emit('explode');
        s.obstacles.splice(k, 1);
        spent = true;
      }
    }
    if (spent) s.shots.splice(i, 1);
  }

  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const b = s.bombs[i]!;
    b.y += 260 * dt;
    b.x -= moving * dt;
    if (r.alive && Math.abs(b.x - r.x) < 22 && Math.abs(b.y - (r.y - 10)) < 16) {
      s.bombs.splice(i, 1);
      if (s.grace <= 0) crash(s, rng, emit);
    } else if (b.y >= GROUND) {
      s.obstacles.push({ kind: 'crater', x: b.x - 22, w: 44 });
      burst(s.sparks, rng, b.x, GROUND, COLORS.gold, 8);
      s.bombs.splice(i, 1);
    }
  }

  // Distance and checkpoints.
  const wholeDist = Math.floor(s.dist / 10);
  if (wholeDist > s.scoredDist) {
    s.score += wholeDist - s.scoredDist;
    s.scoredDist = wholeDist;
  }
  if (Math.floor(s.dist / CHECKPOINT) > s.checkpoints) {
    s.checkpoints += 1;
    s.score += 500;
    s.note = `CHECKPOINT ${String.fromCharCode(65 + (s.checkpoints % 26))}`;
    s.noteTimer = 1.4;
    emit('wave');
    if (s.checkpoints % 5 === 0) s.level = Math.min(s.level + 1, MAX_LEVEL);
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: RoverState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  // Far and near mountain layers scroll at different speeds.
  g.fillStyle = '#1b1240';
  for (let i = -1; i < 8; i++) {
    const x = i * 140 - (s.scroll * 0.1) % 140;
    g.beginPath();
    g.moveTo(x, GROUND);
    g.lineTo(x + 70, GROUND - 120 - ((i * 37) % 3) * 20);
    g.lineTo(x + 140, GROUND);
    g.fill();
  }
  g.fillStyle = '#2b1d5e';
  for (let i = -1; i < 10; i++) {
    const x = i * 100 - (s.scroll * 0.3) % 100;
    g.beginPath();
    g.moveTo(x, GROUND);
    g.lineTo(x + 50, GROUND - 60 - ((i * 53) % 3) * 12);
    g.lineTo(x + 100, GROUND);
    g.fill();
  }

  g.fillStyle = '#4a3a8a';
  g.fillRect(0, GROUND, W, H - GROUND);
  for (const o of s.obstacles) {
    if (o.kind === 'crater') {
      g.fillStyle = COLORS.bg;
      g.fillRect(o.x, GROUND, o.w, H - GROUND);
    } else {
      g.fillStyle = COLORS.muted;
      g.beginPath();
      g.arc(o.x + o.w / 2, GROUND, o.w / 2 + 2, Math.PI, 0);
      g.fill();
    }
  }
  g.fillStyle = COLORS.purple;
  for (let x = -(s.scroll % 40); x < W; x += 40) g.fillRect(x, GROUND + 28, 18, 3);

  for (const a of s.aliens) {
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.ellipse(a.x, a.y, 20, 9, 0, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.paper;
    g.beginPath();
    g.arc(a.x, a.y - 3, 7, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = COLORS.gold;
  for (const b of s.bombs) g.fillRect(b.x - 3, b.y - 6, 6, 12);
  g.fillStyle = COLORS.paper;
  for (const sh of s.shots) g.fillRect(sh.x - 4, sh.y - 2, sh.vx > 0 ? 10 : 4, sh.vx > 0 ? 4 : 10);

  const r = s.rover;
  if (r.alive && (s.grace <= 0 || Math.floor(time * 12) % 2 === 0)) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(r.x - 22, r.y - 22, 44, 12);
    g.fillRect(r.x - 6, r.y - 32, 18, 10);
    g.fillStyle = COLORS.gold;
    g.fillRect(r.x + 16, r.y - 20, 12, 3);
    g.fillStyle = COLORS.paper;
    for (const wx of [-16, 0, 16]) {
      g.beginPath();
      g.arc(r.x + wx, r.y - 6 + Math.sin(time * 30 + wx) * (r.y >= GROUND ? 1 : 0), 6, 0, TAU);
      g.fill();
    }
  }
  drawSparks(g, s.sparks);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  if (s.noteTimer > 0 && !s.over) {
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = COLORS.cyan;
    g.font = '20px "Press Start 2P", monospace';
    g.fillText(s.note, W / 2, 110);
  }
  gameOver(g, s.over);
}

const lunarRover: GameDefinition<RoverState> = {
  id: 'lunar-rover',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};

export default lunarRover;
