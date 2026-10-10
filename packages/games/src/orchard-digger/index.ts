import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { DIRS, heldDir, isReverse, newWalker, reverseWalker, stepWalker, walkerPos, type Walker } from '../_shared/walker';

const COLS = 17;
const ROWS = 13;
const CELL = 32;
const OX = (W - COLS * CELL) / 2;
const OY = 62;
const START = { x: 8, y: 11 };
const DEN = { x: 8, y: 6 };
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const BALL_SPEED = 11;
const FALL_SPEED = 9;
const DIRT = 1;

interface Apple {
  x: number;
  y: number;
  /** rest | wobble (about to fall) | fall */
  mode: 'rest' | 'wobble' | 'fall';
  t: number;
  p: number;
  fallen: number;
  kills: number;
}
interface Grub extends Walker {
  digger: boolean;
}

export interface OrchardState {
  /** 1 dirt, 0 open tunnel. */
  dirt: number[];
  cherries: { x: number; y: number }[];
  apples: Apple[];
  me: Walker & { fx: number; fy: number; alive: boolean; invuln: number; pushCd: number };
  grubs: Grub[];
  ball: { x: number; y: number; dx: number; dy: number; life: number };
  ballCd: number;
  sparks: Spark[];
  /** Grubs still to come out of the den this level. */
  quota: number;
  spawnTimer: number;
  levelTime: number;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const open = (s: OrchardState, x: number, y: number) => inside(x, y) && s.dirt[idx(x, y)] === 0;
const appleAt = (s: OrchardState, x: number, y: number) => s.apples.find((a) => a.x === x && a.y === y);
const cap = (level: number) => Math.min(2 + Math.ceil(level / 2), 5);

function buildLevel(s: OrchardState, rng: Rng): void {
  s.dirt = Array.from({ length: COLS * ROWS }, () => DIRT);
  const carve = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) s.dirt[idx(x, y)] = 0;
  };
  carve(6, 10, DEN.y);
  carve(7, 9, START.y);
  s.cherries = [];
  s.apples = [];
  const spots = (n: number, ok: (x: number, y: number) => boolean) => {
    const out: { x: number; y: number }[] = [];
    for (let tries = 0; out.length < n && tries < 500; tries++) {
      const x = rng.int(1, COLS - 3);
      const y = rng.int(1, ROWS - 3);
      if (ok(x, y) && !out.some((o) => Math.abs(o.x - x) < 3 && Math.abs(o.y - y) < 3)) out.push({ x, y });
    }
    return out;
  };
  const clear2 = (x: number, y: number) => ![DEN, START].some((p) => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 3);
  for (const c of spots(6, clear2)) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) s.cherries.push({ x: c.x + dx, y: c.y + dy });
  for (const a of spots(5, (x, y) => clear2(x, y) && !s.cherries.some((c) => Math.abs(c.x - x) < 2 && Math.abs(c.y - y) < 2))) {
    // An apple sits in its own pocket with solid dirt beneath.
    s.dirt[idx(a.x, a.y)] = 0;
    s.apples.push({ x: a.x, y: a.y, mode: 'rest', t: 0, p: 0, fallen: 0, kills: 0 });
  }
  s.grubs = [];
  s.quota = Math.min(6 + s.level, 14);
  s.spawnTimer = 2;
  s.levelTime = 0;
  s.ball = { x: 0, y: 0, dx: 0, dy: 0, life: 0 };
  s.ballCd = 0;
  Object.assign(s.me, newWalker(START.x, START.y), { fx: 0, fy: -1, alive: true, invuln: 1.5, pushCd: 0 });
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): OrchardState {
  const s: OrchardState = {
    dirt: [],
    cherries: [],
    apples: [],
    me: { ...newWalker(START.x, START.y), fx: 0, fy: -1, alive: true, invuln: 1.5, pushCd: 0 },
    grubs: [],
    ball: { x: 0, y: 0, dx: 0, dy: 0, life: 0 },
    ballCd: 0,
    sparks: [],
    quota: 0,
    spawnTimer: 0,
    levelTime: 0,
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

const px = (x: number) => OX + x * CELL + CELL / 2;
const py = (y: number) => OY + y * CELL + CELL / 2;

function killPlayer(s: OrchardState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = walkerPos(s.me);
  burst(s.sparks, rng, px(p.x), py(p.y), COLORS.coral, 22);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** Shortest open-tunnel step toward the target, or null if unreachable. */
function stepToward(s: OrchardState, fx: number, fy: number, tx: number, ty: number): readonly [number, number] | null {
  const dist = new Array<number>(COLS * ROWS).fill(-1);
  const q = [idx(tx, ty)];
  dist[q[0]!] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!;
    for (const [dx, dy] of DIRS) {
      const nx = (c % COLS) + dx;
      const ny = Math.floor(c / COLS) + dy;
      if (!open(s, nx, ny) || appleAt(s, nx, ny) || dist[idx(nx, ny)] !== -1) continue;
      dist[idx(nx, ny)] = dist[c]! + 1;
      q.push(idx(nx, ny));
    }
  }
  let best: readonly [number, number] | null = null;
  let bestD = Infinity;
  for (const d of DIRS) {
    const dd = inside(fx + d[0], fy + d[1]) ? dist[idx(fx + d[0], fy + d[1])]! : -1;
    if (dd >= 0 && dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

function update(s: OrchardState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  stepSparks(s.sparks, dt);

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      buildLevel(s, rng);
      emit('wave');
    }
    return;
  }

  const me = s.me;
  s.levelTime += dt;
  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      Object.assign(me, newWalker(START.x, START.y), { alive: true, invuln: 2.2, pushCd: 0 });
      s.dirt[idx(START.x, START.y)] = 0;
      s.grubs = s.grubs.filter((g) => Math.hypot(g.tx - START.x, g.ty - START.y) > 5);
    }
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    me.pushCd = Math.max(0, me.pushCd - dt);
    const want = heldDir(input.held);
    if (want) {
      me.fx = want[0];
      me.fy = want[1];
      if (me.dx === -want[0] && me.dy === -want[1]) reverseWalker(me);
    }
    stepWalker(
      me,
      4.6,
      dt,
      () => {
        if (!want) return null;
        const nx = me.tx + want[0];
        const ny = me.ty + want[1];
        const a = appleAt(s, nx, ny);
        if (a) {
          // Apples can be shoved sideways into open tunnel.
          if (want[1] === 0 && me.pushCd <= 0 && a.mode !== 'fall' && open(s, nx + want[0], ny) && !appleAt(s, nx + want[0], ny)) {
            a.x += want[0];
            a.mode = 'rest';
            me.pushCd = 0.2;
            emit('pickup');
          }
          return null;
        }
        return want;
      },
      (x, y, dx, dy) => inside(x + dx, y + dy) && !appleAt(s, x + dx, y + dy),
      (w) => {
        s.dirt[idx(w.tx, w.ty)] = 0; // digging
        const c = s.cherries.findIndex((ch) => ch.x === w.tx && ch.y === w.ty);
        if (c >= 0) {
          s.cherries.splice(c, 1);
          s.score += 50;
          emit('pickup');
        }
      },
    );

    // Power ball: one at a time, bounces off dirt and apples.
    s.ballCd = Math.max(0, s.ballCd - dt);
    if ((input.pressed.a || input.pressed.b) && s.ball.life <= 0 && s.ballCd <= 0 && (me.fx !== 0 || me.fy !== 0)) {
      const mp = walkerPos(me);
      s.ball = { x: mp.x, y: mp.y, dx: me.fx, dy: me.fy, life: 2.4 };
      s.ballCd = 3;
      emit('fire');
    }
  }

  if (s.ball.life > 0) {
    const b = s.ball;
    b.life -= dt;
    const step = BALL_SPEED * dt;
    const nx = b.x + b.dx * step;
    const ny = b.y + b.dy * step;
    const cx = Math.round(nx + b.dx * 0.5);
    const cy = Math.round(ny + b.dy * 0.5);
    if (!open(s, cx, cy) || appleAt(s, cx, cy)) {
      b.dx = 0 - b.dx;
      b.dy = 0 - b.dy;
    } else {
      b.x = nx;
      b.y = ny;
    }
    const hit = s.grubs.findIndex((g) => {
      const gp = walkerPos(g);
      return Math.hypot(gp.x - b.x, gp.y - b.y) < 0.7;
    });
    if (hit >= 0) {
      const gp = walkerPos(s.grubs[hit]!);
      burst(s.sparks, rng, px(gp.x), py(gp.y), COLORS.gold, 12);
      s.grubs.splice(hit, 1);
      s.score += 500;
      b.life = 0;
      emit('explode');
    }
  }

  // Apples: wobble, fall, crush.
  for (let i = s.apples.length - 1; i >= 0; i--) {
    const a = s.apples[i]!;
    if (a.mode === 'rest') {
      if (open(s, a.x, a.y + 1) && !appleAt(s, a.x, a.y + 1)) {
        a.mode = 'wobble';
        a.t = 0.6;
      }
    } else if (a.mode === 'wobble') {
      a.t -= dt;
      if (!open(s, a.x, a.y + 1)) a.mode = 'rest';
      else if (a.t <= 0) {
        a.mode = 'fall';
        a.p = 0;
        a.fallen = 0;
      }
    } else {
      a.p += FALL_SPEED * dt;
      while (a.p >= 1 && a.mode === 'fall') {
        a.p -= 1;
        a.y += 1;
        a.fallen += 1;
        if (!(open(s, a.x, a.y + 1) && !appleAt(s, a.x, a.y + 1))) {
          a.mode = 'rest';
          a.p = 0;
          if (a.fallen >= 2) {
            burst(s.sparks, rng, px(a.x), py(a.y), COLORS.coral, 12);
            s.apples.splice(i, 1);
          }
        }
      }
      const ax = a.x;
      const ay = a.y + (s.apples[i] === a ? a.p : 0);
      for (let k = s.grubs.length - 1; k >= 0; k--) {
        const gp = walkerPos(s.grubs[k]!);
        if (Math.abs(gp.x - ax) < 0.7 && Math.abs(gp.y - ay) < 0.8) {
          s.score += 1000 * 2 ** Math.min(a.kills, 3);
          a.kills += 1;
          burst(s.sparks, rng, px(gp.x), py(gp.y), COLORS.gold, 14);
          s.grubs.splice(k, 1);
          emit('explode');
        }
      }
      const mp = walkerPos(me);
      if (me.alive && me.invuln <= 0 && Math.abs(mp.x - ax) < 0.7 && Math.abs(mp.y - ay) < 0.8) killPlayer(s, rng, emit);
    }
  }

  // Grubs.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.quota > 0 && s.grubs.length < cap(s.level) && me.alive) {
    s.spawnTimer = 4.5;
    s.quota -= 1;
    s.grubs.push({ ...newWalker(DEN.x, DEN.y), digger: false });
  }
  // After a while one grub learns to dig straight through the dirt.
  if (s.levelTime > 16 && s.grubs.length > 0 && !s.grubs.some((g) => g.digger)) s.grubs[0]!.digger = true;
  for (const g of s.grubs) {
    const canGo = (x: number, y: number, dx: number, dy: number) => inside(x + dx, y + dy) && !appleAt(s, x + dx, y + dy) && (g.digger || open(s, x + dx, y + dy));
    stepWalker(
      g,
      2.1 + Math.min(s.level, 10) * 0.12,
      dt,
      (w) => {
        const opts = DIRS.filter(([dx, dy]) => canGo(w.tx, w.ty, dx, dy));
        if (opts.length === 0) return null;
        if (g.digger || rng.next() > 0.12) {
          if (g.digger) return opts.reduce((a, b) => (Math.abs(w.tx + a[0] - me.tx) + Math.abs(w.ty + a[1] - me.ty) <= Math.abs(w.tx + b[0] - me.tx) + Math.abs(w.ty + b[1] - me.ty) ? a : b));
          const d = stepToward(s, w.tx, w.ty, me.tx, me.ty);
          if (d) return d;
        }
        const ahead = opts.filter(([dx, dy]) => !isReverse(w, dx, dy));
        return rng.pick(ahead.length > 0 ? ahead : opts);
      },
      canGo,
      (w) => {
        if (g.digger) s.dirt[idx(w.tx, w.ty)] = 0;
      },
    );
  }

  if (me.alive && me.invuln <= 0) {
    const mp = walkerPos(me);
    if (s.grubs.some((g) => {
      const gp = walkerPos(g);
      return Math.hypot(gp.x - mp.x, gp.y - mp.y) < 0.6;
    })) killPlayer(s, rng, emit);
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  const done = s.cherries.length === 0 || (s.quota === 0 && s.grubs.length === 0);
  if (done && me.alive && s.levelDelay <= 0) {
    s.score += 500;
    s.levelDelay = 1.6;
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: OrchardState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      g.fillStyle = s.dirt[idx(x, y)] === DIRT ? '#6b4a2f' : '#120a2a';
      g.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
      if (s.dirt[idx(x, y)] === DIRT && (x + y) % 3 === 0) {
        g.fillStyle = '#7d5a3c';
        g.fillRect(OX + x * CELL + 8, OY + y * CELL + 8, 6, 5);
      }
    }
  }
  for (const c of s.cherries) {
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.arc(px(c.x) - 4, py(c.y) + 3, 5, 0, TAU);
    g.arc(px(c.x) + 5, py(c.y) + 3, 5, 0, TAU);
    g.fill();
    g.strokeStyle = '#7BE495';
    g.beginPath();
    g.moveTo(px(c.x) - 4, py(c.y) - 2);
    g.lineTo(px(c.x), py(c.y) - 9);
    g.lineTo(px(c.x) + 5, py(c.y) - 2);
    g.stroke();
  }
  for (const a of s.apples) {
    const wob = a.mode === 'wobble' ? Math.sin(time * 40) * 2 : 0;
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.arc(px(a.x) + wob, py(a.y + (a.mode === 'fall' ? a.p : 0)), 13, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(px(a.x) - 6 + wob, py(a.y + (a.mode === 'fall' ? a.p : 0)) - 8, 5, 4);
  }
  for (const gr of s.grubs) {
    const p = walkerPos(gr);
    g.fillStyle = gr.digger ? COLORS.coral : COLORS.purple;
    g.beginPath();
    g.ellipse(px(p.x), py(p.y), 12, 10, 0, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(px(p.x) - 6, py(p.y) - 4, 4, 4);
    g.fillRect(px(p.x) + 2, py(p.y) - 4, 4, 4);
  }
  if (s.ball.life > 0) {
    g.fillStyle = COLORS.cyan;
    g.beginPath();
    g.arc(px(s.ball.x), py(s.ball.y), 6, 0, TAU);
    g.fill();
  }
  if (s.me.alive && (s.me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    const p = walkerPos(s.me);
    g.fillStyle = COLORS.paper;
    g.beginPath();
    g.arc(px(p.x), py(p.y), 12, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.coral;
    g.fillRect(px(p.x) - 8, py(p.y) - 15, 16, 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(p.x) - 5 + s.me.fx * 3, py(p.y) - 3 + s.me.fy * 3, 3, 4);
    g.fillRect(px(p.x) + 2 + s.me.fx * 3, py(p.y) - 3 + s.me.fy * 3, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  CHERRIES ${s.cherries.length}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'LEVEL CLEARED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<OrchardState> = {
  id: 'orchard-digger',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
