import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const GROUND = 520;
const CW = 34;
const CH = 30;
const COLS = 4;
const START_LIVES = 3;
const MAX_HP = 100;
const EXTRA_LIFE_EVERY = 20000;
/** A building falls once this share of its windows is broken. */
const COLLAPSE_AT = 0.7;
const WIN_HP = 2;

interface Building {
  x: number;
  rows: number;
  /** Window hit points (0 = broken). */
  win: number[];
  /** 1 where a person is waiting at the window. */
  people: number[];
  /** 1 where a sniper is posted. */
  sniper: number[];
  cd: number[];
  /** 0 standing; counts up while the building collapses; destroyed when done. */
  fall: number;
  dead: boolean;
}
interface Tank {
  x: number;
  dir: number;
  cd: number;
}
interface Chopper {
  x: number;
  y: number;
  dir: number;
  cd: number;
}
interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface StomperState {
  buildings: Building[];
  mon: {
    /** Ground position in pixels (used when not climbing). */
    x: number;
    /** Index of the building being climbed, or -1 on the ground. */
    b: number;
    col: number;
    row: number;
    face: number;
    move: number;
    punch: number;
    hp: number;
    invuln: number;
  };
  tanks: Tank[];
  choppers: Chopper[];
  shots: Shot[];
  sparks: Spark[];
  tankTimer: number;
  chopTimer: number;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const top = (b: Building) => GROUND - b.rows * CH;
const cellCenter = (b: Building, c: number, r: number) => ({ x: b.x + c * CW + CW / 2, y: top(b) + r * CH + CH / 2 });
const alive = (b: Building) => !b.dead;
const brokenShare = (b: Building) => b.win.filter((w) => w === 0).length / b.win.length;

function makeBuilding(x: number, rows: number, level: number, rng: Rng): Building {
  const n = rows * COLS;
  const win = Array.from({ length: n }, () => WIN_HP);
  const people = win.map(() => (rng.next() < 0.18 ? 1 : 0));
  const sniper = win.map((_, i) => (people[i] === 0 && rng.next() < 0.05 + Math.min(level, 6) * 0.01 ? 1 : 0));
  return { x, rows, win, people, sniper, cd: win.map(() => rng.range(1, 3)), fall: 0, dead: false };
}

function buildLevel(s: StomperState, rng: Rng): void {
  s.buildings = [0, 1, 2].map((i) => makeBuilding(70 + i * 250, 6 + ((i + s.level) % 3), s.level, rng));
  s.tanks = [];
  s.choppers = [];
  s.shots = [];
  s.tankTimer = 3;
  s.chopTimer = 6;
  Object.assign(s.mon, { x: 400, b: -1, col: 0, row: 0, face: 1, move: 0, punch: 0, hp: MAX_HP, invuln: 1.5 });
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): StomperState {
  const s: StomperState = {
    buildings: [],
    mon: { x: 400, b: -1, col: 0, row: 0, face: 1, move: 0, punch: 0, hp: MAX_HP, invuln: 1.5 },
    tanks: [],
    choppers: [],
    shots: [],
    sparks: [],
    tankTimer: 3,
    chopTimer: 6,
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  buildLevel(s, rng);
  return s;
}

/** Where the monster is on screen (its centre). */
export function monsterPos(s: StomperState): { x: number; y: number } {
  const m = s.mon;
  if (m.b >= 0) return cellCenter(s.buildings[m.b]!, m.col, m.row);
  return { x: m.x, y: GROUND - 28 };
}

function hurt(s: StomperState, amount: number, rng: Rng, emit: UpdateContext['emit']): void {
  const m = s.mon;
  if (m.invuln > 0 || s.respawn > 0) return;
  m.hp -= amount;
  m.invuln = 0.25;
  emit('pickup');
  if (m.hp <= 0) {
    m.hp = 0;
    const p = monsterPos(s);
    burst(s.sparks, rng, p.x, p.y, COLORS.coral, 26);
    s.lives -= 1;
    s.respawn = 1.8;
    emit('die');
    if (s.lives <= 0) s.over = true;
  }
}

function collapse(s: StomperState, b: Building, rng: Rng, emit: UpdateContext['emit']): void {
  b.fall = 0.001;
  s.score += 1000;
  emit('explode');
  for (let k = 0; k < 6; k++) burst(s.sparks, rng, b.x + rng.range(0, COLS * CW), top(b) + rng.range(0, b.rows * CH), COLORS.gold, 6);
  // A monster still hanging on rides the building down.
  if (s.mon.b === s.buildings.indexOf(b)) {
    s.mon.b = -1;
    s.mon.x = b.x + (COLS * CW) / 2;
    hurt(s, 15, rng, emit);
  }
}

function punch(s: StomperState, rng: Rng, emit: UpdateContext['emit']): void {
  const m = s.mon;
  m.punch = 0.22;
  emit('fire');
  if (m.b >= 0) {
    const b = s.buildings[m.b]!;
    // The fist hits the window the monster is on, plus the one above it.
    for (const r of [m.row, m.row - 1]) {
      if (r < 0) continue;
      const i = r * COLS + m.col;
      if (b.win[i]! <= 0) continue;
      b.win[i] = b.win[i]! - 1;
      if (b.win[i] === 0) {
        s.score += 10;
        const c = cellCenter(b, m.col, r);
        burst(s.sparks, rng, c.x, c.y, COLORS.cyan, 5);
        if (b.people[i]) {
          b.people[i] = 0;
          s.score += 100;
          m.hp = Math.min(MAX_HP, m.hp + 6);
          emit('wave');
        }
        if (b.sniper[i]) {
          b.sniper[i] = 0;
          s.score += 50;
        }
      }
    }
    if (!b.dead && b.fall === 0 && brokenShare(b) >= COLLAPSE_AT) collapse(s, b, rng, emit);
    // Choppers close enough get swatted.
    const p = monsterPos(s);
    for (let i = s.choppers.length - 1; i >= 0; i--) {
      const c = s.choppers[i]!;
      if (Math.hypot(c.x - p.x - m.face * 20, c.y - p.y) < 55) {
        s.score += 300;
        burst(s.sparks, rng, c.x, c.y, COLORS.gold, 14);
        s.choppers.splice(i, 1);
        emit('explode');
      }
    }
  } else {
    for (let i = s.tanks.length - 1; i >= 0; i--) {
      const t = s.tanks[i]!;
      if (Math.abs(t.x - (m.x + m.face * 30)) < 55) {
        s.score += 200;
        burst(s.sparks, rng, t.x, GROUND - 10, COLORS.coral, 14);
        s.tanks.splice(i, 1);
        emit('explode');
      }
    }
  }
}

function update(s: StomperState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  stepSparks(s.sparks, dt);
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  // Collapse animations.
  for (const b of s.buildings) {
    if (b.fall > 0 && !b.dead) {
      b.fall += dt;
      if (b.fall >= 1.2) b.dead = true;
    }
  }
  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      buildLevel(s, rng);
      emit('wave');
    }
    return;
  }

  const m = s.mon;
  const wasAlive = s.respawn <= 0;
  if (s.respawn > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) Object.assign(m, { x: 400, b: -1, hp: MAX_HP, invuln: 2.2, punch: 0, move: 0 });
  } else {
    m.invuln = Math.max(0, m.invuln - dt);
    m.punch = Math.max(0, m.punch - dt);
    m.move = Math.max(0, m.move - dt);
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    if (dx !== 0) m.face = dx;
    if (m.b < 0) {
      m.x = Math.min(780, Math.max(20, m.x + dx * 170 * dt));
      if (input.held.up) {
        const bi = s.buildings.findIndex((b) => alive(b) && b.fall === 0 && m.x >= b.x - 14 && m.x <= b.x + COLS * CW + 14);
        if (bi >= 0) {
          const b = s.buildings[bi]!;
          m.b = bi;
          m.col = Math.min(COLS - 1, Math.max(0, Math.floor((m.x - b.x) / CW)));
          m.row = b.rows - 1;
          m.move = 0.18;
        }
      }
    } else {
      const b = s.buildings[m.b]!;
      if (m.move <= 0) {
        const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
        if (dx !== 0 || dy !== 0) {
          // Climbing moves one window at a time.
          const nc = Math.min(COLS - 1, Math.max(0, m.col + (dy === 0 ? dx : 0)));
          const nr = m.row + dy;
          if (nr >= b.rows) {
            m.b = -1;
            m.x = b.x + m.col * CW + CW / 2;
          } else {
            m.col = nc;
            m.row = Math.max(0, nr);
          }
          m.move = 0.16;
        }
      }
    }
    if (input.pressed.a) punch(s, rng, emit);
  }

  // Enemies.
  s.tankTimer -= dt;
  if (s.tankTimer <= 0) {
    s.tankTimer = Math.max(4, 8 - s.level * 0.4);
    if (s.tanks.length < 1 + Math.ceil(s.level / 2)) {
      const dir = rng.next() < 0.5 ? 1 : -1;
      s.tanks.push({ x: dir === 1 ? -30 : W + 30, dir, cd: rng.range(1.5, 3) });
    }
  }
  s.chopTimer -= dt;
  if (s.chopTimer <= 0) {
    s.chopTimer = Math.max(6, 12 - s.level);
    if (s.choppers.length < 1 + Math.floor(s.level / 2)) {
      const dir = rng.next() < 0.5 ? 1 : -1;
      s.choppers.push({ x: dir === 1 ? -30 : W + 30, y: rng.range(120, 320), dir, cd: rng.range(1, 2.5) });
    }
  }
  const mp = monsterPos(s);
  const target = (x: number, y: number, speed: number): Shot => {
    const d = Math.hypot(mp.x - x, mp.y - y) || 1;
    return { x, y, vx: ((mp.x - x) / d) * speed, vy: ((mp.y - y) / d) * speed };
  };
  for (let i = s.tanks.length - 1; i >= 0; i--) {
    const t = s.tanks[i]!;
    // Tanks drive toward the monster and stop to shell it.
    if (Math.abs(t.x - mp.x) > 260) t.x += Math.sign(mp.x - t.x) * 45 * dt;
    t.cd -= dt;
    if (t.cd <= 0 && s.respawn <= 0 && Math.abs(t.x - mp.x) < 340) {
      s.shots.push(target(t.x, GROUND - 22, 240));
      t.cd = Math.max(1.8, 3.4 - s.level * 0.15);
    }
  }
  for (let i = s.choppers.length - 1; i >= 0; i--) {
    const c = s.choppers[i]!;
    c.x += c.dir * 80 * dt;
    c.cd -= dt;
    if (c.cd <= 0 && s.respawn <= 0 && Math.abs(c.x - mp.x) < 200) {
      s.shots.push(target(c.x, c.y + 10, 260));
      c.cd = 1.9;
    }
    if (c.x < -60 || c.x > W + 60) s.choppers.splice(i, 1);
  }
  for (const b of s.buildings) {
    if (!alive(b) || b.fall > 0) continue;
    for (let i = 0; i < b.win.length; i++) {
      if (!b.sniper[i] || b.win[i] === 0) continue;
      b.cd[i]! -= dt;
      const c = cellCenter(b, i % COLS, Math.floor(i / COLS));
      if (b.cd[i]! <= 0 && s.respawn <= 0 && Math.hypot(c.x - mp.x, c.y - mp.y) < 150) {
        s.shots.push(target(c.x, c.y, 280));
        b.cd[i] = 2.6;
      }
    }
  }
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    if (sh.x < -20 || sh.x > W + 20 || sh.y < -20 || sh.y > H + 20) {
      s.shots.splice(i, 1);
      continue;
    }
    if (s.respawn <= 0 && Math.hypot(sh.x - mp.x, sh.y - mp.y) < 22) {
      s.shots.splice(i, 1);
      hurt(s, 8, rng, emit);
      if (s.over) return;
    }
  }

  // Enemy fire in flight is cleared after the loops, so their indices stay valid.
  if (wasAlive && s.respawn > 0) s.shots = [];

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.buildings.every((b) => b.fall > 0 || b.dead) && s.levelDelay <= 0) s.levelDelay = 2.4;
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: StomperState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = '#1d1440';
  g.fillRect(0, GROUND, W, H - GROUND);
  g.fillStyle = COLORS.muted;
  g.fillRect(0, GROUND, W, 3);
  for (const b of s.buildings) {
    if (b.dead) continue;
    const shake = b.fall > 0 ? Math.sin(time * 60) * 3 : 0;
    const drop = b.fall > 0 ? b.fall * b.fall * 160 : 0;
    g.fillStyle = '#3a2f6b';
    g.fillRect(b.x + shake, top(b) + drop, COLS * CW, b.rows * CH - drop);
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x = b.x + c * CW + 5 + shake;
        const y = top(b) + r * CH + 5 + drop;
        if (y > GROUND - 8) continue;
        g.fillStyle = b.win[i] === 0 ? '#120a2a' : b.win[i] === 1 ? '#7a6bc0' : COLORS.gold;
        g.fillRect(x, y, CW - 10, CH - 10);
        if (b.win[i]! > 0 && b.people[i]) {
          g.fillStyle = COLORS.coral;
          g.fillRect(x + 6, y + 5, 6, 9);
        }
        if (b.win[i]! > 0 && b.sniper[i]) {
          g.fillStyle = COLORS.bg;
          g.fillRect(x + 4, y + 4, 12, 4);
        }
      }
    }
  }
  for (const t of s.tanks) {
    g.fillStyle = COLORS.purple;
    g.fillRect(t.x - 22, GROUND - 22, 44, 16);
    g.fillRect(t.x - 8, GROUND - 32, 16, 10);
    g.fillStyle = COLORS.muted;
    g.fillRect(t.x - 24, GROUND - 8, 48, 8);
  }
  for (const c of s.choppers) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(c.x - 16, c.y - 6, 32, 14);
    g.fillRect(c.x - 24 * (Math.floor(time * 30) % 2 ? 1 : 0.6), c.y - 10, 48 * (Math.floor(time * 30) % 2 ? 1 : 0.6), 3);
  }
  for (const sh of s.shots) {
    g.fillStyle = COLORS.coral;
    g.fillRect(sh.x - 3, sh.y - 3, 7, 7);
  }
  if (s.respawn <= 0) {
    const p = monsterPos(s);
    const flash = s.mon.invuln > 0 && Math.floor(time * 20) % 2 === 0;
    g.fillStyle = flash ? COLORS.paper : '#7BE495';
    g.fillRect(p.x - 14, p.y - 24, 28, 48);
    g.fillRect(p.x - 10 + s.mon.face * 10, p.y - 36, 22, 16);
    g.fillStyle = COLORS.bg;
    g.fillRect(p.x - 4 + s.mon.face * 10, p.y - 31, 4, 5);
    if (s.mon.punch > 0) {
      g.fillStyle = COLORS.gold;
      g.fillRect(p.x + s.mon.face * 18 - 6, p.y - 12, 14, 12);
    }
  }
  drawSparks(g, s.sparks);
  // Health bar.
  g.fillStyle = COLORS.muted;
  g.fillRect(W / 2 - 100, 40, 200, 10);
  g.fillStyle = s.mon.hp > 30 ? COLORS.cyan : COLORS.coral;
  g.fillRect(W / 2 - 100, 40, 2 * s.mon.hp, 10);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'CITY FLATTENED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<StomperState> = {
  id: 'skyline-stomper',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
