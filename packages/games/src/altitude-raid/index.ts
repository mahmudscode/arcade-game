import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

/** World axes: u across the lane, v forward (the scroll direction), z altitude. All in world units. */
export const LANE = 300;
const MIN_Z = 6;
const MAX_Z = 112;
const SCROLL = 125;
const SHOT_SPEED = 520;
const SHOT_RANGE = 380;
const STAGE_LENGTH = 7000;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const FUEL_MAX = 100;
const BOSS_HP = 14;

type TargetKind = 'turret' | 'fuel' | 'plane' | 'boss';
interface Target {
  kind: TargetKind;
  u: number;
  /** Absolute position along the scroll axis. */
  v: number;
  z: number;
  hp: number;
  cd: number;
  t: number;
}
interface Wall {
  v: number;
  /** The opening: [u0, u1] x [z0, z1]. */
  u0: number;
  u1: number;
  z0: number;
  z1: number;
  passed: boolean;
}
interface Shot {
  u: number;
  v: number;
  z: number;
  /** Direction along v (+1 away from the ship, -1 toward it), and extra lateral/vertical drift. */
  dv: number;
  du: number;
  dz: number;
  mine: boolean;
  life: number;
}

const POINTS: Record<TargetKind, number> = { turret: 300, fuel: 300, plane: 200, boss: 6000 };

export interface RaidState {
  ship: { u: number; z: number; alive: boolean; invuln: number; cd: number };
  /** How far the ship has flown along v. */
  v: number;
  targets: Target[];
  walls: Wall[];
  shots: Shot[];
  sparks: Spark[];
  fuel: number;
  spawnTimer: number;
  wallTimer: number;
  boss: boolean;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

/** Isometric projection of a world point relative to the ship. */
export function project(s: { v: number; ship: { u: number } }, u: number, v: number, z: number): { x: number; y: number } {
  const du = u - s.ship.u;
  const dv = v - s.v;
  return { x: 330 + (du + dv) * 0.85, y: 400 + (du - dv) * 0.42 - z * 1.25 };
}

function newStage(s: RaidState): void {
  s.v = 0;
  s.targets = [];
  s.walls = [];
  s.shots = [];
  s.fuel = FUEL_MAX;
  s.spawnTimer = 1;
  s.wallTimer = 4;
  s.boss = false;
}

function init({ hiScore }: { rng: Rng; hiScore: number }): RaidState {
  const s: RaidState = {
    ship: { u: LANE / 2, z: 60, alive: true, invuln: 1.5, cd: 0 },
    v: 0,
    targets: [],
    walls: [],
    shots: [],
    sparks: [],
    fuel: FUEL_MAX,
    spawnTimer: 1,
    wallTimer: 4,
    boss: false,
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  newStage(s);
  return s;
}

function killShip(s: RaidState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = project(s, s.ship.u, s.v, s.ship.z);
  burst(s.sparks, rng, p.x, p.y, COLORS.cyan, 26);
  s.ship.alive = false;
  s.lives -= 1;
  s.respawn = 1.7;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: RaidState, input: Input, dt: number, ctx: UpdateContext): void {
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
      newStage(s);
      emit('wave');
    }
    return;
  }
  const ship = s.ship;
  const speed = SCROLL + Math.min(s.level, 6) * 8;
  s.v += speed * dt;

  if (!ship.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(ship, { u: LANE / 2, z: 60, alive: true, invuln: 2.4, cd: 0 });
      s.fuel = Math.max(s.fuel, 45);
      // Clear the way: nothing within reach of the respawn point.
      s.walls = s.walls.filter((w) => w.v < s.v - 30 || w.v > s.v + 160);
    }
  } else {
    ship.invuln = Math.max(0, ship.invuln - dt);
    ship.cd = Math.max(0, ship.cd - dt);
    ship.u = Math.min(LANE - 14, Math.max(14, ship.u + ((input.held.right ? 1 : 0) - (input.held.left ? 1 : 0)) * 150 * dt));
    ship.z = Math.min(MAX_Z, Math.max(MIN_Z, ship.z + ((input.held.up ? 1 : 0) - (input.held.down ? 1 : 0)) * 85 * dt));
    if (input.held.a && ship.cd <= 0) {
      ship.cd = 0.17;
      s.shots.push({ u: ship.u, v: s.v + 14, z: ship.z, dv: 1, du: 0, dz: 0, mine: true, life: SHOT_RANGE / SHOT_SPEED });
      emit('fire');
    }
    s.fuel -= (1.6 + s.level * 0.15) * dt;
    if (s.fuel <= 0) {
      s.fuel = 0;
      killShip(s, rng, emit);
      if (s.over) return;
    }
  }

  // Spawning along the lane, a fixed distance ahead.
  const ahead = s.v + 520;
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && !s.boss) {
    s.spawnTimer = Math.max(0.5, 1.2 - s.level * 0.08);
    const roll = rng.next();
    if (roll < 0.4) s.targets.push({ kind: 'turret', u: rng.range(20, LANE - 20), v: ahead, z: 0, hp: 1, cd: rng.range(1, 2.5), t: 0 });
    else if (roll < 0.55) s.targets.push({ kind: 'fuel', u: rng.range(20, LANE - 20), v: ahead, z: 0, hp: 1, cd: 0, t: 0 });
    else s.targets.push({ kind: 'plane', u: rng.range(30, LANE - 30), v: ahead, z: rng.range(25, 100), hp: 1, cd: rng.range(0.5, 1.8), t: 0 });
  }
  s.wallTimer -= dt;
  if (s.wallTimer <= 0 && !s.boss) {
    s.wallTimer = Math.max(3.4, 7 - s.level * 0.4);
    const gu = rng.range(40, LANE - 100);
    const gz = rng.range(15, 55);
    s.walls.push({ v: ahead + 60, u0: gu, u1: gu + 70, z0: gz, z1: gz + 45, passed: false });
  }
  if (!s.boss && s.v >= STAGE_LENGTH) {
    s.boss = true;
    s.targets = s.targets.filter((t) => t.v < s.v + 100);
    s.targets.push({ kind: 'boss', u: LANE / 2, v: s.v + 380, z: 0, hp: BOSS_HP, cd: 1.2, t: 0 });
  }

  for (let i = s.targets.length - 1; i >= 0; i--) {
    const t = s.targets[i]!;
    t.t += dt;
    t.cd -= dt;
    if (t.kind === 'plane') {
      // Planes fly toward the ship, steering to line up with it.
      t.v -= (speed + 90) * dt;
      t.u += Math.sign(ship.u - t.u) * 25 * dt;
      t.z += Math.sign(ship.z - t.z) * 20 * dt;
    } else if (t.kind === 'boss') {
      t.v = Math.max(s.v + 300, t.v - 20 * dt);
      t.v += speed * dt;
      t.u = LANE / 2 + Math.sin(t.t * 0.8) * 90;
    }
    if (t.cd <= 0 && (t.kind === 'turret' || t.kind === 'boss' || t.kind === 'plane') && ship.alive) {
      const dv = t.v - s.v;
      if (dv > 20 && dv < 460) {
        // The shot flies at 300 while the ship closes in at `speed`: aim for where the ship will be.
        const flight = Math.max(0.35, dv / (300 + speed));
        s.shots.push({ u: t.u, v: t.v, z: t.z + 6, dv: -1, du: (ship.u - t.u) / flight / 300, dz: (ship.z - t.z - 6) / flight / 300, mine: false, life: flight + 0.3 });
        t.cd = t.kind === 'boss' ? 0.9 : rng.range(1.6, 3);
      }
    }
    if (t.v < s.v - 60) {
      s.targets.splice(i, 1);
      continue;
    }
    if (ship.alive && ship.invuln <= 0 && Math.abs(t.v - s.v) < 12 && Math.abs(t.u - ship.u) < 14 && Math.abs(t.z - ship.z) < (t.kind === 'plane' ? 12 : 16)) {
      killShip(s, rng, emit);
      if (s.over) return;
    }
  }

  // Walls: pass through the opening or crash.
  for (const w of s.walls) {
    if (w.passed || !ship.alive) continue;
    if (w.v <= s.v) {
      w.passed = true;
      const through = ship.u - 8 >= w.u0 && ship.u + 8 <= w.u1 && ship.z - 5 >= w.z0 && ship.z + 5 <= w.z1;
      if (through) {
        s.score += 100;
        emit('pickup');
      } else if (ship.invuln <= 0) {
        killShip(s, rng, emit);
        if (s.over) return;
      }
    }
  }
  s.walls = s.walls.filter((w) => w.v > s.v - 80);

  // Shots.
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.life -= dt;
    if (sh.mine) sh.v += sh.dv * (SHOT_SPEED + speed) * dt;
    else {
      sh.v += sh.dv * 300 * dt;
      sh.u += sh.du * 300 * dt;
      sh.z += sh.dz * 300 * dt;
    }
    if (sh.life <= 0) {
      s.shots.splice(i, 1);
      continue;
    }
    if (sh.mine) {
      const ti = s.targets.findIndex((t) => Math.abs(t.v - sh.v) < 16 && Math.abs(t.u - sh.u) < (t.kind === 'boss' ? 28 : 13) && (t.kind === 'boss' ? sh.z < 70 : Math.abs(t.z - sh.z) < (t.kind === 'plane' ? 13 : 14)));
      if (ti >= 0) {
        const t = s.targets[ti]!;
        t.hp -= 1;
        s.shots.splice(i, 1);
        if (t.hp <= 0) {
          s.score += POINTS[t.kind];
          const p = project(s, t.u, t.v, t.z);
          burst(s.sparks, rng, p.x, p.y, t.kind === 'fuel' ? COLORS.gold : COLORS.coral, 12);
          s.targets.splice(ti, 1);
          emit('explode');
          if (t.kind === 'fuel') s.fuel = Math.min(FUEL_MAX, s.fuel + 28);
          if (t.kind === 'boss') {
            s.levelDelay = 2;
            s.shots = s.shots.filter((x) => x.mine);
            emit('wave');
          }
        }
      }
    } else if (ship.alive && ship.invuln <= 0 && Math.abs(sh.v - s.v) < 10 && Math.abs(sh.u - ship.u) < 10 && Math.abs(sh.z - ship.z) < 10) {
      s.shots.splice(i, 1);
      killShip(s, rng, emit);
      if (s.over) return;
    }
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function box(g: CanvasRenderingContext2D, s: RaidState, u: number, v: number, z: number, w: number, d: number, h: number, color: string): void {
  const a = project(s, u - w, v - d, z);
  const b = project(s, u + w, v - d, z);
  const c = project(s, u + w, v + d, z);
  const e = project(s, u - w, v + d, z);
  const top = [project(s, u - w, v - d, z + h), project(s, u + w, v - d, z + h), project(s, u + w, v + d, z + h), project(s, u - w, v + d, z + h)];
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.lineTo(c.x, c.y);
  g.lineTo(e.x, e.y);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(top[0]!.x, top[0]!.y);
  for (let i = 1; i < 4; i++) g.lineTo(top[i]!.x, top[i]!.y);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.moveTo(top[3]!.x, top[3]!.y);
  g.lineTo(top[2]!.x, top[2]!.y);
  g.lineTo(c.x, c.y);
  g.lineTo(e.x, e.y);
  g.fill();
}

function render(s: RaidState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  // The floor: lane edges and cross lines that scroll toward the ship.
  g.strokeStyle = 'rgba(167,139,250,0.35)';
  g.lineWidth = 2;
  for (const [u0, u1] of [[0, 0], [LANE, LANE]] as const) {
    const a = project(s, u0, s.v - 120, 0);
    const b = project(s, u1, s.v + 700, 0);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(79,227,214,0.15)';
  g.lineWidth = 1;
  for (let v = Math.floor((s.v - 120) / 60) * 60; v < s.v + 700; v += 60) {
    const a = project(s, 0, v, 0);
    const b = project(s, LANE, v, 0);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  // Everything ahead of the ship is drawn far-to-near.
  const items: { v: number; draw: () => void }[] = [];
  for (const w of s.walls) {
    items.push({
      v: w.v,
      draw: () => {
        const corners = (u: number, z: number) => project(s, u, w.v, z);
        g.fillStyle = 'rgba(255,93,115,0.5)';
        g.strokeStyle = COLORS.coral;
        g.lineWidth = 2;
        for (const [uA, uB, zA, zB] of [[0, LANE, 0, w.z0], [0, LANE, w.z1, 130], [0, w.u0, w.z0, w.z1], [w.u1, LANE, w.z0, w.z1]] as const) {
          const p1 = corners(uA, zA);
          const p2 = corners(uB, zA);
          const p3 = corners(uB, zB);
          const p4 = corners(uA, zB);
          g.beginPath();
          g.moveTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
          g.lineTo(p3.x, p3.y);
          g.lineTo(p4.x, p4.y);
          g.closePath();
          g.fill();
          g.stroke();
        }
      },
    });
  }
  for (const t of s.targets) {
    items.push({
      v: t.v,
      draw: () => {
        if (t.kind === 'turret') box(g, s, t.u, t.v, 0, 9, 9, 12, COLORS.purple);
        else if (t.kind === 'fuel') box(g, s, t.u, t.v, 0, 10, 10, 18, Math.floor(time * 4) % 2 ? COLORS.gold : COLORS.paper);
        else if (t.kind === 'boss') box(g, s, t.u, t.v, 0, 30, 18, 60, COLORS.coral);
        else {
          const p = project(s, t.u, t.v, t.z);
          const sh = project(s, t.u, t.v, 0);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(sh.x - 8, sh.y - 2, 16, 4);
          g.fillStyle = COLORS.paper;
          g.beginPath();
          g.moveTo(p.x, p.y - 8);
          g.lineTo(p.x - 11, p.y + 6);
          g.lineTo(p.x + 11, p.y + 6);
          g.closePath();
          g.fill();
        }
      },
    });
  }
  items.sort((a, b) => b.v - a.v);
  for (const it of items) it.draw();
  for (const sh of s.shots) {
    const p = project(s, sh.u, sh.v, sh.z);
    g.fillStyle = sh.mine ? COLORS.gold : COLORS.coral;
    g.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  if (s.ship.alive && (s.ship.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    const p = project(s, s.ship.u, s.v, s.ship.z);
    const sh = project(s, s.ship.u, s.v, 0);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(sh.x - 10, sh.y - 2, 20, 5);
    g.strokeStyle = 'rgba(79,227,214,0.35)';
    g.beginPath();
    g.moveTo(sh.x, sh.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    g.fillStyle = COLORS.cyan;
    g.beginPath();
    g.moveTo(p.x + 16, p.y - 7);
    g.lineTo(p.x - 12, p.y - 9);
    g.lineTo(p.x - 8, p.y);
    g.lineTo(p.x - 12, p.y + 9);
    g.closePath();
    g.fill();
  }
  drawSparks(g, s.sparks);
  // Altitude gauge and fuel bar.
  g.fillStyle = COLORS.muted;
  g.fillRect(24, 90, 10, 160);
  g.fillStyle = COLORS.cyan;
  g.fillRect(24, 250 - ((s.ship.z - MIN_Z) / (MAX_Z - MIN_Z)) * 160 - 3, 14, 6);
  g.fillStyle = COLORS.muted;
  g.fillRect(W - 40, 90, 10, 160);
  g.fillStyle = s.fuel > 25 ? COLORS.gold : COLORS.coral;
  g.fillRect(W - 40, 250 - (s.fuel / FUEL_MAX) * 160, 10, (s.fuel / FUEL_MAX) * 160);
  hud(g, s, `STAGE ${s.level}  ${s.boss ? 'BOSS!' : `${Math.min(100, Math.floor((s.v / STAGE_LENGTH) * 100))}%`}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'STAGE CLEAR!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<RaidState> = {
  id: 'altitude-raid',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
