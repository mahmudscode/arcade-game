import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { N, VOID, TW, TH, diamond, heightAt as heightOf, isoX, isoY, makeTrack, onTrack as onTrackOf } from '../_shared/iso-track';

const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const WALK = 4.4;
const HOP_V = 8.2;
const HOP_G = 26;
const NUT_SPEED = 3.6;
const BONUS_START = 3000;

interface Nut {
  /** Position along the path (cell index, fractional), rolling toward the start. */
  k: number;
  /** Which of the three lanes of the track it rolls in. */
  lane: number;
}
interface Monkey {
  x: number;
  y: number;
}

export interface CanopyState {
  h: number[];
  path: { x: number; y: number }[];
  me: { x: number; y: number; hop: number; hopV: number; alive: boolean; face: number; fall: number; invuln: number };
  nuts: Nut[];
  monkeys: Monkey[];
  nutTimer: number;
  bonus: number;
  bonusTimer: number;
  sparks: Spark[];
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

export const heightAt = (s: CanopyState, x: number, y: number) => heightOf(s.h, x, y);
export const onTrack = (s: CanopyState, x: number, y: number) => onTrackOf(s.h, x, y);

/** Direction (dx, dy) of the path segment around index k. */
function dirAt(path: { x: number; y: number }[], k: number): [number, number] {
  const a = path[Math.max(0, Math.min(path.length - 2, Math.floor(k)))]!;
  const b = path[Math.max(1, Math.min(path.length - 1, Math.floor(k) + 1))]!;
  return [b.x - a.x, b.y - a.y];
}

export function nutPos(s: CanopyState, n: Nut): { x: number; y: number } {
  const i = Math.max(0, Math.min(s.path.length - 1, Math.floor(n.k)));
  const j = Math.min(s.path.length - 1, i + 1);
  const t = n.k - i;
  const a = s.path[i]!;
  const b = s.path[j]!;
  const [dx, dy] = dirAt(s.path, n.k);
  // The lane runs sideways to the direction of travel.
  return { x: a.x + 0.5 + (b.x - a.x) * t + n.lane * 0.8 * dy, y: a.y + 0.5 + (b.y - a.y) * t + n.lane * 0.8 * dx };
}

function buildLevel(s: CanopyState, rng: Rng): void {
  const track = makeTrack(rng, s.level, true, 0);
  s.path = track.path;
  s.h = track.h;
  s.nuts = [];
  s.nutTimer = 2.5;
  s.bonus = BONUS_START;
  s.bonusTimer = 0;
  const start = s.path[0]!;
  Object.assign(s.me, { x: start.x + 0.5, y: start.y + 0.5, hop: 0, hopV: 0, alive: true, face: 1, fall: 0, invuln: 1.5 });
  s.monkeys = [];
  const monkeys = Math.min(1 + Math.floor(s.level / 2), 3);
  for (let m = 0; m < monkeys; m++) {
    const c = s.path[Math.floor(s.path.length * (0.35 + m * 0.2))]!;
    s.monkeys.push({ x: c.x + 0.5, y: c.y + 0.5 });
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): CanopyState {
  const s: CanopyState = {
    h: [],
    path: [],
    me: { x: 3.5, y: 3.5, hop: 0, hopV: 0, alive: true, face: 1, fall: 0, invuln: 1.5 },
    nuts: [],
    monkeys: [],
    nutTimer: 2.5,
    bonus: BONUS_START,
    bonusTimer: 0,
    sparks: [],
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

function loseLife(s: CanopyState, rng: Rng, emit: UpdateContext['emit']): void {
  void rng;
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.5;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: CanopyState, input: Input, dt: number, ctx: UpdateContext): void {
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
      buildLevel(s, rng);
      emit('wave');
    }
    return;
  }
  const me = s.me;

  if (!me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      const start = s.path[0]!;
      Object.assign(me, { x: start.x + 0.5, y: start.y + 0.5, hop: 0, hopV: 0, alive: true, fall: 0, invuln: 2.2 });
      s.nuts = [];
    }
  } else if (me.fall > 0) {
    // Off the cliff: a short fall into the water, then a life is gone.
    me.fall += dt;
    if (me.fall >= 0.8) loseLife(s, rng, emit);
  } else {
    me.invuln = Math.max(0, me.invuln - dt);
    // Screen directions in the isometric view: up = (-1,-1), right = (+1,-1), down = (+1,+1), left = (-1,+1).
    const sx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const sy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    const vx = (sx + sy) * 0.7071;
    const vy = (sy - sx) * 0.7071;
    if (sx !== 0 || sy !== 0) me.face = sx !== 0 ? sx : me.face;
    me.x += vx * WALK * dt;
    me.y += vy * WALK * dt;
    if (!onTrackOf(s.h, me.x, me.y)) me.fall = 0.001;

    // Hop (A / Up-arrow-less jump): a short leap that clears rolling coconuts.
    if (me.hop === 0 && me.hopV === 0 && (input.pressed.a || input.pressed.b)) {
      me.hopV = HOP_V;
      emit('fire');
    }
    if (me.hopV !== 0 || me.hop > 0) {
      me.hop += me.hopV * dt;
      me.hopV -= HOP_G * dt;
      if (me.hop <= 0) {
        me.hop = 0;
        me.hopV = 0;
      }
    }
  }

  // The ape rolls coconuts down the path.
  s.nutTimer -= dt;
  if (s.nutTimer <= 0 && me.alive) {
    s.nutTimer = Math.max(1.1, 2.7 - s.level * 0.2) + rng.range(0, 0.8);
    s.nuts.push({ k: s.path.length - 1, lane: rng.int(-1, 1) });
    emit('fire');
  }
  for (let i = s.nuts.length - 1; i >= 0; i--) {
    const n = s.nuts[i]!;
    n.k -= (NUT_SPEED + Math.min(s.level, 8) * 0.25) * dt;
    if (n.k <= 0) {
      s.nuts.splice(i, 1);
      continue;
    }
    if (me.alive && me.fall === 0 && me.invuln <= 0) {
      const p = nutPos(s, n);
      if (Math.hypot(p.x - me.x, p.y - me.y) < 0.6 && me.hop < 0.55) {
        s.nuts.splice(i, 1);
        loseLife(s, rng, emit);
        if (s.over) return;
      }
    }
  }

  // Monkeys chase along the track.
  for (const m of s.monkeys) {
    if (!me.alive) break;
    const dx = me.x - m.x;
    const dy = me.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = m.x + (dx / d) * (1.6 + Math.min(s.level, 6) * 0.15) * dt;
    const ny = m.y + (dy / d) * (1.6 + Math.min(s.level, 6) * 0.15) * dt;
    if (onTrackOf(s.h, nx, ny)) {
      m.x = nx;
      m.y = ny;
    } else if (onTrackOf(s.h, nx, m.y)) m.x = nx;
    else if (onTrackOf(s.h, m.x, ny)) m.y = ny;
    if (me.fall === 0 && me.invuln <= 0 && Math.hypot(m.x - me.x, m.y - me.y) < 0.6 && me.hop < 0.55) {
      loseLife(s, rng, emit);
      if (s.over) return;
    }
  }

  // Progress counts toward the score; the top of the path is the ape's ledge.
  s.bonusTimer += dt;
  if (s.bonusTimer >= 1) {
    s.bonusTimer -= 1;
    s.bonus = Math.max(0, s.bonus - 50);
  }
  if (me.alive && me.fall === 0) {
    const last = s.path[s.path.length - 1]!;
    if (Math.hypot(me.x - (last.x + 0.5), me.y - (last.y + 0.5)) < 1.4) {
      s.score += s.bonus + 1000;
      s.levelDelay = 1.8;
      emit('wave');
    }
  }
  if (me.alive && s.bonus === 0) loseLife(s, rng, emit);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: CanopyState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const me = s.me;
  const cx = Math.min(Math.max(me.x, 0.5), N - 0.5);
  const cy = Math.min(Math.max(me.y, 0.5), N - 0.5);
  const mz = Math.max(heightOf(s.h, cx, cy), 0);
  const ox = W / 2 - isoX(me.x, me.y);
  const oy = H / 2 + 60 - isoY(me.x, me.y, mz);
  const x0 = Math.max(0, Math.floor(me.x) - 11);
  const x1 = Math.min(N - 1, Math.floor(me.x) + 11);
  const y0 = Math.max(0, Math.floor(me.y) - 11);
  const y1 = Math.min(N - 1, Math.floor(me.y) + 11);
  const lastCell = s.path[s.path.length - 1]!;
  const items: { sum: number; draw: () => void }[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const hh = s.h[ty * N + tx]!;
      if (hh <= VOID / 2) continue;
      items.push({
        sum: tx + ty,
        draw: () => {
          const px = ox + isoX(tx + 0.5, ty + 0.5);
          const py = oy + isoY(tx + 0.5, ty + 0.5, hh);
          g.fillStyle = '#3d2c14';
          g.beginPath();
          g.moveTo(px - TW / 2, py);
          g.lineTo(px, py + TH / 2);
          g.lineTo(px, py + TH / 2 + 18);
          g.lineTo(px - TW / 2, py + 18);
          g.fill();
          g.fillStyle = '#5a4020';
          g.beginPath();
          g.moveTo(px + TW / 2, py);
          g.lineTo(px, py + TH / 2);
          g.lineTo(px, py + TH / 2 + 18);
          g.lineTo(px + TW / 2, py + 18);
          g.fill();
          const top = Math.abs(lastCell.x - tx) <= 1 && Math.abs(lastCell.y - ty) <= 1;
          diamond(g, px, py, top ? '#7a9a3a' : (tx + ty) % 2 === 0 ? '#4fa05a' : '#468f50');
        },
      });
    }
  }
  items.sort((a, b) => a.sum - b.sum);
  for (const it of items) it.draw();

  const sprite = (x: number, y: number, z: number, color: string, r: number) => {
    const sx = ox + isoX(x, y);
    const sy = oy + isoY(x, y, z);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(sx, oy + isoY(x, y, Math.max(0, heightOf(s.h, Math.min(Math.max(x, 0.5), N - 0.5), Math.min(Math.max(y, 0.5), N - 0.5)))) + 6, r, r / 2, 0, 0, TAU);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.arc(sx, sy - 6, r, 0, TAU);
    g.fill();
  };
  // The ape sits on the top ledge.
  sprite(lastCell.x + 0.5, lastCell.y + 0.5, heightOf(s.h, lastCell.x + 0.5, lastCell.y + 0.5) + 0.4, '#6b4a2f', 18);
  for (const n of s.nuts) {
    const p = nutPos(s, n);
    sprite(p.x, p.y, heightOf(s.h, p.x, p.y) + 0.2, '#9b5a3c', 8);
  }
  for (const m of s.monkeys) sprite(m.x, m.y, heightOf(s.h, m.x, m.y) + 0.3, COLORS.coral, 9);
  if (me.alive && (me.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
    const base = heightOf(s.h, cx, cy);
    sprite(me.x, me.y, (base <= VOID / 2 ? 0 : base) + me.hop - me.fall * me.fall * 6 + 0.3, COLORS.cyan, 10);
  }
  drawSparks(g, s.sparks);
  g.fillStyle = COLORS.muted;
  g.fillRect(W / 2 - 120, 40, 240, 8);
  g.fillStyle = COLORS.gold;
  const prog = s.path.reduce((best, c, i) => (Math.hypot(c.x + 0.5 - me.x, c.y + 0.5 - me.y) < Math.hypot(s.path[best]!.x + 0.5 - me.x, s.path[best]!.y + 0.5 - me.y) ? i : best), 0);
  g.fillRect(W / 2 - 120, 40, (240 * prog) / Math.max(1, s.path.length - 1), 8);
  hud(g, s, `STAGE ${s.level}  BONUS ${s.bonus}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'SUMMIT REACHED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<CanopyState> = {
  id: 'canopy-climb',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
