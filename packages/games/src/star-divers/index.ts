import type { GameDefinition, GameStatus, Input, Rng, UpdateContext } from '@arcade/engine';

const W = 800;
const H = 570;
const TAU = Math.PI * 2;
const COLORS = { bg: '#120a2a', paper: '#F6EFFF', gold: '#FFC93C', coral: '#FF5D73', cyan: '#4FE3D6', purple: '#A78BFA', muted: '#B7A9DB' };
const ROW_COLORS = [COLORS.purple, COLORS.coral, COLORS.gold, COLORS.cyan];
const ROW_POINTS = [60, 40, 30, 20];
const COLS = 9;
const ROWS = 4;
const GAP_X = 52;
const GAP_Y = 42;
const PLAYER_Y = H - 56;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_WAVE = 30;

interface Diver {
  /** Index into the formation this ship came from. */
  slot: number;
  t: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
}
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

export interface DiverState {
  alive: boolean[];
  sway: number;
  divers: Diver[];
  diveTimer: number;
  player: { x: number; alive: boolean };
  shots: { x: number; y: number }[];
  bombs: { x: number; y: number }[];
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

const slotX = (s: DiverState, i: number) => W / 2 + (((i % COLS) - (COLS - 1) / 2) * GAP_X) + Math.sin(s.sway) * 60;
const slotY = (i: number) => 80 + Math.floor(i / COLS) * GAP_Y;

function burst(s: DiverState, rng: Rng, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU);
    const v = rng.range(40, 200);
    s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rng.range(0.3, 0.6), color });
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): DiverState {
  return {
    alive: Array.from({ length: COLS * ROWS }, () => true),
    sway: 0,
    divers: [],
    diveTimer: 2,
    player: { x: W / 2, alive: true },
    shots: [],
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
}

function killPlayer(s: DiverState, rng: Rng, emit: UpdateContext['emit']): void {
  s.player.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  burst(s, rng, s.player.x, PLAYER_Y, COLORS.cyan, 26);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: DiverState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;

  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s, dt);
    return;
  }

  s.sway += dt * 0.9;

  if (s.player.alive) {
    if (input.held.left) s.player.x -= 320 * dt;
    if (input.held.right) s.player.x += 320 * dt;
    s.player.x = Math.min(W - 24, Math.max(24, s.player.x));
    if (input.pressed.a && s.shots.length < 2) {
      s.shots.push({ x: s.player.x, y: PLAYER_Y - 14 });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.player.alive = true;
      s.player.x = W / 2;
    }
  }

  // Launch a diver from a random live ship that is not already diving.
  s.diveTimer -= dt;
  if (s.diveTimer <= 0) {
    s.diveTimer = Math.max(0.5, 2.2 - s.wave * 0.1) * rng.range(0.6, 1.2);
    const free: number[] = [];
    s.alive.forEach((a, i) => {
      if (a && !s.divers.some((d) => d.slot === i)) free.push(i);
    });
    if (free.length > 0 && s.divers.length < 2 + Math.floor(s.wave / 3)) {
      const slot = rng.pick(free);
      const x = slotX(s, slot);
      s.divers.push({ slot, t: 0, x0: x, y0: slotY(slot), x, y: slotY(slot), dir: x < s.player.x ? 1 : -1, speed: 170 + s.wave * 6 });
    }
  }

  for (let i = s.divers.length - 1; i >= 0; i--) {
    const d = s.divers[i]!;
    d.t += dt;
    d.y = d.y0 + d.t * d.speed;
    d.x = d.x0 + Math.sin(d.t * 3.2) * 90 * d.dir + (s.player.x - d.x0) * Math.min(1, d.t / 3) * 0.5;
    if (rng.next() < dt * 0.6) s.bombs.push({ x: d.x, y: d.y + 10 });
    if (d.y > H + 20) {
      // Re-enter the formation from the top.
      d.t = 0;
      d.y0 = -20;
      d.x0 = slotX(s, d.slot);
      d.speed = 0;
      s.divers.splice(i, 1);
      continue;
    }
    if (s.player.alive && Math.abs(d.x - s.player.x) < 22 && Math.abs(d.y - PLAYER_Y) < 18) {
      s.alive[d.slot] = false;
      s.divers.splice(i, 1);
      burst(s, rng, d.x, d.y, COLORS.coral, 12);
      killPlayer(s, rng, emit);
    }
  }

  for (let i = s.shots.length - 1; i >= 0; i--) {
    const shot = s.shots[i]!;
    shot.y -= 600 * dt;
    let spent = shot.y < 10;
    for (let k = s.divers.length - 1; k >= 0 && !spent; k--) {
      const d = s.divers[k]!;
      if (Math.abs(shot.x - d.x) < 18 && Math.abs(shot.y - d.y) < 16) {
        s.alive[d.slot] = false;
        s.score += ROW_POINTS[Math.floor(d.slot / COLS)]! * 2;
        burst(s, rng, d.x, d.y, ROW_COLORS[Math.floor(d.slot / COLS)]!, 12);
        emit('explode');
        s.divers.splice(k, 1);
        spent = true;
      }
    }
    for (let k = 0; k < s.alive.length && !spent; k++) {
      if (!s.alive[k] || s.divers.some((d) => d.slot === k)) continue;
      if (Math.abs(shot.x - slotX(s, k)) < 18 && Math.abs(shot.y - slotY(k)) < 16) {
        s.alive[k] = false;
        s.score += ROW_POINTS[Math.floor(k / COLS)]!;
        burst(s, rng, slotX(s, k), slotY(k), ROW_COLORS[Math.floor(k / COLS)]!, 10);
        emit('explode');
        spent = true;
      }
    }
    if (spent) s.shots.splice(i, 1);
  }

  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const b = s.bombs[i]!;
    b.y += 230 * dt;
    if (b.y > H) s.bombs.splice(i, 1);
    else if (s.player.alive && Math.abs(b.x - s.player.x) < 16 && Math.abs(b.y - PLAYER_Y) < 14) {
      s.bombs.splice(i, 1);
      killPlayer(s, rng, emit);
    }
  }

  stepSparks(s, dt);

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }

  if (!s.over && !s.alive.some(Boolean)) {
    if (s.waveDelay <= 0) s.waveDelay = 1.4;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave = Math.min(s.wave + 1, MAX_WAVE);
      s.alive = Array.from({ length: COLS * ROWS }, () => true);
      s.divers = [];
      s.bombs = [];
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function stepSparks(s: DiverState, dt: number): void {
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i]!;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) s.sparks.splice(i, 1);
  }
}

function drawShip(g: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + 12);
  g.lineTo(x - 16, y - 8);
  g.lineTo(x - 6, y - 3);
  g.lineTo(x, y - 10);
  g.lineTo(x + 6, y - 3);
  g.lineTo(x + 16, y - 8);
  g.closePath();
  g.fill();
}

function render(s: DiverState, g: CanvasRenderingContext2D): void {
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = COLORS.paper;
  g.globalAlpha = 0.5;
  for (const st of s.stars) g.fillRect(st.x, st.y, st.s, st.s);
  g.globalAlpha = 1;

  s.alive.forEach((a, i) => {
    if (a && !s.divers.some((d) => d.slot === i)) drawShip(g, slotX(s, i), slotY(i), ROW_COLORS[Math.floor(i / COLS)]!);
  });
  for (const d of s.divers) drawShip(g, d.x, d.y, ROW_COLORS[Math.floor(d.slot / COLS)]!);

  if (s.player.alive) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(s.player.x - 18, PLAYER_Y, 36, 10);
    g.fillRect(s.player.x - 4, PLAYER_Y - 14, 8, 16);
  }
  g.fillStyle = COLORS.gold;
  for (const sh of s.shots) g.fillRect(sh.x - 2, sh.y - 8, 4, 14);
  g.fillStyle = COLORS.coral;
  for (const b of s.bombs) g.fillRect(b.x - 2, b.y - 6, 5, 12);
  for (const p of s.sparks) {
    g.globalAlpha = Math.max(0, p.life * 2);
    g.fillStyle = p.color;
    g.fillRect(p.x, p.y, 3, 3);
  }
  g.globalAlpha = 1;

  g.font = '14px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.fillStyle = COLORS.paper;
  g.fillText(`1UP  ${pad(s.score)}`, 22, 14);
  g.textAlign = 'right';
  g.fillStyle = COLORS.gold;
  g.fillText(`HI ${pad(Math.max(s.hi, s.score))}`, W - 22, 14);
  g.textAlign = 'left';
  g.fillStyle = COLORS.muted;
  g.fillText(`WAVE ${s.wave}`, 22, H - 30);
  g.fillStyle = COLORS.cyan;
  for (let i = 0; i < Math.max(0, s.lives); i++) g.fillRect(W - 40 - i * 22, H - 30, 14, 12);
  gameOver(s.over, g);
}

function pad(n: number): string {
  return String(Math.min(n, 999999)).padStart(6, '0');
}

function gameOver(over: boolean, g: CanvasRenderingContext2D): void {
  if (!over) return;
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

function status(s: DiverState): GameStatus {
  return { score: s.score, hiScore: Math.max(s.hi, s.score), lives: Math.max(0, s.lives), level: s.wave, over: s.over };
}

const starDivers: GameDefinition<DiverState> = { id: 'star-divers', size: { width: W, height: H }, init, update, render, status };
export default starDivers;
