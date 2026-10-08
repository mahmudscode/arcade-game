import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, TAU, W, type Spark } from '../_shared';

const PLAYER_Y = H - 56;
const SPEED = 300;
const SHOT_SPEED = 600;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_WAVE = 30;
const SHIELD_TIME = 1.2;
const SHIELD_COOLDOWN = 4;
const BOSS_COLS = 12;
const BOSS_ROWS = 3;
const CELL = 24;
const BOSS_Y = 110;
const BAND_Y = 210;

interface Bird {
  x: number;
  y: number;
  hx: number;
  hy: number;
  mode: 'form' | 'swoop';
  t: number;
  x0: number;
  dir: 1 | -1;
  cd: number;
  big: boolean;
}

interface Boss {
  x: number;
  dir: 1 | -1;
  cells: boolean[];
  alienAlive: boolean;
  bandX: number;
  cd: number;
}

export interface EmberState {
  birds: Bird[];
  boss: Boss | null;
  sway: number;
  swoopTimer: number;
  player: { x: number; alive: boolean };
  shield: number;
  shieldCd: number;
  shots: { x: number; y: number }[];
  fireCd: number;
  bombs: { x: number; y: number; vx: number }[];
  sparks: Spark[];
  stars: { x: number; y: number; s: number }[];
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  respawn: number;
  waveDelay: number;
  nextLife: number;
}

/** Waves cycle: small birds, big birds, then the mothership. */
const stageOf = (wave: number) => (wave - 1) % 3;

function startWave(s: EmberState): void {
  s.birds = [];
  s.boss = null;
  s.bombs = [];
  s.shots = [];
  const stage = stageOf(s.wave);
  if (stage === 2) {
    s.boss = { x: W / 2, dir: 1, cells: Array.from({ length: BOSS_COLS * BOSS_ROWS }, () => true), alienAlive: true, bandX: 200, cd: 1.5 };
    return;
  }
  const rows = stage === 0 ? 2 : 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 8; c++) {
      const hx = 140 + c * 74;
      const hy = 80 + r * 46;
      s.birds.push({ x: hx, y: hy, hx, hy, mode: 'form', t: 0, x0: hx, dir: 1, cd: 1, big: stage === 1 });
    }
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): EmberState {
  const s: EmberState = {
    birds: [],
    boss: null,
    sway: 0,
    swoopTimer: 3,
    player: { x: W / 2, alive: true },
    shield: 0,
    shieldCd: 0,
    shots: [],
    fireCd: 0,
    bombs: [],
    sparks: [],
    stars: Array.from({ length: 60 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), s: rng.pick([1, 1, 2]) })),
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    respawn: 0,
    waveDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
  startWave(s);
  return s;
}

const cellX = (b: Boss, c: number) => b.x - (BOSS_COLS * CELL) / 2 + c * CELL + CELL / 2;
const cellY = (r: number) => BOSS_Y + r * CELL + CELL / 2;

function hitPlayer(s: EmberState, rng: Rng, emit: UpdateContext['emit']): void {
  if (!s.player.alive || s.shield > 0) return;
  burst(s.sparks, rng, s.player.x, PLAYER_Y, COLORS.cyan, 26);
  emit('die');
  s.player.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  if (s.lives <= 0) s.over = true;
}

function update(s: EmberState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  for (const st of s.stars) {
    st.y += st.s * 30 * dt;
    if (st.y > H) st.y -= H;
  }
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  s.sway += dt;
  s.fireCd = Math.max(0, s.fireCd - dt);
  s.shield = Math.max(0, s.shield - dt);
  s.shieldCd = Math.max(0, s.shieldCd - dt);

  const p = s.player;
  if (p.alive) {
    if (input.held.left) p.x -= SPEED * dt;
    if (input.held.right) p.x += SPEED * dt;
    p.x = Math.min(W - 24, Math.max(24, p.x));
    if ((input.pressed.a || input.held.a) && s.fireCd <= 0 && s.shots.length < 3) {
      s.fireCd = 0.18;
      s.shots.push({ x: p.x, y: PLAYER_Y - 16 });
      emit('fire');
    }
    if (input.pressed.b && s.shieldCd <= 0) {
      s.shield = SHIELD_TIME;
      s.shieldCd = SHIELD_COOLDOWN;
      emit('pickup');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      p.alive = true;
      p.x = W / 2;
    }
  }

  const bombSpeed = 200 + Math.min(s.wave, MAX_WAVE) * 5;

  // Birds hover in formation and swoop down in a sine path.
  s.swoopTimer -= dt;
  if (s.swoopTimer <= 0 && s.birds.length > 0) {
    s.swoopTimer = Math.max(0.7, 2.6 - s.wave * 0.06) * rng.range(0.6, 1.3);
    const idle = s.birds.filter((b) => b.mode === 'form');
    if (idle.length > 0) {
      const b = rng.pick(idle);
      b.mode = 'swoop';
      b.t = 0;
      b.x0 = b.x;
      b.dir = b.x < W / 2 ? 1 : -1;
    }
  }
  for (const b of s.birds) {
    if (b.mode === 'form') {
      b.x = b.hx + Math.sin(s.sway * 1.3 + b.hy * 0.05) * 30;
      b.y = b.hy;
      b.cd -= dt;
      if (b.cd <= 0 && s.birds.length < 40) {
        b.cd = rng.range(2.5, 6) / (1 + s.wave * 0.05);
        if (rng.next() < 0.5) s.bombs.push({ x: b.x, y: b.y + 12, vx: 0 });
      }
    } else {
      b.t += dt;
      b.y = b.hy + b.t * (200 + s.wave * 6);
      b.x = b.x0 + b.dir * 90 * Math.sin(b.t * 3.2);
      b.cd -= dt;
      if (b.cd <= 0 && b.y < PLAYER_Y - 120) {
        b.cd = rng.range(0.6, 1.2);
        s.bombs.push({ x: b.x, y: b.y + 12, vx: (p.x - b.x) * 0.15 });
      }
      if (b.y > H + 30) {
        b.mode = 'form';
        b.y = b.hy;
      }
    }
  }

  // Mothership: wide hull, sliding armour band under it, alien at the core.
  const boss = s.boss;
  if (boss) {
    boss.x += boss.dir * (50 + s.wave * 3) * dt;
    if (boss.x < 200 || boss.x > W - 200) boss.dir = boss.dir === 1 ? -1 : 1;
    boss.bandX += -boss.dir * 110 * dt;
    if (boss.bandX < 100 || boss.bandX > W - 100) boss.bandX = Math.min(W - 100, Math.max(100, boss.bandX));
    boss.cd -= dt;
    if (boss.cd <= 0) {
      boss.cd = Math.max(0.5, 1.4 - s.wave * 0.03) * rng.range(0.7, 1.3);
      const alive: number[] = [];
      boss.cells.forEach((on, i) => on && alive.push(i));
      if (alive.length > 0) {
        const i = rng.pick(alive);
        s.bombs.push({ x: cellX(boss, i % BOSS_COLS), y: cellY(Math.floor(i / BOSS_COLS)) + 10, vx: (p.x - cellX(boss, i % BOSS_COLS)) * 0.12 });
      }
    }
  }

  // Player shots.
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.y -= SHOT_SPEED * dt;
    let spent = sh.y < 8;
    if (!spent && boss && sh.y < BAND_Y + 8 && sh.y > BAND_Y - 8 && Math.abs(sh.x - boss.bandX) < 90) spent = true;
    if (!spent && boss) {
      for (let c = 0; c < BOSS_COLS * BOSS_ROWS; c++) {
        if (!boss.cells[c]) continue;
        if (Math.abs(sh.x - cellX(boss, c % BOSS_COLS)) < CELL / 2 && Math.abs(sh.y - cellY(Math.floor(c / BOSS_COLS))) < CELL / 2) {
          boss.cells[c] = false;
          s.score += 30;
          burst(s.sparks, rng, sh.x, sh.y, COLORS.gold, 6);
          emit('explode');
          spent = true;
          break;
        }
      }
      // A cleared column lets shots reach the alien core.
      if (!spent && boss.alienAlive && Math.abs(sh.x - boss.x) < 16 && Math.abs(sh.y - (BOSS_Y + 3 * CELL + 14)) < 14) {
        boss.alienAlive = false;
        s.score += 1000 + s.wave * 100;
        burst(s.sparks, rng, boss.x, BOSS_Y + 3 * CELL + 14, COLORS.coral, 30);
        emit('explode');
        s.boss = null;
        spent = true;
      }
    }
    if (!spent) {
      for (let k = 0; k < s.birds.length; k++) {
        const b = s.birds[k]!;
        if (Math.abs(sh.x - b.x) < 18 && Math.abs(sh.y - b.y) < 14) {
          s.score += (b.big ? 80 : 50) * (b.mode === 'swoop' ? 2 : 1);
          burst(s.sparks, rng, b.x, b.y, b.big ? COLORS.purple : COLORS.coral, 12);
          emit('explode');
          s.birds.splice(k, 1);
          spent = true;
          break;
        }
      }
    }
    if (spent) s.shots.splice(i, 1);
  }

  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const b = s.bombs[i]!;
    b.y += bombSpeed * dt;
    b.x += b.vx * dt;
    let remove = b.y > H;
    if (!remove && p.alive && Math.abs(b.x - p.x) < 18 && Math.abs(b.y - PLAYER_Y) < 14) {
      remove = true;
      hitPlayer(s, rng, emit);
    }
    if (remove) s.bombs.splice(i, 1);
  }
  for (let k = s.birds.length - 1; k >= 0; k--) {
    const b = s.birds[k]!;
    if (b.mode === 'swoop' && p.alive && Math.abs(b.x - p.x) < 24 && Math.abs(b.y - PLAYER_Y) < 18) {
      burst(s.sparks, rng, b.x, b.y, COLORS.coral, 10);
      s.birds.splice(k, 1);
      hitPlayer(s, rng, emit);
    }
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }

  if (!s.over && s.birds.length === 0 && !s.boss) {
    if (s.waveDelay <= 0) s.waveDelay = 1.8;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave += 1;
      startWave(s);
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: EmberState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = COLORS.paper;
  g.globalAlpha = 0.5;
  for (const st of s.stars) g.fillRect(st.x, st.y, st.s, st.s);
  g.globalAlpha = 1;

  const flap = Math.floor(time * 6) % 2 === 0;
  for (const b of s.birds) {
    g.fillStyle = b.big ? COLORS.purple : COLORS.coral;
    const w = b.big ? 20 : 15;
    g.beginPath();
    g.ellipse(b.x, b.y, w * 0.55, 8, 0, 0, TAU);
    g.fill();
    g.fillRect(b.x - w - 4, b.y - 8 + (flap ? 6 : 0), w, 5);
    g.fillRect(b.x + 4, b.y - 8 + (flap ? 6 : 0), w, 5);
    g.fillStyle = COLORS.gold;
    g.fillRect(b.x - 2, b.y + 4, 4, 5);
  }

  const boss = s.boss;
  if (boss) {
    g.fillStyle = COLORS.muted;
    g.fillRect(boss.x - 36, BOSS_Y + 3 * CELL + 2, 72, 24);
    if (boss.alienAlive) {
      g.fillStyle = COLORS.coral;
      g.beginPath();
      g.arc(boss.x, BOSS_Y + 3 * CELL + 14, 10, 0, TAU);
      g.fill();
    }
    boss.cells.forEach((on, i) => {
      if (!on) return;
      g.fillStyle = Math.floor(i / BOSS_COLS) === 1 ? COLORS.gold : COLORS.purple;
      g.fillRect(cellX(boss, i % BOSS_COLS) - CELL / 2 + 1, cellY(Math.floor(i / BOSS_COLS)) - CELL / 2 + 1, CELL - 2, CELL - 2);
    });
    g.fillStyle = COLORS.cyan;
    g.fillRect(boss.bandX - 90, BAND_Y - 4, 180, 8);
  }

  if (s.player.alive) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(s.player.x - 18, PLAYER_Y, 36, 9);
    g.fillRect(s.player.x - 5, PLAYER_Y - 9, 10, 11);
    g.fillRect(s.player.x - 2, PLAYER_Y - 16, 4, 9);
    if (s.shield > 0) {
      g.strokeStyle = COLORS.gold;
      g.lineWidth = 3;
      g.globalAlpha = 0.5 + 0.5 * Math.sin(time * 40);
      g.beginPath();
      g.arc(s.player.x, PLAYER_Y - 2, 28, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  g.fillStyle = COLORS.gold;
  for (const sh of s.shots) g.fillRect(sh.x - 2, sh.y - 8, 4, 14);
  g.fillStyle = COLORS.coral;
  for (const b of s.bombs) g.fillRect(b.x - 2, b.y - 6, 5, 12);
  drawSparks(g, s.sparks);

  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `WAVE ${s.wave}  SHIELD ${s.shieldCd <= 0 ? 'READY' : Math.ceil(s.shieldCd)}`, s.lives);
  gameOver(g, s.over);
}

const emberWing: GameDefinition<EmberState> = {
  id: 'ember-wing',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};

export default emberWing;
