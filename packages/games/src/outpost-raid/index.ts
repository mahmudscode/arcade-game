import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const WORLD = 2400;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const POD_RING = 40;
const POD_R = 12;
const CORE_R = 15;
const SHIP_R = 8;
const SPEED = 175;
const POD_RANGE = 320;
const POINTS = { pod: 200, core: 1500, fighter: 100, mine: 50 } as const;

interface Base {
  x: number;
  y: number;
  core: boolean;
  pods: boolean[];
  cd: number[];
}
interface Fighter {
  x: number;
  y: number;
  a: number;
  cd: number;
}
interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  mine: boolean;
}
interface Mine {
  x: number;
  y: number;
}

export interface OutpostState {
  me: { x: number; y: number; a: number; alive: boolean; invuln: number; cooldown: number };
  bases: Base[];
  fighters: Fighter[];
  shots: Shot[];
  mines: Mine[];
  sparks: Spark[];
  stars: { x: number; y: number; s: number }[];
  round: number;
  spawnTimer: number;
  respawn: number;
  clearDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  over: boolean;
}

const wrap = (v: number) => ((v % WORLD) + WORLD) % WORLD;
/** Shortest signed distance on the wrapping world. */
const wd = (d: number) => ((((d + WORLD / 2) % WORLD) + WORLD) % WORLD) - WORLD / 2;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(wd(ax - bx), wd(ay - by));
const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const podPos = (b: Base, k: number) => ({ x: b.x + Math.cos((k * TAU) / 6) * POD_RING, y: b.y + Math.sin((k * TAU) / 6) * POD_RING });

function buildWorld(s: OutpostState, rng: Rng): void {
  s.bases = [];
  s.mines = [];
  s.fighters = [];
  s.shots = [];
  const count = Math.min(4 + Math.floor(s.round / 2), 6);
  for (let tries = 0; s.bases.length < count && tries < 300; tries++) {
    const x = rng.range(0, WORLD);
    const y = rng.range(0, WORLD);
    if (dist(x, y, s.me.x, s.me.y) < 450 || s.bases.some((b) => dist(b.x, b.y, x, y) < 600)) continue;
    s.bases.push({ x, y, core: true, pods: Array.from({ length: 6 }, () => true), cd: Array.from({ length: 6 }, () => rng.range(1.5, 5)) });
  }
  for (let tries = 0; s.mines.length < 22 && tries < 400; tries++) {
    const x = rng.range(0, WORLD);
    const y = rng.range(0, WORLD);
    if (dist(x, y, s.me.x, s.me.y) < 250 || s.bases.some((b) => dist(b.x, b.y, x, y) < 160)) continue;
    s.mines.push({ x, y });
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): OutpostState {
  const s: OutpostState = {
    me: { x: WORLD / 2, y: WORLD / 2, a: -Math.PI / 2, alive: true, invuln: 1.5, cooldown: 0 },
    bases: [],
    fighters: [],
    shots: [],
    mines: [],
    sparks: [],
    stars: Array.from({ length: 90 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), s: rng.pick([1, 1, 2]) })),
    round: 1,
    spawnTimer: 6,
    respawn: 0,
    clearDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    over: false,
  };
  buildWorld(s, rng);
  return s;
}

function killPlayer(s: OutpostState, rng: Rng, emit: UpdateContext['emit']): void {
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  burst(s.sparks, rng, s.me.x, s.me.y, COLORS.cyan, 24);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: OutpostState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  const me = s.me;
  const wasAlive = me.alive;
  if (me.alive) {
    me.invuln = Math.max(0, me.invuln - dt);
    me.cooldown -= dt;
    // 8-way steering: the ship keeps flying along its last heading.
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if (dx !== 0 || dy !== 0) me.a = Math.atan2(dy, dx);
    me.x = wrap(me.x + Math.cos(me.a) * SPEED * dt);
    me.y = wrap(me.y + Math.sin(me.a) * SPEED * dt);
    if (input.held.a && me.cooldown <= 0 && s.shots.filter((sh) => sh.mine).length <= 4) {
      me.cooldown = 0.22;
      // Fires ahead and astern at once.
      for (const dir of [1, -1]) s.shots.push({ x: me.x, y: me.y, vx: Math.cos(me.a) * 520 * dir, vy: Math.sin(me.a) * 520 * dir, life: 0.7, mine: true });
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) Object.assign(me, { alive: true, invuln: 2.5, cooldown: 0 });
  }

  // Base gun pods.
  for (const b of s.bases) {
    for (let k = 0; k < 6; k++) {
      b.cd[k]! -= dt;
      if (!b.pods[k] || !me.alive || b.cd[k]! > 0) continue;
      const p = podPos(b, k);
      const d = dist(p.x, p.y, me.x, me.y);
      if (d > POD_RANGE) continue;
      const a = Math.atan2(wd(me.y - p.y), wd(me.x - p.x));
      s.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 2, mine: false });
      b.cd[k] = rng.range(3.6, 6.4);
    }
  }

  // Fighters: spawn near the player and chase.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    s.spawnTimer = 4.5;
    if (me.alive && s.fighters.length < Math.min(1 + s.round, 5)) {
      const ang = rng.range(0, TAU);
      s.fighters.push({ x: wrap(me.x + Math.cos(ang) * 440), y: wrap(me.y + Math.sin(ang) * 440), a: ang + Math.PI, cd: rng.range(1.5, 3) });
    }
  }
  for (let i = s.fighters.length - 1; i >= 0; i--) {
    const f = s.fighters[i]!;
    const tx = wd(me.x - f.x);
    const ty = wd(me.y - f.y);
    const diff = norm(Math.atan2(ty, tx) - f.a);
    f.a += clamp(diff, -2.2 * dt, 2.2 * dt);
    const speed = 120 + s.round * 8;
    f.x = wrap(f.x + Math.cos(f.a) * speed * dt);
    f.y = wrap(f.y + Math.sin(f.a) * speed * dt);
    f.cd -= dt;
    if (me.alive && f.cd <= 0 && Math.abs(diff) < 0.2 && Math.hypot(tx, ty) < 300) {
      s.shots.push({ x: f.x, y: f.y, vx: Math.cos(f.a) * 220, vy: Math.sin(f.a) * 220, life: 2, mine: false });
      f.cd = rng.range(3.2, 5);
    }
    if (me.alive && me.invuln <= 0 && Math.hypot(tx, ty) < SHIP_R + 9) {
      killPlayer(s, rng, emit);
      burst(s.sparks, rng, f.x, f.y, COLORS.purple, 12);
      s.fighters.splice(i, 1);
    }
  }

  // Shots.
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.x = wrap(sh.x + sh.vx * dt);
    sh.y = wrap(sh.y + sh.vy * dt);
    sh.life -= dt;
    if (sh.life <= 0) {
      s.shots.splice(i, 1);
      continue;
    }
    if (sh.mine) {
      if (hitPlayerShot(s, sh, rng, emit)) s.shots.splice(i, 1);
    } else if (me.alive && me.invuln <= 0 && dist(sh.x, sh.y, me.x, me.y) < SHIP_R + 3) {
      s.shots.splice(i, 1);
      killPlayer(s, rng, emit);
    }
  }

  // Ship vs bases and mines.
  if (me.alive && me.invuln <= 0) {
    const hitBase = s.bases.some((b) => (b.core && dist(b.x, b.y, me.x, me.y) < CORE_R + SHIP_R) || b.pods.some((alive, k) => alive && dist(podPos(b, k).x, podPos(b, k).y, me.x, me.y) < POD_R + SHIP_R));
    const mineIdx = s.mines.findIndex((m) => dist(m.x, m.y, me.x, me.y) < SHIP_R + 9);
    if (hitBase || mineIdx >= 0) {
      if (mineIdx >= 0) {
        burst(s.sparks, rng, s.mines[mineIdx]!.x, s.mines[mineIdx]!.y, COLORS.gold, 10);
        s.mines.splice(mineIdx, 1);
      }
      killPlayer(s, rng, emit);
    }
  }

  // Enemy fire in flight is cleared once the ship is lost (after the loops, so indices stay valid).
  if (wasAlive && !me.alive) s.shots = s.shots.filter((sh) => sh.mine);

  // Round complete when every base core is gone.
  if (s.bases.every((b) => !b.core)) {
    s.clearDelay += dt;
    if (s.clearDelay >= 1.5) {
      s.clearDelay = 0;
      s.round += 1;
      s.score += 1000;
      buildWorld(s, rng);
      emit('wave');
    }
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  stepSparks(s.sparks, dt);
  if (s.score > s.hi) s.hi = s.score;
}

/** Resolves one player shot against everything it can hit; returns true if it was used up. */
function hitPlayerShot(s: OutpostState, sh: Shot, rng: Rng, emit: UpdateContext['emit']): boolean {
  for (const b of s.bases) {
    for (let k = 0; k < 6; k++) {
      const p = podPos(b, k);
      if (b.pods[k] && dist(p.x, p.y, sh.x, sh.y) < POD_R) {
        b.pods[k] = false;
        s.score += POINTS.pod;
        burst(s.sparks, rng, p.x, p.y, COLORS.coral, 10);
        emit('explode');
        return true;
      }
    }
    if (b.core && dist(b.x, b.y, sh.x, sh.y) < CORE_R) {
      b.core = false;
      b.pods = b.pods.map(() => false);
      s.score += POINTS.core;
      burst(s.sparks, rng, b.x, b.y, COLORS.gold, 36);
      emit('explode');
      return true;
    }
  }
  const f = s.fighters.findIndex((e) => dist(e.x, e.y, sh.x, sh.y) < 12);
  if (f >= 0) {
    burst(s.sparks, rng, s.fighters[f]!.x, s.fighters[f]!.y, COLORS.purple, 12);
    s.fighters.splice(f, 1);
    s.score += POINTS.fighter;
    emit('explode');
    return true;
  }
  const m = s.mines.findIndex((e) => dist(e.x, e.y, sh.x, sh.y) < 11);
  if (m >= 0) {
    burst(s.sparks, rng, s.mines[m]!.x, s.mines[m]!.y, COLORS.gold, 8);
    s.mines.splice(m, 1);
    s.score += POINTS.mine;
    emit('pickup');
    return true;
  }
  return false;
}

function render(s: OutpostState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const cx = s.me.x;
  const cy = s.me.y;
  const sx = (x: number) => W / 2 + wd(x - cx);
  const sy = (y: number) => H / 2 + wd(y - cy);
  const visible = (x: number, y: number, m = 80) => Math.abs(wd(x - cx)) < W / 2 + m && Math.abs(wd(y - cy)) < H / 2 + m;

  g.fillStyle = COLORS.paper;
  for (const st of s.stars) {
    g.globalAlpha = st.s === 2 ? 0.7 : 0.4;
    g.fillRect((((st.x - cx * 0.4) % W) + W) % W, (((st.y - cy * 0.4) % H) + H) % H, st.s, st.s);
  }
  g.globalAlpha = 1;

  for (const b of s.bases) {
    if (!visible(b.x, b.y, 120)) continue;
    const bx = sx(b.x);
    const by = sy(b.y);
    g.strokeStyle = COLORS.muted;
    g.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const p = podPos(b, k);
      if (!b.pods[k]) continue;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(sx(p.x), sy(p.y));
      g.stroke();
      g.fillStyle = COLORS.coral;
      g.beginPath();
      g.arc(sx(p.x), sy(p.y), POD_R, 0, TAU);
      g.fill();
      g.fillStyle = COLORS.bg;
      g.fillRect(sx(p.x) - 3, sy(p.y) - 3, 6, 6);
    }
    if (b.core) {
      g.fillStyle = Math.floor(time * 4) % 2 ? COLORS.gold : COLORS.paper;
      g.beginPath();
      g.moveTo(bx, by - CORE_R);
      g.lineTo(bx + CORE_R, by);
      g.lineTo(bx, by + CORE_R);
      g.lineTo(bx - CORE_R, by);
      g.closePath();
      g.fill();
    }
  }

  g.strokeStyle = COLORS.gold;
  g.lineWidth = 2;
  for (const m of s.mines) {
    if (!visible(m.x, m.y)) continue;
    const x = sx(m.x);
    const y = sy(m.y);
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 8 + time;
      g.moveTo(x - Math.cos(a) * 9, y - Math.sin(a) * 9);
      g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    }
    g.stroke();
  }

  for (const f of s.fighters) {
    if (!visible(f.x, f.y)) continue;
    arrow(g, sx(f.x), sy(f.y), f.a, 11, COLORS.purple);
  }
  for (const sh of s.shots) {
    if (!visible(sh.x, sh.y)) continue;
    g.fillStyle = sh.mine ? COLORS.gold : COLORS.coral;
    g.fillRect(sx(sh.x) - 2, sy(sh.y) - 2, 5, 5);
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) arrow(g, W / 2, H / 2, s.me.a, 12, COLORS.cyan);

  // Sparks live in world coordinates.
  for (const p of s.sparks) {
    if (!visible(p.x, p.y)) continue;
    g.globalAlpha = Math.max(0, p.life * 2);
    g.fillStyle = p.color;
    g.fillRect(sx(p.x), sy(p.y), 3, 3);
  }
  g.globalAlpha = 1;

  radar(s, g);
  hud(g, s, `ROUND ${s.round}`, s.lives);
  gameOver(g, s.over);
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, a: number, r: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  g.lineTo(x + Math.cos(a + 2.5) * r, y + Math.sin(a + 2.5) * r);
  g.lineTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
  g.lineTo(x + Math.cos(a - 2.5) * r, y + Math.sin(a - 2.5) * r);
  g.closePath();
  g.fill();
}

function radar(s: OutpostState, g: CanvasRenderingContext2D): void {
  const size = 104;
  const x0 = W - size - 20;
  const y0 = 40;
  const k = size / WORLD;
  g.fillStyle = 'rgba(18,10,42,0.8)';
  g.fillRect(x0, y0, size, size);
  g.strokeStyle = COLORS.muted;
  g.lineWidth = 1;
  g.strokeRect(x0 + 0.5, y0 + 0.5, size, size);
  for (const b of s.bases) {
    if (!b.core) continue;
    g.fillStyle = COLORS.coral;
    g.fillRect(x0 + b.x * k - 2, y0 + b.y * k - 2, 5, 5);
  }
  g.fillStyle = COLORS.purple;
  for (const f of s.fighters) g.fillRect(x0 + f.x * k - 1, y0 + f.y * k - 1, 3, 3);
  g.fillStyle = COLORS.cyan;
  g.fillRect(x0 + s.me.x * k - 2, y0 + s.me.y * k - 2, 5, 5);
}

const game: GameDefinition<OutpostState> = {
  id: 'outpost-raid',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.round),
};
export default game;
