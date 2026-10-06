import type { GameDefinition, GameStatus, Input, Rng, UpdateContext } from '@arcade/engine';

const W = 800;
const H = 570;
const TAU = Math.PI * 2;
const COLORS = { bg: '#120a2a', paper: '#F6EFFF', gold: '#FFC93C', coral: '#FF5D73', cyan: '#4FE3D6', purple: '#A78BFA', muted: '#B7A9DB' };
const GROUND = H - 40;
const CITY_COUNT = 6;
const AMMO_PER_WAVE = 10;
const MAX_WAVE = 30;
const BLAST_RADIUS = 46;
const BLAST_TIME = 1.1;
const EXTRA_CITY_EVERY = 10000;

interface Missile { sx: number; sy: number; x: number; y: number; tx: number; ty: number; speed: number }
interface Interceptor { x: number; y: number; tx: number; ty: number }
interface Blast { x: number; y: number; t: number }

export interface ShieldState {
  cities: boolean[];
  cursor: { x: number; y: number };
  missiles: Missile[];
  interceptors: Interceptor[];
  blasts: Blast[];
  /** Missiles still to launch this wave. */
  toLaunch: number;
  launchTimer: number;
  ammo: number;
  score: number;
  hi: number;
  wave: number;
  over: boolean;
  waveDelay: number;
  nextBonus: number;
  stars: { x: number; y: number }[];
}

const cityX = (i: number) => 90 + i * ((W - 180) / (CITY_COUNT - 1));

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): ShieldState {
  return {
    cities: Array.from({ length: CITY_COUNT }, () => true),
    cursor: { x: W / 2, y: H / 2 },
    missiles: [],
    interceptors: [],
    blasts: [],
    toLaunch: 8,
    launchTimer: 1,
    ammo: AMMO_PER_WAVE,
    score: 0,
    hi: hiScore,
    wave: 1,
    over: false,
    waveDelay: 0,
    nextBonus: EXTRA_CITY_EVERY,
    stars: Array.from({ length: 60 }, () => ({ x: rng.range(0, W), y: rng.range(0, GROUND) })),
  };
}

const citiesLeft = (s: ShieldState) => s.cities.filter(Boolean).length;

function update(s: ShieldState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;

  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

  const c = s.cursor;
  const speed = 360 * dt;
  if (input.held.left) c.x -= speed;
  if (input.held.right) c.x += speed;
  if (input.held.up) c.y -= speed;
  if (input.held.down) c.y += speed;
  c.x = Math.min(W, Math.max(0, c.x));
  c.y = Math.min(GROUND - 20, Math.max(40, c.y));

  if (input.pressed.a && s.ammo > 0) {
    s.ammo -= 1;
    s.interceptors.push({ x: W / 2, y: GROUND, tx: c.x, ty: c.y });
    emit('fire');
  }

  // Launch incoming missiles at random live cities.
  if (s.toLaunch > 0) {
    s.launchTimer -= dt;
    if (s.launchTimer <= 0) {
      s.launchTimer = Math.max(0.35, 1.6 - s.wave * 0.06) * rng.range(0.5, 1.2);
      const targets: number[] = [];
      s.cities.forEach((a, i) => a && targets.push(i));
      const x = rng.range(20, W - 20);
      s.missiles.push({ sx: x, sy: 0, x, y: 0, tx: cityX(rng.pick(targets)), ty: GROUND, speed: 38 + Math.min(s.wave, MAX_WAVE) * 3 });
      s.toLaunch -= 1;
    }
  }

  for (let i = s.interceptors.length - 1; i >= 0; i--) {
    const it = s.interceptors[i]!;
    const dx = it.tx - it.x;
    const dy = it.ty - it.y;
    const d = Math.hypot(dx, dy);
    const step = 520 * dt;
    if (d <= step) {
      s.blasts.push({ x: it.tx, y: it.ty, t: 0 });
      s.interceptors.splice(i, 1);
      emit('explode');
    } else {
      it.x += (dx / d) * step;
      it.y += (dy / d) * step;
    }
  }

  for (let i = s.blasts.length - 1; i >= 0; i--) {
    const b = s.blasts[i]!;
    b.t += dt;
    if (b.t >= BLAST_TIME) s.blasts.splice(i, 1);
  }
  const radius = (b: Blast) => BLAST_RADIUS * Math.sin(Math.min(1, b.t / BLAST_TIME) * Math.PI);

  for (let i = s.missiles.length - 1; i >= 0; i--) {
    const m = s.missiles[i]!;
    const dx = m.tx - m.sx;
    const dy = m.ty - m.sy;
    const d = Math.hypot(dx, dy);
    m.x += (dx / d) * m.speed * dt;
    m.y += (dy / d) * m.speed * dt;
    if (s.blasts.some((b) => Math.hypot(b.x - m.x, b.y - m.y) < radius(b))) {
      s.score += 25;
      s.blasts.push({ x: m.x, y: m.y, t: 0 });
      s.missiles.splice(i, 1);
      emit('explode');
    } else if (m.y >= GROUND) {
      const idx = s.cities.findIndex((a, k) => a && Math.abs(cityX(k) - m.tx) < 1);
      if (idx >= 0) s.cities[idx] = false;
      s.blasts.push({ x: m.x, y: GROUND, t: 0 });
      s.missiles.splice(i, 1);
      emit('die');
    }
  }

  if (citiesLeft(s) === 0) s.over = true;

  if (s.score >= s.nextBonus) {
    const lost = s.cities.indexOf(false);
    if (lost >= 0) s.cities[lost] = true;
    s.nextBonus += EXTRA_CITY_EVERY;
    emit('pickup');
  }

  if (!s.over && s.toLaunch === 0 && s.missiles.length === 0 && s.interceptors.length === 0) {
    if (s.waveDelay <= 0) {
      s.waveDelay = 1.5;
      s.score += citiesLeft(s) * 100 + s.ammo * 5;
    }
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave = Math.min(s.wave + 1, MAX_WAVE);
      s.toLaunch = Math.min(8 + s.wave * 2, 30);
      s.ammo = AMMO_PER_WAVE;
      s.blasts = [];
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: ShieldState, g: CanvasRenderingContext2D): void {
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = COLORS.paper;
  g.globalAlpha = 0.5;
  for (const st of s.stars) g.fillRect(st.x, st.y, 2, 2);
  g.globalAlpha = 1;

  g.fillStyle = COLORS.purple;
  g.fillRect(0, GROUND, W, H - GROUND);
  // Battery.
  g.fillStyle = COLORS.gold;
  g.beginPath();
  g.moveTo(W / 2 - 34, GROUND);
  g.lineTo(W / 2 - 14, GROUND - 22);
  g.lineTo(W / 2 + 14, GROUND - 22);
  g.lineTo(W / 2 + 34, GROUND);
  g.fill();

  s.cities.forEach((alive, i) => {
    const x = cityX(i);
    g.fillStyle = alive ? COLORS.cyan : COLORS.muted;
    if (alive) {
      g.fillRect(x - 22, GROUND - 14, 12, 14);
      g.fillRect(x - 8, GROUND - 28, 14, 28);
      g.fillRect(x + 8, GROUND - 18, 14, 18);
    } else {
      g.fillRect(x - 20, GROUND - 4, 40, 4);
    }
  });

  g.strokeStyle = COLORS.coral;
  g.lineWidth = 2;
  for (const m of s.missiles) {
    g.beginPath();
    g.moveTo(m.sx, m.sy);
    g.lineTo(m.x, m.y);
    g.stroke();
  }
  g.strokeStyle = COLORS.gold;
  for (const it of s.interceptors) {
    g.beginPath();
    g.moveTo(W / 2, GROUND - 22);
    g.lineTo(it.x, it.y);
    g.stroke();
  }
  for (const b of s.blasts) {
    const r = BLAST_RADIUS * Math.sin(Math.min(1, b.t / BLAST_TIME) * Math.PI);
    g.fillStyle = Math.floor(b.t * 20) % 2 ? COLORS.gold : COLORS.coral;
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(b.x, b.y, Math.max(0, r), 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;

  g.strokeStyle = COLORS.paper;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(s.cursor.x - 10, s.cursor.y);
  g.lineTo(s.cursor.x + 10, s.cursor.y);
  g.moveTo(s.cursor.x, s.cursor.y - 10);
  g.lineTo(s.cursor.x, s.cursor.y + 10);
  g.stroke();

  g.font = '14px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.fillStyle = COLORS.paper;
  g.fillText(`1UP  ${String(Math.min(s.score, 999999)).padStart(6, '0')}`, 22, 14);
  g.textAlign = 'right';
  g.fillStyle = COLORS.gold;
  g.fillText(`HI ${String(Math.min(Math.max(s.hi, s.score), 999999)).padStart(6, '0')}`, W - 22, 14);
  g.textAlign = 'left';
  g.fillStyle = COLORS.muted;
  g.fillText(`WAVE ${s.wave}  AMMO ${s.ammo}`, 22, H - 28);

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

function status(s: ShieldState): GameStatus {
  return { score: s.score, hiScore: Math.max(s.hi, s.score), lives: citiesLeft(s), level: s.wave, over: s.over };
}

const skyShield: GameDefinition<ShieldState> = { id: 'sky-shield', size: { width: W, height: H }, init, update, render, status };
export default skyShield;
