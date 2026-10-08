import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, TAU, W, type Spark } from '../_shared';

const CX = W / 2;
const CY = H / 2;
const RING = 215;
const TURN_SPEED = 2.6;
const SHOT_SPEED = 520;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_WAVE = 30;
const TWIN_TIME = 12;
const KIND_COLORS = [COLORS.coral, COLORS.gold, COLORS.purple, COLORS.cyan];
const KIND_POINTS = [100, 150, 200, 500];

type Mode = 'wait' | 'spiral' | 'hold' | 'rush';

interface Foe {
  kind: number;
  mode: Mode;
  t: number;
  delay: number;
  /** Polar position around the centre; rush mode switches to x/y velocity. */
  a: number;
  r: number;
  hr: number;
  dir: 1 | -1;
  hold: number;
  cd: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RingState {
  foes: Foe[];
  player: { a: number; alive: boolean; invuln: number; twin: number };
  shots: { a: number; r: number }[];
  fireCd: number;
  bullets: Bullet[];
  sparks: Spark[];
  stars: { a: number; r: number }[];
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  respawn: number;
  waveDelay: number;
  nextLife: number;
  note: string;
  noteTimer: number;
}

const playerPos = (a: number) => ({ x: CX + Math.cos(a) * RING, y: CY + Math.sin(a) * RING });

function startWave(s: RingState, rng: Rng): void {
  s.foes = [];
  s.bullets = [];
  s.shots = [];
  const spin = rng.pick<1 | -1>([1, -1]);
  for (let g = 0; g < 4; g++) {
    const dir = ((g % 2 === 0 ? spin : -spin) as 1 | -1);
    const base = rng.range(0, TAU);
    for (let k = 0; k < 6; k++) {
      // The last ship of the second group carries the twin-shot pod.
      const pod = g === 1 && k === 5;
      const kind = pod ? 3 : g === 3 ? 2 : g === 2 ? 1 : 0;
      s.foes.push({
        kind,
        mode: 'wait',
        t: 0,
        delay: g * 2.4 + k * 0.28,
        a: base,
        r: 10,
        hr: 55 + (k % 3) * 22,
        dir,
        hold: rng.range(6, 10) / (1 + s.wave * 0.04),
        cd: rng.range(1, 3),
        x: CX,
        y: CY,
        vx: 0,
        vy: 0,
      });
    }
  }
  s.note = `WAVE ${s.wave}`;
  s.noteTimer = 1.6;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): RingState {
  const s: RingState = {
    foes: [],
    player: { a: Math.PI / 2, alive: true, invuln: 0, twin: 0 },
    shots: [],
    fireCd: 0,
    bullets: [],
    sparks: [],
    stars: Array.from({ length: 80 }, () => ({ a: rng.range(0, TAU), r: rng.range(5, 420) })),
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    respawn: 0,
    waveDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    note: '',
    noteTimer: 0,
  };
  startWave(s, rng);
  return s;
}

function killPlayer(s: RingState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = s.player;
  if (!p.alive || p.invuln > 0) return;
  const pos = playerPos(p.a);
  burst(s.sparks, rng, pos.x, pos.y, COLORS.cyan, 26);
  emit('die');
  p.alive = false;
  p.twin = 0;
  s.lives -= 1;
  s.respawn = 1.5;
  if (s.lives <= 0) s.over = true;
}

function update(s: RingState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;

  for (const st of s.stars) {
    st.r += (20 + st.r * 0.8) * dt;
    if (st.r > 420) {
      st.r = rng.range(4, 30);
      st.a = rng.range(0, TAU);
    }
  }

  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  const p = s.player;
  s.noteTimer = Math.max(0, s.noteTimer - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.twin = Math.max(0, p.twin - dt);
  s.fireCd = Math.max(0, s.fireCd - dt);

  if (p.alive) {
    if (input.held.left) p.a -= TURN_SPEED * dt;
    if (input.held.right) p.a += TURN_SPEED * dt;
    p.a = ((p.a % TAU) + TAU) % TAU;
    if ((input.pressed.a || input.held.a) && s.fireCd <= 0 && s.shots.length < 8) {
      s.fireCd = 0.15;
      if (p.twin > 0) s.shots.push({ a: p.a - 0.07, r: RING }, { a: p.a + 0.07, r: RING });
      else s.shots.push({ a: p.a, r: RING });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      p.alive = true;
      p.invuln = 1.5;
    }
  }

  const ppos = playerPos(p.a);
  const bulletSpeed = 170 + Math.min(s.wave, MAX_WAVE) * 6;

  for (const f of s.foes) {
    if (f.mode === 'wait') {
      f.delay -= dt;
      if (f.delay <= 0) f.mode = 'spiral';
      continue;
    }
    if (f.mode === 'spiral') {
      f.t += dt / 3;
      const u = Math.min(1, f.t);
      f.r = 10 + (f.hr - 10) * u + 120 * Math.sin(Math.PI * u);
      f.a += f.dir * (2.4 - 1.8 * u) * dt;
      if (f.t >= 1) f.mode = 'hold';
    } else if (f.mode === 'hold') {
      f.a += f.dir * 0.5 * dt;
      f.hold -= dt;
      f.cd -= dt;
      const fx = CX + Math.cos(f.a) * f.r;
      const fy = CY + Math.sin(f.a) * f.r;
      if (f.cd <= 0 && p.alive) {
        f.cd = Math.max(0.9, 2.8 - s.wave * 0.08) * rng.range(0.7, 1.4);
        const d = Math.hypot(ppos.x - fx, ppos.y - fy) || 1;
        s.bullets.push({ x: fx, y: fy, vx: ((ppos.x - fx) / d) * bulletSpeed, vy: ((ppos.y - fy) / d) * bulletSpeed });
      }
      if (f.hold <= 0) {
        const d = Math.hypot(ppos.x - fx, ppos.y - fy) || 1;
        f.mode = 'rush';
        f.x = fx;
        f.y = fy;
        f.vx = ((ppos.x - fx) / d) * (200 + s.wave * 6);
        f.vy = ((ppos.y - fy) / d) * (200 + s.wave * 6);
      }
    } else {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (Math.abs(f.x - CX) > W / 2 + 60 || Math.abs(f.y - CY) > H / 2 + 60) {
        // Left the arena: dive back in from the centre.
        f.mode = 'spiral';
        f.t = 0;
        f.r = 10;
        f.hold = rng.range(6, 10) / (1 + s.wave * 0.04);
      }
    }
  }

  // Player shots fly toward the centre.
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.r -= SHOT_SPEED * dt;
    let spent = sh.r < 6;
    if (!spent) {
      const sx = CX + Math.cos(sh.a) * sh.r;
      const sy = CY + Math.sin(sh.a) * sh.r;
      for (let k = 0; k < s.foes.length; k++) {
        const f = s.foes[k]!;
        if (f.mode === 'wait') continue;
        const fx = f.mode === 'rush' ? f.x : CX + Math.cos(f.a) * f.r;
        const fy = f.mode === 'rush' ? f.y : CY + Math.sin(f.a) * f.r;
        if (Math.abs(sx - fx) > 15 || Math.abs(sy - fy) > 15) continue;
        s.score += KIND_POINTS[f.kind]!;
        if (f.kind === 3) {
          p.twin = TWIN_TIME;
          s.note = 'TWIN SHOT';
          s.noteTimer = 1.4;
          emit('pickup');
        }
        burst(s.sparks, rng, fx, fy, KIND_COLORS[f.kind]!, 12);
        emit('explode');
        s.foes.splice(k, 1);
        spent = true;
        break;
      }
    }
    if (spent) s.shots.splice(i, 1);
  }

  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let remove = Math.abs(b.x - CX) > W / 2 + 20 || Math.abs(b.y - CY) > H / 2 + 20;
    if (!remove && p.alive && Math.hypot(b.x - ppos.x, b.y - ppos.y) < 14) {
      remove = true;
      killPlayer(s, rng, emit);
    }
    if (remove) s.bullets.splice(i, 1);
  }

  for (let k = s.foes.length - 1; k >= 0; k--) {
    const f = s.foes[k]!;
    if (f.mode !== 'rush' || !p.alive) continue;
    if (Math.hypot(f.x - ppos.x, f.y - ppos.y) < 20) {
      burst(s.sparks, rng, f.x, f.y, KIND_COLORS[f.kind]!, 12);
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

  if (!s.over && s.foes.length === 0) {
    if (s.waveDelay <= 0) s.waveDelay = 1.8;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave += 1;
      startWave(s, rng);
      emit('wave');
    }
  }

  if (s.score > s.hi) s.hi = s.score;
}

function foePos(f: Foe): { x: number; y: number } {
  return f.mode === 'rush' ? { x: f.x, y: f.y } : { x: CX + Math.cos(f.a) * f.r, y: CY + Math.sin(f.a) * f.r };
}

function render(s: RingState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);

  g.fillStyle = COLORS.paper;
  for (const st of s.stars) {
    const size = st.r > 250 ? 3 : st.r > 120 ? 2 : 1;
    g.globalAlpha = Math.min(0.7, st.r / 200);
    g.fillRect(CX + Math.cos(st.a) * st.r, CY + Math.sin(st.a) * st.r, size, size);
  }
  g.globalAlpha = 1;

  g.strokeStyle = COLORS.muted;
  g.globalAlpha = 0.18;
  g.lineWidth = 1;
  g.beginPath();
  g.arc(CX, CY, RING, 0, TAU);
  g.stroke();
  g.globalAlpha = 1;

  const flap = Math.floor(time * 5) % 2 === 0;
  for (const f of s.foes) {
    if (f.mode === 'wait') continue;
    const { x, y } = foePos(f);
    g.fillStyle = KIND_COLORS[f.kind]!;
    g.beginPath();
    g.ellipse(x, y, 11, 8, 0, 0, TAU);
    g.fill();
    g.fillRect(x - 17, y - 5 + (flap ? 4 : 0), 7, 4);
    g.fillRect(x + 10, y - 5 + (flap ? 4 : 0), 7, 4);
    g.fillStyle = COLORS.bg;
    g.fillRect(x - 5, y - 2, 3, 3);
    g.fillRect(x + 2, y - 2, 3, 3);
    if (f.kind === 3) {
      g.strokeStyle = COLORS.paper;
      g.beginPath();
      g.arc(x, y, 14, 0, TAU);
      g.stroke();
    }
  }

  g.fillStyle = COLORS.gold;
  for (const sh of s.shots) {
    g.fillRect(CX + Math.cos(sh.a) * sh.r - 2, CY + Math.sin(sh.a) * sh.r - 2, 5, 5);
  }
  g.fillStyle = COLORS.coral;
  for (const b of s.bullets) g.fillRect(b.x - 3, b.y - 3, 6, 6);

  const p = s.player;
  if (p.alive && (p.invuln <= 0 || Math.floor(time * 12) % 2 === 0)) {
    const pos = playerPos(p.a);
    g.save();
    g.translate(pos.x, pos.y);
    g.rotate(p.a - Math.PI / 2);
    g.fillStyle = COLORS.cyan;
    g.beginPath();
    g.moveTo(0, -16);
    g.lineTo(13, 12);
    g.lineTo(0, 6);
    g.lineTo(-13, 12);
    g.closePath();
    g.fill();
    if (p.twin > 0) {
      g.fillStyle = COLORS.gold;
      g.fillRect(-19, 2, 5, 10);
      g.fillRect(14, 2, 5, 10);
    }
    g.restore();
  }

  drawSparks(g, s.sparks);

  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);

  hud(g, s, `WAVE ${s.wave}`, s.lives);
  if (s.noteTimer > 0 && !s.over) {
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = COLORS.cyan;
    g.font = '22px "Press Start 2P", monospace';
    g.fillText(s.note, CX, CY - 12);
  }
  gameOver(g, s.over);
}

const ringRunner: GameDefinition<RingState> = {
  id: 'ring-runner',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};

export default ringRunner;
