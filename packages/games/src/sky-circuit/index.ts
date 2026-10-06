import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 15000;
const TAU = Math.PI * 2;
const KILLS_PER_BOSS = 12;

interface Plane { x: number; y: number; angle: number; boss: boolean; hp: number; shoot: number }

export interface CircuitState {
  ship: { x: number; y: number; angle: number; cool: number; alive: boolean; invuln: number };
  bullets: { x: number; y: number; vx: number; vy: number; life: number }[];
  enemyShots: { x: number; y: number; vx: number; vy: number; life: number }[];
  planes: Plane[];
  /** Clouds scroll opposite to the ship's heading so it feels like you are flying over the sky. */
  clouds: { x: number; y: number; r: number }[];
  spawnTimer: number;
  kills: number;
  bossAlive: boolean;
  sparks: Spark[];
  respawn: number;
  stage: number;
  score: number;
  hi: number;
  lives: number;
  over: boolean;
  nextLife: number;
  stageDelay: number;
}

const wrap = (v: number, m: number) => ((v % m) + m) % m;

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): CircuitState {
  return {
    ship: { x: W / 2, y: H / 2, angle: -Math.PI / 2, cool: 0, alive: true, invuln: 2 },
    bullets: [],
    enemyShots: [],
    planes: [],
    clouds: Array.from({ length: 10 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), r: rng.range(20, 60) })),
    spawnTimer: 1,
    kills: 0,
    bossAlive: false,
    sparks: [],
    respawn: 0,
    stage: 1,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    over: false,
    nextLife: EXTRA_LIFE_EVERY,
    stageDelay: 0,
  };
}

function update(s: CircuitState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  const ship = s.ship;
  const turn = 3.2 * dt;
  if (ship.alive) {
    if (input.held.left) ship.angle -= turn;
    if (input.held.right) ship.angle += turn;
    ship.x = wrap(ship.x + Math.cos(ship.angle) * 190 * dt, W);
    ship.y = wrap(ship.y + Math.sin(ship.angle) * 190 * dt, H);
    ship.cool -= dt;
    ship.invuln = Math.max(0, ship.invuln - dt);
    if (input.held.a && ship.cool <= 0 && s.bullets.length < 8) {
      ship.cool = 0.16;
      s.bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(ship.angle) * 520, vy: Math.sin(ship.angle) * 520, life: 0.9 });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) s.ship = { x: W / 2, y: H / 2, angle: -Math.PI / 2, cool: 0, alive: true, invuln: 2 };
  }
  for (const c of s.clouds) {
    c.x = wrap(c.x - Math.cos(ship.angle) * 40 * dt, W + 120);
    c.y = wrap(c.y - Math.sin(ship.angle) * 40 * dt, H + 120);
  }

  if (s.stageDelay > 0) s.stageDelay -= dt;
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.stageDelay <= 0) {
    if (s.kills >= KILLS_PER_BOSS && !s.bossAlive) {
      s.bossAlive = true;
      s.planes.push({ x: rng.pick([-30, W + 30]), y: rng.range(60, H - 60), angle: 0, boss: true, hp: 8 + s.stage * 2, shoot: 1.5 });
    } else if (!s.bossAlive && s.planes.length < 4 + s.stage) {
      const edge = rng.int(0, 3);
      s.planes.push({ x: edge === 0 ? -30 : edge === 1 ? W + 30 : rng.range(0, W), y: edge === 2 ? -30 : edge === 3 ? H + 30 : rng.range(0, H), angle: 0, boss: false, hp: 1, shoot: rng.range(1, 3) });
    }
    s.spawnTimer = Math.max(0.5, 1.4 - s.stage * 0.1);
  }

  for (const pl of s.planes) {
    // Turn toward the ship at a limited rate, so you can loop around behind them.
    const want = Math.atan2(ship.y - pl.y, ship.x - pl.x);
    let diff = ((want - pl.angle + Math.PI * 3) % TAU) - Math.PI;
    if (!ship.alive) diff = 0;
    const rate = (pl.boss ? 1.1 : 1.6 + s.stage * 0.12) * dt;
    pl.angle += Math.max(-rate, Math.min(rate, diff));
    const sp = pl.boss ? 120 : 130 + s.stage * 10;
    pl.x += Math.cos(pl.angle) * sp * dt;
    pl.y += Math.sin(pl.angle) * sp * dt;
    pl.shoot -= dt;
    if (pl.shoot <= 0 && ship.alive && Math.abs(diff) < 0.3) {
      pl.shoot = pl.boss ? 0.9 : rng.range(1.6, 3);
      s.enemyShots.push({ x: pl.x, y: pl.y, vx: Math.cos(pl.angle) * 260, vy: Math.sin(pl.angle) * 260, life: 2 });
    }
    if (ship.alive && ship.invuln <= 0 && Math.hypot(pl.x - ship.x, pl.y - ship.y) < (pl.boss ? 34 : 20)) hitShip(s, rng, emit);
  }

  for (const list of [s.bullets, s.enemyShots]) {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]!;
      b.x = wrap(b.x + b.vx * dt, W);
      b.y = wrap(b.y + b.vy * dt, H);
      b.life -= dt;
      if (b.life <= 0) list.splice(i, 1);
    }
  }
  for (let i = s.enemyShots.length - 1; i >= 0; i--) {
    const b = s.enemyShots[i]!;
    if (ship.alive && ship.invuln <= 0 && Math.hypot(b.x - ship.x, b.y - ship.y) < 12) {
      s.enemyShots.splice(i, 1);
      hitShip(s, rng, emit);
    }
  }
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    const k = s.planes.findIndex((pl) => Math.hypot(pl.x - b.x, pl.y - b.y) < (pl.boss ? 34 : 18));
    if (k < 0) continue;
    const pl = s.planes[k]!;
    s.bullets.splice(i, 1);
    pl.hp -= 1;
    if (pl.hp <= 0) {
      s.score += pl.boss ? 3000 : 100;
      burst(s.sparks, rng, pl.x, pl.y, pl.boss ? COLORS.gold : COLORS.coral, pl.boss ? 40 : 12);
      emit('explode');
      s.planes.splice(k, 1);
      if (pl.boss) {
        s.bossAlive = false;
        s.kills = 0;
        s.stage += 1;
        s.stageDelay = 2;
        emit('wave');
      } else s.kills += 1;
    } else emit('fire');
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function hitShip(s: CircuitState, rng: Rng, emit: UpdateContext['emit']): void {
  const ship = s.ship;
  ship.alive = false;
  s.lives -= 1;
  s.respawn = 1.3;
  burst(s.sparks, rng, ship.x, ship.y, COLORS.cyan, 24);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function plane(g: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(size, 0);
  g.lineTo(-size * 0.7, size * 0.9);
  g.lineTo(-size * 0.3, 0);
  g.lineTo(-size * 0.7, -size * 0.9);
  g.closePath();
  g.fill();
  g.restore();
}

function render(s: CircuitState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.fillStyle = 'rgba(246,239,255,0.08)';
  for (const c of s.clouds) {
    g.beginPath();
    g.arc(c.x - 60, c.y - 60, c.r, 0, TAU);
    g.fill();
  }
  for (const pl of s.planes) plane(g, pl.x, pl.y, pl.angle, pl.boss ? 32 : 15, pl.boss ? COLORS.gold : COLORS.coral);
  g.fillStyle = COLORS.coral;
  for (const b of s.enemyShots) g.fillRect(b.x - 3, b.y - 3, 6, 6);
  g.fillStyle = COLORS.paper;
  for (const b of s.bullets) g.fillRect(b.x - 2, b.y - 2, 5, 5);
  const ship = s.ship;
  if (ship.alive && (ship.invuln <= 0 || Math.floor(ship.invuln * 10) % 2 === 0)) plane(g, ship.x, ship.y, ship.angle, 15, COLORS.cyan);
  drawSparks(g, s.sparks);
  hud(g, s, `STAGE ${s.stage}${s.bossAlive ? '  BOSS!' : `  KILLS ${s.kills}/${KILLS_PER_BOSS}`}`, s.lives);
  if (s.stageDelay > 0) banner(g, 'STAGE CLEAR!', 220);
  gameOver(g, s.over);
}

const game: GameDefinition<CircuitState> = {
  id: 'sky-circuit',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.stage),
};
export default game;
