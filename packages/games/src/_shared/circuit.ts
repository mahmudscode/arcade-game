import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * Top-down circuit racer archetype (RT, single screen). A closed loop with a few rivals; slide round
 * the bends, dodge oil, collect wrenches that raise your top speed, and finish in the places to qualify.
 */
export interface CircuitConfig {
  id: string;
  laps: number;
  rivals: number;
  /** How many places qualify for the next race. */
  qualify: number;
  colors: { grass: string; track: string; edge: string; car: string };
}

const M = 48;
const HALF = 46;
const START_LIVES = 3;
const R_CAR = 10;
const COUNTDOWN = 3;
const GRACE = 14;
const EXTRA_LIFE_EVERY = 30000;

interface Pt {
  x: number;
  y: number;
}
interface Car {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  /** Next waypoint to reach. */
  wp: number;
  lap: number;
  /** Finishing place (1-based), 0 while racing. */
  fin: number;
  slip: number;
  skill: number;
  color: number;
}
interface Spot extends Pt {
  taken: boolean;
}

export interface CircuitState {
  track: Pt[];
  cars: Car[];
  oil: Spot[];
  wrenches: Spot[];
  upgrades: number;
  countdown: number;
  grace: number;
  /** After the race ends: seconds of results, and the player's place. */
  endDelay: number;
  place: number;
  qualified: boolean;
  sparks: Spark[];
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const CAR_COLORS = [COLORS.coral, COLORS.gold, COLORS.purple, '#7BE495'];

function distSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function onTrack(track: Pt[], p: Pt, half = HALF): boolean {
  for (let i = 0; i < track.length; i++) if (distSeg(p, track[i]!, track[(i + 1) % track.length]!) < half) return true;
  return false;
}

export function createCircuit(cfg: CircuitConfig): GameDefinition<CircuitState> {
  function makeTrack(rng: Rng): Pt[] {
    const p1 = rng.range(0, 6.28);
    const p2 = rng.range(0, 6.28);
    const a1 = rng.range(10, 26);
    const a2 = rng.range(8, 22);
    const pts: Pt[] = [];
    for (let k = 0; k < M; k++) {
      const th = (k / M) * Math.PI * 2;
      const r = 180 + a1 * Math.sin(2 * th + p1) + a2 * Math.sin(3 * th + p2);
      pts.push({ x: 400 + r * 1.45 * Math.cos(th), y: 305 + r * 0.98 * Math.sin(th) });
    }
    return pts;
  }

  function buildRace(s: CircuitState, rng: Rng): void {
    s.track = makeTrack(rng);
    const t0 = s.track[0]!;
    const t1 = s.track[1]!;
    const ang = Math.atan2(t1.y - t0.y, t1.x - t0.x);
    s.cars = [];
    for (let k = 0; k <= cfg.rivals; k++) {
      const back = 16 + k * 26;
      const side = k % 2 === 0 ? -14 : 14;
      s.cars.push({
        x: t0.x - Math.cos(ang) * back - Math.sin(ang) * side,
        y: t0.y - Math.sin(ang) * back + Math.cos(ang) * side,
        a: ang,
        vx: 0,
        vy: 0,
        wp: 1,
        lap: 0,
        fin: 0,
        slip: 0,
        skill: k === 0 ? 1 : 0.9 + rng.next() * 0.12 + Math.min(s.level, 12) * 0.04,
        color: k,
      });
    }
    s.oil = [];
    s.wrenches = [];
    for (let k = 0; k < 4; k++) {
      const c = s.track[rng.int(4, M - 4)]!;
      s.oil.push({ x: c.x + rng.range(-24, 24), y: c.y + rng.range(-24, 24), taken: false });
    }
    for (let k = 0; k < 3; k++) {
      const c = s.track[rng.int(4, M - 4)]!;
      s.wrenches.push({ x: c.x + rng.range(-18, 18), y: c.y + rng.range(-18, 18), taken: false });
    }
    s.countdown = COUNTDOWN;
    s.grace = 0;
    s.endDelay = 0;
    s.place = 0;
    s.qualified = false;
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): CircuitState {
    const s: CircuitState = { track: [], cars: [], oil: [], wrenches: [], upgrades: 0, countdown: 0, grace: 0, endDelay: 0, place: 0, qualified: false, sparks: [], nextLife: EXTRA_LIFE_EVERY, score: 0, hi: hiScore, lives: START_LIVES, level: 1, over: false };
    buildRace(s, rng);
    return s;
  }

  const progress = (s: CircuitState, c: Car): number => {
    const prev = s.track[(c.wp + M - 1) % M]!;
    const next = s.track[c.wp]!;
    const seg = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    return c.lap * M + (c.wp === 0 ? M : c.wp) - Math.min(1, Math.hypot(next.x - c.x, next.y - c.y) / seg);
  };

  function drive(s: CircuitState, c: Car, throttle: number, steer: number, brake: boolean, dt: number): void {
    const on = onTrack(s.track, c);
    const hx = Math.cos(c.a);
    const hy = Math.sin(c.a);
    let fwd = c.vx * hx + c.vy * hy;
    let side = -c.vx * hy + c.vy * hx;
    const accel = 200 * (1 + (c === s.cars[0] ? s.upgrades * 0.06 : 0)) * c.skill;
    fwd += (throttle * accel - (brake ? 260 : 0) * Math.sign(fwd)) * dt - fwd * (on ? 0.9 : 3.2) * dt;
    const grip = c.slip > 0 ? 0.35 : on ? 5 : 2.5;
    side *= Math.exp(-grip * dt);
    c.a += steer * 2.6 * dt * Math.min(1, Math.abs(fwd) / 70) * (fwd >= 0 ? 1 : -1);
    const nhx = Math.cos(c.a);
    const nhy = Math.sin(c.a);
    c.vx = nhx * fwd - nhy * side;
    c.vy = nhy * fwd + nhx * side;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.x = Math.min(W - 6, Math.max(6, c.x));
    c.y = Math.min(H - 6, Math.max(44, c.y));
    c.slip = Math.max(0, c.slip - dt);
  }

  function finishRace(s: CircuitState, emit: UpdateContext['emit']): void {
    const me = s.cars[0]!;
    const done = s.cars.filter((c) => c.fin > 0).length;
    let place = me.fin;
    if (place === 0) place = done + 1 + s.cars.filter((c) => c.fin === 0 && c !== me && progress(s, c) > progress(s, me)).length;
    s.place = place;
    s.qualified = place <= cfg.qualify;
    s.endDelay = 2.5;
    if (s.qualified) {
      s.score += (cfg.rivals + 2 - place) * 500 + s.level * 500;
      emit('wave');
    } else emit('die');
  }

  function update(s: CircuitState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    stepSparks(s.sparks, dt);
    if (s.over) {
      if (input.pressed.a || input.pressed.start) {
        Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
        emit('start');
      }
      return;
    }
    if (s.endDelay > 0) {
      s.endDelay -= dt;
      if (s.endDelay <= 0) {
        if (s.qualified) s.level += 1;
        else {
          s.lives -= 1;
          if (s.lives <= 0) {
            s.over = true;
            return;
          }
        }
        buildRace(s, rng);
      }
      return;
    }
    if (s.countdown > 0) {
      s.countdown -= dt;
      return;
    }
    const me = s.cars[0]!;
    const total = cfg.laps;

    // The player and rivals.
    const steer = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    for (let i = 0; i < s.cars.length; i++) {
      const c = s.cars[i]!;
      if (c.fin > 0) {
        drive(s, c, 0, 0, true, dt);
        continue;
      }
      if (i === 0) drive(s, c, input.held.a || input.held.up ? 1 : 0, steer, input.held.b || input.held.down, dt);
      else {
        const tgt = s.track[(c.wp + 1) % M]!;
        const want = Math.atan2(tgt.y - c.y, tgt.x - c.x);
        let err = want - c.a;
        err = Math.atan2(Math.sin(err), Math.cos(err));
        drive(s, c, Math.abs(err) < 0.9 ? 1 : 0.35, Math.max(-1, Math.min(1, err * 2.2)), false, dt);
      }
      // Waypoints.
      const wpPt = s.track[c.wp]!;
      if (Math.hypot(wpPt.x - c.x, wpPt.y - c.y) < 72) {
        c.wp = (c.wp + 1) % M;
        if (c.wp === 0) {
          c.lap += 1;
          if (c.lap >= total) {
            c.fin = s.cars.filter((o) => o.fin > 0).length + 1;
            if (i === 0) s.score += 300;
            else if (s.grace <= 0) s.grace = GRACE;
          } else if (i === 0) {
            s.score += 200;
            emit('pickup');
          }
        }
      }
    }
    // Oil slicks and wrenches.
    for (const c of s.cars) for (const o of s.oil) if (Math.hypot(o.x - c.x, o.y - c.y) < 18 && c.slip <= 0) c.slip = 0.9;
    for (const w of s.wrenches) {
      if (!w.taken && Math.hypot(w.x - me.x, w.y - me.y) < 20) {
        w.taken = true;
        s.upgrades = Math.min(5, s.upgrades + 1);
        s.score += 250;
        emit('pickup');
      }
    }
    // Bumping.
    for (let i = 0; i < s.cars.length; i++) {
      for (let j = i + 1; j < s.cars.length; j++) {
        const a = s.cars[i]!;
        const b = s.cars[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < R_CAR * 2 && d > 0.001) {
          const push = (R_CAR * 2 - d) / 2;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
          const rel = (b.vx - a.vx) * (dx / d) + (b.vy - a.vy) * (dy / d);
          if (rel < 0) {
            a.vx += (dx / d) * rel * 0.5;
            a.vy += (dy / d) * rel * 0.5;
            b.vx -= (dx / d) * rel * 0.5;
            b.vy -= (dy / d) * rel * 0.5;
            if (i === 0) burst(s.sparks, rng, (a.x + b.x) / 2, (a.y + b.y) / 2, COLORS.gold, 3);
          }
        }
      }
    }
    // The race ends when you finish, or a rival won and the grace time ran out.
    if (s.grace > 0 && me.fin === 0) {
      s.grace -= dt;
      if (s.grace <= 0) finishRace(s, emit);
    }
    if (me.fin > 0) finishRace(s, emit);
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function render(s: CircuitState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    g.fillStyle = cfg.colors.grass;
    g.fillRect(0, 0, W, H);
    const path = (width: number, style: string) => {
      g.strokeStyle = style;
      g.lineWidth = width;
      g.lineJoin = 'round';
      g.beginPath();
      s.track.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.closePath();
      g.stroke();
    };
    path(HALF * 2 + 10, cfg.colors.edge);
    path(HALF * 2, cfg.colors.track);
    const t0 = s.track[0]!;
    g.fillStyle = COLORS.paper;
    g.fillRect(t0.x - 3, t0.y - HALF, 6, HALF * 2);
    for (const o of s.oil) {
      g.fillStyle = 'rgba(10,10,20,0.7)';
      g.beginPath();
      g.ellipse(o.x, o.y, 18, 12, 0, 0, 6.3);
      g.fill();
    }
    for (const w of s.wrenches) {
      if (w.taken) continue;
      g.fillStyle = COLORS.gold;
      g.fillRect(w.x - 7, w.y - 7, 14, 14);
    }
    s.cars.forEach((c, i) => {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.a);
      g.fillStyle = i === 0 ? cfg.colors.car : CAR_COLORS[c.color % CAR_COLORS.length]!;
      g.fillRect(-12, -7, 24, 14);
      g.fillStyle = COLORS.bg;
      g.fillRect(2, -5, 6, 10);
      g.restore();
    });
    drawSparks(g, s.sparks);
    const me = s.cars[0]!;
    hud(g, s, `RACE ${s.level}  LAP ${Math.min(me.lap + 1, cfg.laps)}/${cfg.laps}  TUNE ${s.upgrades}`, s.lives);
    if (s.countdown > 0) banner(g, String(Math.ceil(s.countdown)), 250);
    else if (s.grace > 0 && me.fin === 0) banner(g, `FINISH! ${Math.ceil(s.grace)}`, 100);
    if (s.endDelay > 0) banner(g, s.qualified ? `PLACE ${s.place} - QUALIFIED!` : `PLACE ${s.place} - NOT GOOD ENOUGH`, 270);
    void time;
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
