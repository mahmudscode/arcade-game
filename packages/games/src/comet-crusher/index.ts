import type { GameDefinition, GameStatus, Input, Rng, UpdateContext } from '@arcade/engine';

const W = 800;
const H = 570;
const TAU = Math.PI * 2;

const COLORS = {
  bg: '#120a2a',
  paper: '#F6EFFF',
  gold: '#FFC93C',
  coral: '#FF5D73',
  cyan: '#4FE3D6',
  purple: '#A78BFA',
  muted: '#B7A9DB',
};
const ROCK_COLORS = [COLORS.coral, COLORS.gold, COLORS.cyan, COLORS.purple];
const RADIUS = { 1: 14, 2: 26, 3: 44 } as const;
const POINTS = { 1: 100, 2: 50, 3: 20 } as const;

const MAX_WAVE = 40;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;

type Size = 1 | 2 | 3;

interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: Size;
  angle: number;
  spin: number;
  /** Radius multipliers of the outline vertices. */
  shape: number[];
  color: string;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface CometState {
  ship: { x: number; y: number; vx: number; vy: number; angle: number; cooldown: number; invuln: number; alive: boolean; thrusting: boolean };
  bullets: Bullet[];
  rocks: Rock[];
  sparks: Spark[];
  stars: { x: number; y: number; s: number; phase: number }[];
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  respawn: number;
  waveDelay: number;
  nextLife: number;
}

const wrap = (v: number, max: number) => ((v % max) + max) % max;

function makeRock(rng: Rng, size: Size, x: number, y: number, speed: number): Rock {
  const heading = rng.range(0, TAU);
  const verts = 10;
  return {
    x,
    y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    size,
    angle: rng.range(0, TAU),
    spin: rng.range(-1.2, 1.2),
    shape: Array.from({ length: verts }, () => rng.range(0.72, 1.12)),
    color: rng.pick(ROCK_COLORS),
  };
}

function spawnWave(s: CometState, rng: Rng): void {
  const count = Math.min(3 + s.wave, 11);
  const speed = 28 + Math.min(s.wave, MAX_WAVE) * 2.5;
  for (let i = 0; i < count; i++) {
    // Spawn on the screen border so a wave never starts on top of the ship.
    const edge = rng.int(0, 3);
    const x = edge === 0 ? 0 : edge === 1 ? W : rng.range(0, W);
    const y = edge === 2 ? 0 : edge === 3 ? H : rng.range(0, H);
    s.rocks.push(makeRock(rng, 3, x, y, rng.range(speed * 0.6, speed * 1.4)));
  }
}

function burst(s: CometState, rng: Rng, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU);
    const v = rng.range(40, 220);
    s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rng.range(0.3, 0.7), color });
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): CometState {
  const s: CometState = {
    ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, cooldown: 0, invuln: 2, alive: true, thrusting: false },
    bullets: [],
    rocks: [],
    sparks: [],
    stars: Array.from({ length: 70 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), s: rng.pick([1, 1, 2]), phase: rng.range(0, TAU) })),
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    respawn: 0,
    waveDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
  spawnWave(s, rng);
  return s;
}

function update(s: CometState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;

  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepWorld(s, dt);
    return;
  }

  const ship = s.ship;
  if (ship.alive) {
    if (input.held.left) ship.angle -= 4.2 * dt;
    if (input.held.right) ship.angle += 4.2 * dt;
    ship.thrusting = input.held.up || input.held.b;
    if (ship.thrusting) {
      ship.vx += Math.cos(ship.angle) * 260 * dt;
      ship.vy += Math.sin(ship.angle) * 260 * dt;
    }
    const drag = 1 - 0.55 * dt;
    ship.vx *= drag;
    ship.vy *= drag;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 340) {
      ship.vx *= 340 / speed;
      ship.vy *= 340 / speed;
    }
    ship.x = wrap(ship.x + ship.vx * dt, W);
    ship.y = wrap(ship.y + ship.vy * dt, H);
    ship.cooldown -= dt;
    ship.invuln = Math.max(0, ship.invuln - dt);

    if (input.held.a && ship.cooldown <= 0 && s.bullets.length < 5) {
      ship.cooldown = 0.18;
      s.bullets.push({
        x: ship.x + Math.cos(ship.angle) * 14,
        y: ship.y + Math.sin(ship.angle) * 14,
        vx: Math.cos(ship.angle) * 520 + ship.vx * 0.3,
        vy: Math.sin(ship.angle) * 520 + ship.vy * 0.3,
        life: 0.9,
      });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(ship, { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invuln: 2.5, alive: true, cooldown: 0 });
    }
  }

  stepWorld(s, dt);

  // Bullets vs rocks. Iterate backwards so splicing is safe.
  for (let b = s.bullets.length - 1; b >= 0; b--) {
    const bullet = s.bullets[b]!;
    for (let r = s.rocks.length - 1; r >= 0; r--) {
      const rock = s.rocks[r]!;
      if (Math.hypot(bullet.x - rock.x, bullet.y - rock.y) > RADIUS[rock.size]) continue;
      s.bullets.splice(b, 1);
      s.rocks.splice(r, 1);
      s.score += POINTS[rock.size];
      burst(s, rng, rock.x, rock.y, rock.color, 8 + rock.size * 3);
      emit('explode');
      if (rock.size > 1) {
        const child = (rock.size - 1) as Size;
        const speed = 40 + s.wave * 3;
        s.rocks.push(makeRock(rng, child, rock.x, rock.y, rng.range(speed, speed * 1.8)));
        s.rocks.push(makeRock(rng, child, rock.x, rock.y, rng.range(speed, speed * 1.8)));
      }
      break;
    }
  }

  // Ship vs rocks.
  if (ship.alive && ship.invuln <= 0) {
    for (const rock of s.rocks) {
      if (Math.hypot(ship.x - rock.x, ship.y - rock.y) < RADIUS[rock.size] * 0.85 + 8) {
        ship.alive = false;
        ship.thrusting = false;
        s.lives -= 1;
        s.respawn = 1.4;
        burst(s, rng, ship.x, ship.y, COLORS.cyan, 26);
        emit('die');
        if (s.lives <= 0) s.over = true;
        break;
      }
    }
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }

  // Next wave.
  if (!s.over && s.rocks.length === 0) {
    if (s.waveDelay <= 0) s.waveDelay = 1.4;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave = Math.min(s.wave + 1, MAX_WAVE);
      spawnWave(s, rng);
      emit('wave');
    }
  }

  if (s.score > s.hi) s.hi = s.score;
}

function stepWorld(s: CometState, dt: number): void {
  for (const rock of s.rocks) {
    rock.x = wrap(rock.x + rock.vx * dt, W);
    rock.y = wrap(rock.y + rock.vy * dt, H);
    rock.angle += rock.spin * dt;
  }
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.x = wrap(b.x + b.vx * dt, W);
    b.y = wrap(b.y + b.vy * dt, H);
    b.life -= dt;
    if (b.life <= 0) s.bullets.splice(i, 1);
  }
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i]!;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) s.sparks.splice(i, 1);
  }
}

const pad = (n: number) => String(Math.min(n, 999999)).padStart(6, '0');

function render(s: CometState, g: CanvasRenderingContext2D, time: number): void {
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);

  for (const star of s.stars) {
    g.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.5 + star.phase);
    g.fillStyle = COLORS.paper;
    g.fillRect(star.x, star.y, star.s, star.s);
  }
  g.globalAlpha = 1;

  for (const rock of s.rocks) {
    const r = RADIUS[rock.size];
    g.beginPath();
    rock.shape.forEach((m, i) => {
      const a = rock.angle + (i / rock.shape.length) * TAU;
      const x = rock.x + Math.cos(a) * r * m;
      const y = rock.y + Math.sin(a) * r * m;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.closePath();
    g.fillStyle = rock.color;
    g.globalAlpha = 0.9;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 3;
    g.strokeStyle = COLORS.bg;
    g.stroke();
  }

  g.fillStyle = COLORS.gold;
  for (const b of s.bullets) g.fillRect(b.x - 2, b.y - 2, 5, 5);

  for (const p of s.sparks) {
    g.globalAlpha = Math.max(0, p.life * 1.8);
    g.fillStyle = p.color;
    g.fillRect(p.x, p.y, 3, 3);
  }
  g.globalAlpha = 1;

  const ship = s.ship;
  if (ship.alive && (ship.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    g.save();
    g.translate(ship.x, ship.y);
    g.rotate(ship.angle);
    if (ship.thrusting) {
      g.fillStyle = Math.floor(time * 30) % 2 ? COLORS.gold : COLORS.coral;
      g.beginPath();
      g.moveTo(-9, -5);
      g.lineTo(-20 - (Math.floor(time * 30) % 3) * 3, 0);
      g.lineTo(-9, 5);
      g.closePath();
      g.fill();
    }
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

  // Scanlines for the CRT look.
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);

  g.font = '14px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.fillStyle = COLORS.paper;
  g.fillText(`1UP  ${pad(s.score)}`, 22, 20);
  g.textAlign = 'right';
  g.fillStyle = COLORS.gold;
  g.fillText(`HI ${pad(Math.max(s.hi, s.score))}`, W - 22, 20);
  g.textAlign = 'left';
  g.fillStyle = COLORS.muted;
  g.fillText(`WAVE ${s.wave}`, 22, H - 34);
  g.fillStyle = COLORS.cyan;
  for (let i = 0; i < Math.max(0, s.lives); i++) g.fillRect(W - 40 - i * 22, H - 34, 14, 12);

  if (s.over) {
    g.fillStyle = 'rgba(18,10,42,0.72)';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.fillStyle = COLORS.coral;
    g.font = '32px "Press Start 2P", monospace';
    g.fillText('GAME OVER', W / 2, H / 2 - 40);
    g.fillStyle = COLORS.paper;
    g.font = '13px "Press Start 2P", monospace';
    g.fillText('PRESS SPACE TO PLAY AGAIN', W / 2, H / 2 + 20);
  }
}

function status(s: CometState): GameStatus {
  return { score: s.score, hiScore: Math.max(s.hi, s.score), lives: Math.max(0, s.lives), level: s.wave, over: s.over };
}

const cometCrusher: GameDefinition<CometState> = {
  id: 'comet-crusher',
  size: { width: W, height: H },
  init,
  update,
  render,
  status,
};

export default cometCrusher;
