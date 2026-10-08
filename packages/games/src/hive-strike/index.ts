import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, TAU, W, type Spark } from '../_shared';

const COLS = 8;
const GAP_X = 54;
const GAP_Y = 40;
const PLAYER_Y = H - 56;
const PLAYER_SPEED = 300;
const SHOT_SPEED = 620;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_WAVE = 30;
const BEAM_Y = PLAYER_Y - 190;
const KIND_COLORS = [COLORS.coral, COLORS.purple, COLORS.gold, COLORS.cyan];
const FORM_POINTS = [150, 80, 80, 50];
const DIVE_POINTS = [400, 160, 160, 100];

/** Formation slots: a boss row of 4 above three full rows. */
const SLOTS: { col: number; row: number }[] = [];
for (let row = 0; row < 4; row++) {
  for (let col = row === 0 ? 2 : 0; col < (row === 0 ? 6 : COLS); col++) SLOTS.push({ col, row });
}

type Mode = 'wait' | 'enter' | 'form' | 'dive' | 'beam' | 'return';

interface Foe {
  /** Formation slot index, or -1 during a challenge stage (no formation). */
  slot: number;
  kind: number;
  mode: Mode;
  t: number;
  delay: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  dir: 1 | -1;
  hp: number;
  cd: number;
  beamT: number;
  captive: boolean;
}

interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface HiveState {
  foes: Foe[];
  sway: number;
  diveTimer: number;
  player: { x: number; alive: boolean; dual: boolean; invuln: number };
  dualPending: boolean;
  shots: { x: number; y: number }[];
  fireCd: number;
  bombs: Bomb[];
  sparks: Spark[];
  stars: { x: number; y: number; s: number }[];
  challenge: boolean;
  challengeTotal: number;
  challengeHits: number;
  note: string;
  noteTimer: number;
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  respawn: number;
  waveDelay: number;
  nextLife: number;
}

const slotPos = (s: HiveState, i: number) => {
  const { col, row } = SLOTS[i]!;
  return { x: W / 2 + (col - (COLS - 1) / 2) * GAP_X + Math.sin(s.sway) * 50, y: 90 + row * GAP_Y };
};

function makeFoe(slot: number, kind: number, delay: number): Foe {
  return { slot, kind, mode: 'wait', t: 0, delay, x: -100, y: -100, x0: 0, y0: 0, cx: 0, cy: 0, x1: 0, y1: 0, dir: 1, hp: kind === 0 ? 2 : 1, cd: 1, beamT: 0, captive: false };
}

function startWave(s: HiveState): void {
  s.foes = [];
  s.bombs = [];
  s.shots = [];
  s.challenge = s.wave % 4 === 3;
  s.challengeHits = 0;
  if (s.challenge) {
    for (let i = 0; i < 32; i++) {
      const g = Math.floor(i / 8);
      const side = g % 2 === 0;
      const f = makeFoe(-1, 1 + (g % 3), g * 1.7 + (i % 8) * 0.2);
      f.x0 = side ? W * 0.7 : W * 0.3;
      f.y0 = -30;
      f.cx = side ? 0 : W;
      f.cy = H * 1.6;
      f.x1 = side ? W * 0.2 : W * 0.8;
      f.y1 = -30;
      s.foes.push(f);
    }
    s.challengeTotal = s.foes.length;
    s.note = 'CHALLENGE STAGE';
  } else {
    SLOTS.forEach((sl, i) => {
      const g = Math.floor(i / 7);
      const f = makeFoe(i, sl.row, g * 1.6 + (i % 7) * 0.17);
      const side = g % 2 === 0;
      f.x0 = side ? -30 : W + 30;
      f.y0 = 120;
      f.cx = side ? W * 0.75 : W * 0.25;
      f.cy = H * 0.8;
      s.foes.push(f);
    });
    s.challengeTotal = 0;
    s.note = `WAVE ${s.wave}`;
  }
  s.noteTimer = 1.6;
  s.diveTimer = 4;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): HiveState {
  const s: HiveState = {
    foes: [],
    sway: 0,
    diveTimer: 4,
    player: { x: W / 2, alive: true, dual: false, invuln: 0 },
    dualPending: false,
    shots: [],
    fireCd: 0,
    bombs: [],
    sparks: [],
    stars: Array.from({ length: 70 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), s: rng.pick([1, 1, 2]) })),
    challenge: false,
    challengeTotal: 0,
    challengeHits: 0,
    note: '',
    noteTimer: 0,
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

function bezier(f: Foe, t: number): void {
  const u = 1 - t;
  f.x = u * u * f.x0 + 2 * u * t * f.cx + t * t * f.x1;
  f.y = u * u * f.y0 + 2 * u * t * f.cy + t * t * f.y1;
}

const toward = (v: number, target: number, step: number) => (Math.abs(target - v) <= step ? target : v + Math.sign(target - v) * step);

function killPlayer(s: HiveState, rng: Rng, emit: UpdateContext['emit']): void {
  if (!s.player.alive || s.player.invuln > 0) return;
  burst(s.sparks, rng, s.player.x, PLAYER_Y, COLORS.cyan, 26);
  emit('die');
  if (s.player.dual) {
    s.player.dual = false;
    s.player.invuln = 1.2;
    return;
  }
  s.player.alive = false;
  s.lives -= 1;
  s.respawn = 1.6;
  if (s.lives <= 0) s.over = true;
}

function update(s: HiveState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;

  for (const st of s.stars) {
    st.y += st.s * 40 * dt;
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

  s.sway += dt * 0.9;
  s.noteTimer = Math.max(0, s.noteTimer - dt);
  s.player.invuln = Math.max(0, s.player.invuln - dt);
  s.fireCd = Math.max(0, s.fireCd - dt);

  // Player.
  const p = s.player;
  if (p.alive) {
    if (input.held.left) p.x -= PLAYER_SPEED * dt;
    if (input.held.right) p.x += PLAYER_SPEED * dt;
    const margin = p.dual ? 42 : 24;
    p.x = Math.min(W - margin, Math.max(margin, p.x));
    const maxShots = p.dual ? 4 : 2;
    if ((input.pressed.a || input.held.a) && s.fireCd <= 0 && s.shots.length < maxShots) {
      s.fireCd = 0.14;
      if (p.dual) {
        s.shots.push({ x: p.x - 15, y: PLAYER_Y - 16 }, { x: p.x + 15, y: PLAYER_Y - 16 });
      } else {
        s.shots.push({ x: p.x, y: PLAYER_Y - 16 });
      }
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      p.alive = true;
      p.x = W / 2;
      p.invuln = 1.5;
    }
  }
  if (p.alive && s.dualPending) {
    s.dualPending = false;
    p.dual = true;
    s.note = 'DUAL FIGHTER';
    s.noteTimer = 1.6;
    emit('pickup');
  }

  // Foes.
  let divers = 0;
  let beaming = false;
  for (const f of s.foes) {
    if (f.mode === 'dive' || f.mode === 'beam') divers += 1;
    if (f.mode === 'beam') beaming = true;
  }
  const maxDivers = Math.min(1 + Math.floor(s.wave / 3), 5);
  const speed = 170 + Math.min(s.wave, MAX_WAVE) * 6;

  s.diveTimer -= dt;
  if (!s.challenge && s.diveTimer <= 0 && divers < maxDivers) {
    s.diveTimer = Math.max(0.6, 2.4 - s.wave * 0.06) * rng.range(0.6, 1.3);
    const inForm = s.foes.filter((f) => f.mode === 'form');
    const allEntered = !s.foes.some((f) => f.mode === 'wait' || f.mode === 'enter');
    if (allEntered && inForm.length > 0) {
      const f = rng.pick(inForm);
      f.t = 0;
      f.x0 = f.x;
      f.y0 = f.y;
      f.x1 = p.x;
      f.dir = f.x < W / 2 ? 1 : -1;
      f.cd = rng.range(0.4, 1);
      const tractor = f.kind === 0 && !f.captive && !beaming && !p.dual && p.alive && s.wave > 1 && rng.next() < 0.45;
      f.mode = tractor ? 'beam' : 'dive';
      f.beamT = 0;
    }
  }

  for (const f of s.foes) {
    if (f.mode === 'wait') {
      f.delay -= dt;
      if (f.delay <= 0) f.mode = 'enter';
      continue;
    }
    if (f.mode === 'enter') {
      f.t += dt / (s.challenge ? 2.6 : 2);
      if (!s.challenge) {
        const sp = slotPos(s, f.slot);
        f.x1 = sp.x;
        f.y1 = sp.y;
      }
      bezier(f, Math.min(1, f.t));
      if (f.t >= 1) {
        if (s.challenge) f.mode = 'wait', f.delay = 1e9, f.x = -200;
        else f.mode = 'form';
      }
    } else if (f.mode === 'form') {
      const sp = slotPos(s, f.slot);
      f.x = sp.x;
      f.y = sp.y;
    } else if (f.mode === 'dive') {
      f.t += dt;
      f.y = f.y0 + f.t * speed;
      f.x = f.x0 + (f.x1 - f.x0) * Math.min(1, f.t * 0.5) + f.dir * 60 * Math.sin(f.t * 3);
      f.cd -= dt;
      if (f.cd <= 0 && f.y < PLAYER_Y - 110 && p.alive) {
        f.cd = rng.range(0.8, 1.6);
        s.bombs.push({ x: f.x, y: f.y + 12, vx: Math.max(-120, Math.min(120, (p.x - f.x) * 0.5)), vy: 220 + s.wave * 5 });
      }
      if (f.y > H + 30) {
        f.y = -30;
        f.mode = 'return';
      }
    } else if (f.mode === 'beam') {
      if (f.beamT === 0) {
        f.x = toward(f.x, p.x, 120 * dt);
        f.y = toward(f.y, BEAM_Y, speed * dt);
        if (f.y === BEAM_Y) f.beamT = 2.6;
      } else {
        f.beamT -= dt;
        if (p.alive && Math.abs(p.x - f.x) < 44 && p.invuln <= 0) {
          f.captive = true;
          burst(s.sparks, rng, p.x, PLAYER_Y, COLORS.coral, 20);
          emit('die');
          p.alive = false;
          s.lives -= 1;
          s.respawn = 2;
          if (s.lives <= 0) s.over = true;
          f.beamT = -1;
        }
        if (f.beamT <= 0) f.mode = 'return';
      }
    } else if (f.mode === 'return') {
      const sp = slotPos(s, f.slot);
      f.x = toward(f.x, sp.x, 240 * dt);
      f.y = toward(f.y, sp.y, 240 * dt);
      if (f.x === sp.x && f.y === sp.y) f.mode = 'form';
    }
  }

  // Player shots.
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.y -= SHOT_SPEED * dt;
    let spent = sh.y < 10;
    if (!spent) {
      for (let k = 0; k < s.foes.length; k++) {
        const f = s.foes[k]!;
        if (f.mode === 'wait' || Math.abs(sh.x - f.x) > 16 || Math.abs(sh.y - f.y) > 14) continue;
        spent = true;
        f.hp -= 1;
        if (f.hp > 0) {
          burst(s.sparks, rng, f.x, f.y, COLORS.paper, 5);
          emit('explode');
          break;
        }
        const flying = f.mode === 'dive' || f.mode === 'beam' || f.mode === 'return' || f.mode === 'enter';
        if (s.challenge) {
          s.score += 100;
          s.challengeHits += 1;
        } else {
          s.score += flying ? DIVE_POINTS[f.kind]! : FORM_POINTS[f.kind]!;
        }
        if (f.captive) {
          s.dualPending = true;
          s.score += 1000;
        }
        burst(s.sparks, rng, f.x, f.y, KIND_COLORS[f.kind]!, 14);
        emit('explode');
        s.foes.splice(k, 1);
        break;
      }
    }
    if (spent) s.shots.splice(i, 1);
  }

  // Bombs.
  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const b = s.bombs[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let remove = b.y > H || b.x < -20 || b.x > W + 20;
    const reach = p.dual ? 34 : 18;
    if (!remove && p.alive && Math.abs(b.x - p.x) < reach && Math.abs(b.y - PLAYER_Y) < 14) {
      remove = true;
      killPlayer(s, rng, emit);
    }
    if (remove) s.bombs.splice(i, 1);
  }

  // Ramming.
  for (let k = s.foes.length - 1; k >= 0; k--) {
    const f = s.foes[k]!;
    if (f.mode !== 'dive' && f.mode !== 'return') continue;
    if (p.alive && Math.abs(f.x - p.x) < (p.dual ? 40 : 24) && Math.abs(f.y - PLAYER_Y) < 20) {
      burst(s.sparks, rng, f.x, f.y, KIND_COLORS[f.kind]!, 12);
      if (f.captive) s.dualPending = true;
      s.score += DIVE_POINTS[f.kind]!;
      s.foes.splice(k, 1);
      killPlayer(s, rng, emit);
    }
  }

  stepSparks(s.sparks, dt);

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }

  // Challenge ships that flew past leave without a trace.
  if (s.challenge) s.foes = s.foes.filter((f) => !(f.mode === 'wait' && f.delay > 1e8));

  if (!s.over && s.foes.length === 0) {
    if (s.waveDelay <= 0) {
      s.waveDelay = 1.8;
      if (s.challenge) {
        const perfect = s.challengeHits === s.challengeTotal;
        if (perfect) s.score += 10000;
        s.note = perfect ? 'PERFECT +10000' : `HITS ${s.challengeHits}/${s.challengeTotal}`;
        s.noteTimer = 1.8;
      }
    }
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave += 1;
      startWave(s);
      emit('wave');
    }
  }

  if (s.score > s.hi) s.hi = s.score;
}

function drawShip(g: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x - 14, y, 28, 9);
  g.fillRect(x - 5, y - 8, 10, 10);
  g.fillRect(x - 2, y - 15, 4, 9);
}

function drawFoe(g: CanvasRenderingContext2D, f: Foe, flap: boolean): void {
  const color = f.kind === 0 && f.hp < 2 ? COLORS.purple : KIND_COLORS[f.kind]!;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(f.x, f.y, f.kind === 0 ? 13 : 10, 9, 0, 0, TAU);
  g.fill();
  const wing = flap ? 5 : -1;
  g.fillRect(f.x - 20, f.y - 6 + wing, 9, 5);
  g.fillRect(f.x + 11, f.y - 6 + wing, 9, 5);
  g.fillStyle = COLORS.bg;
  g.fillRect(f.x - 6, f.y - 3, 4, 4);
  g.fillRect(f.x + 2, f.y - 3, 4, 4);
  if (f.captive) drawShip(g, f.x, f.y - 24, COLORS.coral);
}

function render(s: HiveState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = COLORS.paper;
  g.globalAlpha = 0.5;
  for (const st of s.stars) g.fillRect(st.x, st.y, st.s, st.s);
  g.globalAlpha = 1;

  const flap = Math.floor(time * 4) % 2 === 0;
  for (const f of s.foes) {
    if (f.mode === 'wait') continue;
    if (f.mode === 'beam' && f.beamT > 0) {
      g.fillStyle = COLORS.cyan;
      g.globalAlpha = 0.25 + 0.15 * Math.sin(time * 30);
      g.beginPath();
      g.moveTo(f.x - 10, f.y + 10);
      g.lineTo(f.x + 10, f.y + 10);
      g.lineTo(f.x + 48, PLAYER_Y + 14);
      g.lineTo(f.x - 48, PLAYER_Y + 14);
      g.fill();
      g.globalAlpha = 1;
    }
    drawFoe(g, f, flap);
  }

  if (s.player.alive && (s.player.invuln <= 0 || Math.floor(time * 12) % 2 === 0)) {
    if (s.player.dual) {
      drawShip(g, s.player.x - 15, PLAYER_Y, COLORS.cyan);
      drawShip(g, s.player.x + 15, PLAYER_Y, COLORS.cyan);
    } else {
      drawShip(g, s.player.x, PLAYER_Y, COLORS.cyan);
    }
  }

  g.fillStyle = COLORS.gold;
  for (const sh of s.shots) g.fillRect(sh.x - 2, sh.y - 8, 4, 14);
  g.fillStyle = COLORS.coral;
  for (const b of s.bombs) g.fillRect(b.x - 2, b.y - 6, 5, 12);
  drawSparks(g, s.sparks);

  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);

  hud(g, s, s.challenge ? 'CHALLENGE' : `WAVE ${s.wave}`, s.lives);
  if (s.noteTimer > 0 && !s.over) {
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = COLORS.cyan;
    g.font = '22px "Press Start 2P", monospace';
    g.fillText(s.note, W / 2, H / 2 - 30);
  }
  gameOver(g, s.over);
}

const hiveStrike: GameDefinition<HiveState> = {
  id: 'hive-strike',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};

export default hiveStrike;
