import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const SCROLL = 70;
const SIGHT = 150;
const BOMB_FLIGHT = 0.42;
const BOMB_RADIUS = 30;
const STAGE_LENGTH = 9000;
const FORTRESS_HP = 14;

type AirKind = 'ring' | 'dart' | 'armor';
type GroundKind = 'dome' | 'tower' | 'tank' | 'fortress';

interface Air {
  kind: AirKind;
  x: number;
  y: number;
  x0: number;
  t: number;
  hp: number;
  cd: number;
}
interface Ground {
  kind: GroundKind;
  x: number;
  y: number;
  hp: number;
  cd: number;
  dir: number;
}
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mine: boolean;
}
interface Bomb {
  x: number;
  y: number;
  t: number;
}

const AIR_PTS: Record<AirKind, number> = { ring: 100, dart: 150, armor: 300 };
const GROUND_PTS: Record<GroundKind, number> = { dome: 200, tower: 300, tank: 400, fortress: 5000 };
const GROUND_HP: Record<GroundKind, number> = { dome: 1, tower: 1, tank: 2, fortress: FORTRESS_HP };
const GROUND_R: Record<GroundKind, number> = { dome: 16, tower: 14, tank: 18, fortress: 48 };

export interface StrikerState {
  ship: { x: number; y: number; alive: boolean; invuln: number; cd: number; bombCd: number };
  air: Air[];
  ground: Ground[];
  bullets: Bullet[];
  bombs: Bomb[];
  sparks: Spark[];
  stars: { x: number; y: number; s: number }[];
  scroll: number;
  airTimer: number;
  groundTimer: number;
  fortress: boolean;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

function newStage(s: StrikerState): void {
  s.air = [];
  s.ground = [];
  s.bullets = [];
  s.bombs = [];
  s.scroll = 0;
  s.airTimer = 1.5;
  s.groundTimer = 0.6;
  s.fortress = false;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): StrikerState {
  const s: StrikerState = {
    ship: { x: W / 2, y: 470, alive: true, invuln: 1.5, cd: 0, bombCd: 0 },
    air: [],
    ground: [],
    bullets: [],
    bombs: [],
    sparks: [],
    stars: Array.from({ length: 70 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), s: rng.pick([1, 1, 2]) })),
    scroll: 0,
    airTimer: 1.5,
    groundTimer: 0.6,
    fortress: false,
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

function killShip(s: StrikerState, rng: Rng, emit: UpdateContext['emit']): void {
  burst(s.sparks, rng, s.ship.x, s.ship.y, COLORS.cyan, 24);
  s.ship.alive = false;
  s.lives -= 1;
  s.respawn = 1.6;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: StrikerState, input: Input, dt: number, ctx: UpdateContext): void {
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
  const speed = SCROLL + Math.min(s.level, 6) * 6;
  s.scroll += speed * dt;

  if (!ship.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) Object.assign(ship, { x: W / 2, y: 470, alive: true, invuln: 2.4, cd: 0, bombCd: 0 });
  } else {
    ship.invuln = Math.max(0, ship.invuln - dt);
    ship.cd = Math.max(0, ship.cd - dt);
    ship.bombCd = Math.max(0, ship.bombCd - dt);
    ship.x = Math.min(W - 24, Math.max(24, ship.x + ((input.held.right ? 1 : 0) - (input.held.left ? 1 : 0)) * 280 * dt));
    ship.y = Math.min(H - 40, Math.max(300, ship.y + ((input.held.down ? 1 : 0) - (input.held.up ? 1 : 0)) * 220 * dt));
    if (input.held.a && ship.cd <= 0) {
      ship.cd = 0.15;
      s.bullets.push({ x: ship.x - 7, y: ship.y - 14, vx: 0, vy: -640, mine: true }, { x: ship.x + 7, y: ship.y - 14, vx: 0, vy: -640, mine: true });
      emit('fire');
    }
    if (input.pressed.b && ship.bombCd <= 0) {
      ship.bombCd = 0.45;
      s.bombs.push({ x: ship.x, y: ship.y - SIGHT, t: BOMB_FLIGHT });
      emit('pickup');
    }
  }

  // Spawning: air formations all the way, ground installations until the fortress.
  s.airTimer -= dt;
  if (s.airTimer <= 0 && !s.fortress) {
    s.airTimer = Math.max(0.9, 2.4 - s.level * 0.18);
    const kind: AirKind = rng.next() < 0.2 + s.level * 0.03 ? 'armor' : rng.next() < 0.5 ? 'dart' : 'ring';
    const x0 = rng.range(80, W - 80);
    const n = kind === 'ring' ? rng.int(3, 5) : 1;
    for (let k = 0; k < n; k++) s.air.push({ kind, x: x0, y: -30 - k * 38, x0, t: 0, hp: kind === 'armor' ? 3 : 1, cd: rng.range(0.8, 2.2) });
  }
  s.groundTimer -= dt;
  if (s.groundTimer <= 0 && !s.fortress) {
    s.groundTimer = rng.range(0.7, 1.6);
    const kind: GroundKind = rng.pick(['dome', 'dome', 'tower', 'tank']);
    s.ground.push({ kind, x: rng.range(50, W - 50), y: -30, hp: GROUND_HP[kind], cd: rng.range(1, 3), dir: rng.pick([-1, 1]) });
  }
  if (!s.fortress && s.scroll >= STAGE_LENGTH) {
    s.fortress = true;
    s.air = s.air.filter((a) => a.y > 0);
    s.ground.push({ kind: 'fortress', x: W / 2, y: -80, hp: FORTRESS_HP, cd: 1.2, dir: 1 });
  }

  const aim = (x: number, y: number, speedB: number) => {
    const dx = ship.x - x;
    const dy = ship.y - y;
    const d = Math.hypot(dx, dy) || 1;
    return { vx: (dx / d) * speedB, vy: (dy / d) * speedB };
  };
  for (let i = s.air.length - 1; i >= 0; i--) {
    const a = s.air[i]!;
    a.t += dt;
    if (a.kind === 'ring') {
      a.y += 130 * dt;
      a.x = a.x0 + Math.sin(a.t * 2.6) * 110;
    } else if (a.kind === 'dart') {
      a.y += 230 * dt;
      a.x += Math.sign(ship.x - a.x) * 60 * dt;
    } else {
      a.y += 90 * dt;
      a.x = a.x0 + Math.sin(a.t * 1.4) * 150;
    }
    a.cd -= dt;
    if (a.cd <= 0 && a.y > 20 && a.y < 380 && ship.alive && a.kind !== 'ring') {
      const v = aim(a.x, a.y, 230);
      s.bullets.push({ x: a.x, y: a.y, vx: v.vx, vy: v.vy, mine: false });
      a.cd = rng.range(1.4, 2.6);
    }
    if (a.y > H + 40) {
      s.air.splice(i, 1);
      continue;
    }
    if (ship.alive && ship.invuln <= 0 && Math.abs(a.x - ship.x) < 22 && Math.abs(a.y - ship.y) < 20) {
      killShip(s, rng, emit);
      if (s.over) return;
    }
  }
  for (let i = s.ground.length - 1; i >= 0; i--) {
    const gnd = s.ground[i]!;
    const fort = gnd.kind === 'fortress';
    gnd.y += (fort ? Math.max(0, Math.min(speed, 260 - gnd.y)) : speed) * dt;
    if (gnd.kind === 'tank') {
      gnd.x += gnd.dir * 55 * dt;
      if (gnd.x < 40 || gnd.x > W - 40) gnd.dir = 0 - gnd.dir;
    }
    gnd.cd -= dt;
    if (gnd.cd <= 0 && gnd.y > 20 && gnd.y < 420 && ship.alive && (gnd.kind === 'tank' || fort || gnd.kind === 'dome')) {
      const v = aim(gnd.x, gnd.y, 210);
      s.bullets.push({ x: gnd.x, y: gnd.y, vx: v.vx, vy: v.vy, mine: false });
      if (fort) s.bullets.push({ x: gnd.x - 30, y: gnd.y, vx: v.vx - 60, vy: v.vy, mine: false }, { x: gnd.x + 30, y: gnd.y, vx: v.vx + 60, vy: v.vy, mine: false });
      gnd.cd = fort ? 1.1 : rng.range(2.2, 4);
    }
    if (gnd.y > H + 80) s.ground.splice(i, 1);
  }

  // Bombs land at the crosshair position and hit ground targets in a radius.
  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const b = s.bombs[i]!;
    b.t -= dt;
    b.y += speed * dt; // the ground scrolls under it
    if (b.t > 0) continue;
    s.bombs.splice(i, 1);
    burst(s.sparks, rng, b.x, b.y, COLORS.gold, 10);
    emit('explode');
    for (let k = s.ground.length - 1; k >= 0; k--) {
      const gnd = s.ground[k]!;
      if (Math.hypot(gnd.x - b.x, gnd.y - b.y) < BOMB_RADIUS + GROUND_R[gnd.kind]) {
        gnd.hp -= 1;
        if (gnd.hp <= 0) {
          s.score += GROUND_PTS[gnd.kind];
          burst(s.sparks, rng, gnd.x, gnd.y, COLORS.coral, 14);
          const wasFort = gnd.kind === 'fortress';
          s.ground.splice(k, 1);
          if (wasFort) {
            s.levelDelay = 2;
            s.bullets = s.bullets.filter((bl) => bl.mine);
            emit('wave');
          }
        }
      }
    }
  }

  // Bullets.
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) {
      s.bullets.splice(i, 1);
      continue;
    }
    if (b.mine) {
      const ai = s.air.findIndex((a) => Math.abs(a.x - b.x) < 18 && Math.abs(a.y - b.y) < 16);
      if (ai >= 0) {
        const a = s.air[ai]!;
        a.hp -= 1;
        s.bullets.splice(i, 1);
        if (a.hp <= 0) {
          s.score += AIR_PTS[a.kind];
          burst(s.sparks, rng, a.x, a.y, COLORS.purple, 10);
          s.air.splice(ai, 1);
          emit('explode');
        }
      }
    } else if (ship.alive && ship.invuln <= 0 && Math.abs(b.x - ship.x) < 12 && Math.abs(b.y - ship.y) < 12) {
      s.bullets.splice(i, 1);
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

function render(s: StrikerState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  // Scrolling ground texture.
  g.fillStyle = '#16291f';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(79,227,214,0.07)';
  for (let y = -((s.scroll * 1) % 60); y < H; y += 60) g.fillRect(0, y, W, 2);
  g.fillStyle = COLORS.paper;
  for (const st of s.stars) {
    g.globalAlpha = 0.4;
    g.fillRect(st.x, (st.y + s.scroll * 0.3) % H, st.s, st.s);
  }
  g.globalAlpha = 1;
  for (const gnd of s.ground) {
    const r = GROUND_R[gnd.kind];
    g.fillStyle = gnd.kind === 'dome' ? COLORS.muted : gnd.kind === 'tower' ? COLORS.purple : gnd.kind === 'tank' ? COLORS.gold : COLORS.coral;
    if (gnd.kind === 'dome') {
      g.beginPath();
      g.arc(gnd.x, gnd.y, r, 0, TAU);
      g.fill();
    } else if (gnd.kind === 'fortress') {
      g.fillRect(gnd.x - r * 1.6, gnd.y - r * 0.6, r * 3.2, r * 1.2);
      g.fillStyle = COLORS.bg;
      g.fillRect(gnd.x - 10, gnd.y - 6, 20, 12);
      g.fillStyle = COLORS.gold;
      g.fillRect(gnd.x - r * 1.6, gnd.y + r * 0.6 + 4, (r * 3.2 * gnd.hp) / FORTRESS_HP, 4);
    } else g.fillRect(gnd.x - r, gnd.y - r * 0.7, r * 2, r * 1.4);
  }
  for (const a of s.air) {
    g.fillStyle = a.kind === 'armor' ? COLORS.paper : a.kind === 'dart' ? COLORS.coral : COLORS.cyan;
    g.beginPath();
    if (a.kind === 'ring') {
      g.arc(a.x, a.y, 11, 0, TAU);
      g.arc(a.x, a.y, 5, 0, TAU, true);
    } else if (a.kind === 'dart') {
      g.moveTo(a.x, a.y + 12);
      g.lineTo(a.x - 9, a.y - 10);
      g.lineTo(a.x + 9, a.y - 10);
    } else g.rect(a.x - 14, a.y - 10, 28, 20);
    g.fill();
  }
  for (const b of s.bombs) {
    g.fillStyle = COLORS.paper;
    g.fillRect(b.x - 3, b.y - 3, 6, 6);
  }
  for (const b of s.bullets) {
    g.fillStyle = b.mine ? COLORS.gold : COLORS.coral;
    g.fillRect(b.x - 2, b.y - 4, 4, 8);
  }
  if (s.ship.alive && (s.ship.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    g.fillStyle = COLORS.cyan;
    g.beginPath();
    g.moveTo(s.ship.x, s.ship.y - 18);
    g.lineTo(s.ship.x - 14, s.ship.y + 12);
    g.lineTo(s.ship.x, s.ship.y + 5);
    g.lineTo(s.ship.x + 14, s.ship.y + 12);
    g.closePath();
    g.fill();
    // The bombing sight, a little way ahead of the ship.
    g.strokeStyle = COLORS.gold;
    g.lineWidth = 2;
    g.strokeRect(s.ship.x - 9, s.ship.y - SIGHT - 9, 18, 18);
    g.beginPath();
    g.moveTo(s.ship.x - 14, s.ship.y - SIGHT);
    g.lineTo(s.ship.x + 14, s.ship.y - SIGHT);
    g.moveTo(s.ship.x, s.ship.y - SIGHT - 14);
    g.lineTo(s.ship.x, s.ship.y - SIGHT + 14);
    g.stroke();
  }
  drawSparks(g, s.sparks);
  hud(g, s, `STAGE ${s.level}  ${s.fortress ? 'FORTRESS!' : `${Math.min(100, Math.floor((s.scroll / STAGE_LENGTH) * 100))}%`}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'STAGE CLEAR!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<StrikerState> = {
  id: 'zone-striker',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
