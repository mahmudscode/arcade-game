import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * One-on-one fighting archetype (FT). Walk, jump, crouch and block; punch, kick, sweep and (optionally) throw
 * a fireball with Down, Forward, Punch. Best of three rounds against a ladder of tougher opponents.
 * `hp` scoring drains health bars; `points` scoring awards one point per clean hit.
 */
export interface FighterConfig {
  id: string;
  scoring: 'hp' | 'points';
  fireball: boolean;
  hp: number;
  /** Points needed to win a round in `points` scoring. */
  target: number;
  roster: string[];
  colors: { floor: string; wall: string; hero: string; foe: string };
}

type Move = 'punch' | 'kick' | 'low' | 'air' | 'fire';
type FState = 'idle' | 'walk' | 'jump' | 'attack' | 'hurt' | 'block' | 'down' | 'getup';

const GROUND = 470;
const LEFT = 70;
const RIGHT = W - 70;
const WALK = 170;
const JUMP_V = 620;
const GRAV = 1700;
const ROUND_TIME = 60;
const START_LIVES = 3;
const FIRE_SPEED = 360;
const EXTRA_LIFE_EVERY = 30000;

const MOVES: Record<Move, { st: number; act: number; rec: number; dmg: number; range: number; low: boolean }> = {
  punch: { st: 0.08, act: 0.1, rec: 0.16, dmg: 6, range: 62, low: false },
  kick: { st: 0.14, act: 0.12, rec: 0.24, dmg: 10, range: 86, low: false },
  low: { st: 0.12, act: 0.12, rec: 0.28, dmg: 8, range: 78, low: true },
  air: { st: 0, act: 9, rec: 0, dmg: 9, range: 62, low: false },
  fire: { st: 0.3, act: 0, rec: 0.35, dmg: 12, range: 0, low: false },
};

interface Ai {
  think: number;
  dir: number;
  down: boolean;
  block: number;
  jump: boolean;
}
export interface Fgt {
  x: number;
  y: number;
  vy: number;
  vx: number;
  face: number;
  hp: number;
  points: number;
  state: FState;
  t: number;
  move: Move | '';
  hit: boolean;
  crouch: boolean;
  /** Horizontal drift chosen at take-off. */
  jx: number;
  invuln: number;
  /** Motion input progress for the fireball: 0 none, 1 down seen, 2 forward seen. */
  seq: number;
  seqT: number;
  fired: boolean;
  ai: Ai;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  owner: 0 | 1;
}

export interface FighterState {
  p: Fgt;
  e: Fgt;
  balls: Ball[];
  phase: 'intro' | 'fight' | 'ko' | 'over';
  pt: number;
  timer: number;
  wins: [number, number];
  round: number;
  /** Text shown at the end of a round. */
  msg: string;
  /** The round is decided (otherwise a `ko` pause is just a point in `points` scoring). */
  ended: boolean;
  sparks: Spark[];
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

interface Ctl {
  move: number;
  up: boolean;
  down: boolean;
  a: boolean;
  b: boolean;
  fire: boolean;
}

export function createFighter(cfg: FighterConfig): GameDefinition<FighterState> {
  const points = cfg.scoring === 'points';
  const maxHp = points ? 0 : cfg.hp;

  const fresh = (x: number, face: number): Fgt => ({
    x, y: GROUND, vy: 0, vx: 0, face, hp: maxHp, points: 0, state: 'idle', t: 0, move: '', hit: false, crouch: false, jx: 0, invuln: 0, seq: 0, seqT: 0, fired: false,
    ai: { think: 0.5, dir: 0, down: false, block: 0, jump: false },
  });

  function startRound(s: FighterState): void {
    const keepPoints = false;
    s.p = fresh(260, 1);
    s.e = fresh(540, -1);
    if (!keepPoints) {
      s.p.points = 0;
      s.e.points = 0;
    }
    s.balls = [];
    s.phase = 'intro';
    s.pt = 1.4;
    s.timer = ROUND_TIME;
    s.msg = '';
    s.ended = false;
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): FighterState {
    void rng;
    const s: FighterState = { p: fresh(260, 1), e: fresh(540, -1), balls: [], phase: 'intro', pt: 1.4, timer: ROUND_TIME, wins: [0, 0], round: 1, msg: '', ended: false, sparks: [], nextLife: EXTRA_LIFE_EVERY, score: 0, hi: hiScore, lives: START_LIVES, level: 1, over: false };
    return s;
  }

  const grounded = (f: Fgt) => f.y >= GROUND;
  const busy = (f: Fgt) => f.state === 'attack' || f.state === 'hurt' || f.state === 'down' || f.state === 'getup' || f.state === 'block';

  function setState(f: Fgt, st: FState): void {
    f.state = st;
    f.t = 0;
  }

  function startMove(f: Fgt, m: Move): void {
    setState(f, 'attack');
    f.move = m;
    f.hit = false;
    f.fired = false;
  }

  /** Applies one frame of control to a fighter. */
  function drive(s: FighterState, f: Fgt, o: Fgt, c: Ctl, dt: number, idx: 0 | 1, ctx: UpdateContext): void {
    f.t += dt;
    f.invuln = Math.max(0, f.invuln - dt);
    f.x += f.vx * dt;
    f.vx *= Math.max(0, 1 - 8 * dt);
    const air = !grounded(f);
    if (air) {
      f.vy += GRAV * dt;
      f.y += f.vy * dt;
      f.x += f.jx * dt;
      if (f.y >= GROUND) {
        f.y = GROUND;
        f.vy = 0;
        f.jx = 0;
        if (f.state === 'jump' || f.move === 'air') {
          f.move = '';
          setState(f, 'idle');
        }
      }
    }
    f.x = Math.min(RIGHT, Math.max(LEFT, f.x));

    // Stun states run their course.
    if (f.state === 'hurt') {
      if (f.t > 0.32) {
        setState(f, 'idle');
        f.invuln = 0.3;
      }
      return;
    }
    if (f.state === 'block') {
      if (f.t > 0.16) setState(f, 'idle');
      return;
    }
    if (f.state === 'down') {
      if (f.t > 0.8 && grounded(f)) {
        setState(f, 'getup');
        f.invuln = 0.5;
      }
      return;
    }
    if (f.state === 'getup') {
      if (f.t > 0.3) setState(f, 'idle');
      return;
    }
    if (f.state === 'attack') {
      const m = MOVES[f.move as Move];
      if (f.move === 'fire') {
        if (!f.fired && f.t >= m.st) {
          f.fired = true;
          s.balls.push({ x: f.x + f.face * 40, y: GROUND - 60, vx: f.face * FIRE_SPEED, owner: idx });
          ctx.emit('fire');
        }
        if (f.t >= m.st + m.rec) setState(f, 'idle');
      } else if (f.move === 'air') {
        // Ends on landing (handled above).
      } else if (f.t >= m.st + m.act + m.rec) {
        f.move = '';
        setState(f, 'idle');
      }
      return;
    }

    // Free to act.
    const toward = c.move * f.face;
    f.crouch = grounded(f) && c.down;
    if (grounded(f)) {
      // Motion input: Down, then Forward, then Punch.
      f.seqT += dt;
      if (f.seqT > 0.5) f.seq = 0;
      if (c.down && f.seq === 0) {
        f.seq = 1;
        f.seqT = 0;
      } else if (f.seq === 1 && toward > 0) {
        f.seq = 2;
        f.seqT = 0;
      }
      if (c.fire || (c.a && f.seq === 2 && cfg.fireball)) {
        if (cfg.fireball && !s.balls.some((b) => b.owner === idx)) {
          f.seq = 0;
          startMove(f, 'fire');
          return;
        }
      }
      if (c.up) {
        f.vy = -JUMP_V;
        f.y -= 1;
        f.jx = c.move * 190;
        f.crouch = false;
        setState(f, 'jump');
        return;
      }
      if (c.a) {
        startMove(f, f.crouch ? 'punch' : 'punch');
        return;
      }
      if (c.b) {
        startMove(f, f.crouch ? 'low' : 'kick');
        return;
      }
      if (f.crouch) {
        setState(f, 'idle');
        return;
      }
      f.x += c.move * WALK * dt * (toward < 0 ? 0.75 : 1);
      f.state = c.move !== 0 ? 'walk' : 'idle';
    } else if ((c.a || c.b) && f.move === '') {
      f.move = 'air';
      f.hit = false;
    }
    // Always face the opponent while grounded and free.
    if (grounded(f)) f.face = o.x >= f.x ? 1 : -1;
  }

  function guarding(f: Fgt, c: Ctl): boolean {
    return grounded(f) && (f.state === 'idle' || f.state === 'walk') && c.move === -f.face;
  }

  function resolveHits(s: FighterState, ctl: [Ctl, Ctl], ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    const pair: [Fgt, Fgt][] = [[s.p, s.e], [s.e, s.p]];
    pair.forEach(([a, d], i) => {
      if (a.state !== 'attack' || a.hit) return;
      const m = MOVES[a.move as Move];
      if (a.move === 'fire') return;
      const active = a.move === 'air' ? !grounded(a) : a.t >= m.st && a.t < m.st + m.act;
      if (!active) return;
      const dx = (d.x - a.x) * a.face;
      if (dx < -10 || dx > m.range + 14) return;
      // Vertical overlap: only air moves and punches reach airborne foes; crouching dodges high punches.
      if (!grounded(d) && a.move !== 'air' && a.move !== 'punch') return;
      if (d.crouch && a.move === 'punch') return;
      if (d.invuln > 0 || d.state === 'down' || d.state === 'getup') return;
      a.hit = true;
      land(s, a, d, i as 0 | 1, m.dmg, a.move as Move, ctl[1 - i]!, ctx);
    });
    // Fireballs.
    for (const b of s.balls) {
      b.x += b.vx * (1 / 60);
      const d = b.owner === 0 ? s.e : s.p;
      const a = b.owner === 0 ? s.p : s.e;
      if (Math.abs(b.x - d.x) < 26 && grounded(d) && d.invuln <= 0 && d.state !== 'down' && d.state !== 'getup') {
        b.x = -9999;
        land(s, a, d, b.owner, MOVES.fire.dmg, 'fire', ctl[b.owner === 0 ? 1 : 0]!, ctx);
      }
    }
    for (let i = 0; i < s.balls.length; i++) for (let j = i + 1; j < s.balls.length; j++) if (Math.abs(s.balls[i]!.x - s.balls[j]!.x) < 24 && s.balls[i]!.owner !== s.balls[j]!.owner) {
      s.balls[i]!.x = -9999;
      s.balls[j]!.x = -9999;
    }
    s.balls = s.balls.filter((b) => b.x > -100 && b.x < W + 100);
    void rng;
    void emit;
  }

  function land(s: FighterState, a: Fgt, d: Fgt, idx: 0 | 1, dmg: number, move: Move, dctl: Ctl, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    const blocked = guarding(d, dctl) && (move !== 'low' || d.crouch) && (move === 'low' ? d.crouch : true);
    const pushDir = a.face;
    if (blocked) {
      setState(d, 'block');
      d.vx = pushDir * 120;
      if (move === 'fire' && !points) d.hp = Math.max(1, d.hp - 1);
      burst(s.sparks, rng, d.x, GROUND - 70, COLORS.paper, 3);
      emit('pickup');
      return;
    }
    burst(s.sparks, rng, d.x, GROUND - 80, COLORS.gold, 7);
    emit('explode');
    if (points) {
      a.points += 1;
      s.pt = 1;
      s.phase = 'ko';
      s.msg = idx === 0 ? 'POINT!' : 'POINT FOR THEM';
      if (idx === 0) s.score += 300;
      setState(d, 'hurt');
      if (a.points >= cfg.target) {
        endRound(s, ctx, idx === 0);
        s.msg = idx === 0 ? 'ROUND WON' : 'ROUND LOST';
      }
      return;
    }
    d.hp -= dmg;
    if (idx === 0) s.score += dmg * 10;
    const knock = move === 'low' || move === 'fire' || (move === 'air' && dmg >= 9 && d.hp <= 0);
    if (knock || d.hp <= 0) {
      setState(d, 'down');
      d.vy = -280;
      d.y -= 1;
      d.vx = pushDir * 200;
      d.jx = 0;
    } else {
      setState(d, 'hurt');
      d.vx = pushDir * 130;
    }
    d.move = '';
  }

  function aiControl(s: FighterState, f: Fgt, o: Fgt, dt: number, rng: Rng): Ctl {
    const c: Ctl = { move: 0, up: false, down: false, a: false, b: false, fire: false };
    const ai = f.ai;
    ai.think -= dt;
    ai.block = Math.max(0, ai.block - dt);
    const dist = Math.abs(o.x - f.x);
    const toward = o.x >= f.x ? 1 : -1;
    const level = Math.min(s.level, 10);
    const quick = 1 - level * 0.04;
    if (ai.think <= 0 && !busy(f) && grounded(f)) {
      ai.think = rng.range(0.1, 0.32) * quick;
      ai.dir = 0;
      ai.down = false;
      const threat = o.state === 'attack' && dist < 120;
      const r = rng.next();
      if (threat && r < (points ? 0.62 : 0.35) + level * 0.04) {
        ai.block = 0.45;
        ai.down = o.move === 'low' || rng.next() < 0.3;
      } else if (dist > 220) {
        if (cfg.fireball && !s.balls.some((b) => b.owner === 1) && r < 0.35) c.fire = true;
        else if (r < 0.5) ai.dir = toward;
        else if (r < 0.62) {
          ai.jump = true;
          ai.dir = toward;
        } else ai.dir = toward;
      } else if (dist > 100) {
        if (r < 0.55) ai.dir = toward;
        else if (r < 0.75) c.b = true;
        else if (r < 0.82) {
          ai.jump = true;
          ai.dir = toward;
        }
      } else if (r < 0.45) c.a = true;
      else if (r < 0.75) c.b = true;
      else if (r < 0.9) {
        c.b = true;
        c.down = true;
      } else ai.dir = -toward;
    }
    if (ai.jump && grounded(f)) {
      ai.jump = false;
      c.up = true;
      c.move = ai.dir;
    } else if (!grounded(f) && dist < 90 && f.move === '') c.a = true;
    else if (ai.block > 0) {
      c.move = -toward;
      c.down = ai.down;
    } else {
      c.move = ai.dir;
      c.down = ai.down;
    }
    return c;
  }

  function endRound(s: FighterState, ctx: UpdateContext, pWon: boolean, draw = false): void {
    const { emit } = ctx;
    s.phase = 'ko';
    s.ended = true;
    s.pt = 2;
    if (draw) {
      s.msg = 'DRAW';
      s.wins[0] += 1;
      s.wins[1] += 1;
    } else if (pWon) {
      s.wins[0] += 1;
      s.msg = 'YOU WIN THE ROUND';
      s.score += 1000 + Math.round(s.timer) * 10 + (points ? 0 : Math.max(0, Math.round(s.p.hp)) * 10);
      emit('wave');
    } else {
      s.wins[1] += 1;
      s.msg = 'ROUND LOST';
      emit('die');
    }
  }

  function update(s: FighterState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    stepSparks(s.sparks, dt);
    if (s.over) {
      if (input.pressed.a || input.pressed.start) {
        Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
        emit('start');
      }
      return;
    }
    const pc: Ctl = {
      move: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0),
      up: input.held.up,
      down: input.held.down,
      a: input.pressed.a,
      b: input.pressed.b,
      fire: false,
    };

    if (s.phase === 'intro') {
      s.pt -= dt;
      if (s.pt <= 0) s.phase = 'fight';
      return;
    }
    if (s.phase === 'ko') {
      // Let the fighters settle; knocked-down ones finish falling.
      drive(s, s.p, s.e, { move: 0, up: false, down: false, a: false, b: false, fire: false }, dt, 0, ctx);
      drive(s, s.e, s.p, { move: 0, up: false, down: false, a: false, b: false, fire: false }, dt, 1, ctx);
      s.pt -= dt;
      if (s.pt > 0) return;
      if (!s.ended) {
        // A point was scored: reset positions for the next exchange and keep the score and clock.
        const pp = s.p.points;
        const ep = s.e.points;
        const timer = s.timer;
        startRound(s);
        s.p.points = pp;
        s.e.points = ep;
        s.timer = timer;
        s.pt = 0.8;
        return;
      }
      const [pw, ew] = s.wins;
      if (pw >= 2 || ew >= 2) {
        if (pw > ew) {
          s.score += 2000 * s.level;
          s.level += 1;
          s.wins = [0, 0];
          s.round = 1;
          emit('wave');
        } else {
          s.lives -= 1;
          s.wins = [0, 0];
          s.round = 1;
          if (s.lives <= 0) {
            s.over = true;
            if (s.score > s.hi) s.hi = s.score;
            return;
          }
        }
      } else s.round += 1;
      startRound(s);
      return;
    }

    // ---- fight
    s.timer -= dt;
    const ec = aiControl(s, s.e, s.p, dt, rng);
    drive(s, s.p, s.e, pc, dt, 0, ctx);
    drive(s, s.e, s.p, ec, dt, 1, ctx);
    if (s.p.x > s.e.x - 24 && s.p.x < s.e.x + 24 && grounded(s.p) && grounded(s.e)) {
      const push = (24 - Math.abs(s.p.x - s.e.x)) / 2;
      const d = s.p.x <= s.e.x ? -1 : 1;
      s.p.x += d * push;
      s.e.x -= d * push;
    }
    resolveHits(s, [pc, ec], ctx);
    if (s.phase !== 'fight') return;
    if (!points && (s.p.hp <= 0 || s.e.hp <= 0)) {
      endRound(s, ctx, s.e.hp <= 0 && s.p.hp > 0, s.e.hp <= 0 && s.p.hp <= 0);
      s.msg = s.e.hp <= 0 ? 'K.O.!' : 'K.O.... YOU LOSE';
    } else if (s.timer <= 0) {
      s.timer = 0;
      const pv = points ? s.p.points : s.p.hp;
      const ev = points ? s.e.points : s.e.hp;
      endRound(s, ctx, pv > ev, pv === ev);
      s.msg = 'TIME UP';
    }
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function person(g: CanvasRenderingContext2D, f: Fgt, color: string, time: number): void {
    const x = f.x;
    const y = f.y;
    const down = f.state === 'down' && f.t > 0.12 && grounded(f);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(x, GROUND + 4, 30, 7, 0, 0, 6.3);
    g.fill();
    if (down) {
      g.fillStyle = color;
      g.fillRect(x - 46, y - 22, 92, 22);
      g.fillStyle = '#e8d2b0';
      g.fillRect(x - f.face * 46 - 8, y - 32, 18, 18);
      return;
    }
    const h = f.crouch ? 70 : 110;
    g.fillStyle = color;
    g.fillRect(x - 17, y - h, 34, h - 40);
    g.fillRect(x - 15, y - 42, 12, 42);
    g.fillRect(x + 3, y - 42, 12, 42);
    g.fillStyle = '#e8d2b0';
    g.fillRect(x - 12, y - h - 26, 24, 26);
    const blink = f.invuln > 0 && Math.floor(time * 20) % 2 === 0;
    if (blink) {
      g.fillStyle = COLORS.paper;
      g.fillRect(x - 17, y - h, 34, 10);
    }
    if (f.state === 'attack') {
      g.fillStyle = COLORS.gold;
      const m = f.move as Move;
      if (m === 'punch') g.fillRect(x + f.face * 18 - (f.face < 0 ? 40 : 0), y - h + 10, 40, 10);
      else if (m === 'kick') g.fillRect(x + f.face * 14 - (f.face < 0 ? 52 : 0), y - 50, 52, 12);
      else if (m === 'low') g.fillRect(x + f.face * 14 - (f.face < 0 ? 52 : 0), y - 16, 52, 12);
      else if (m === 'air') g.fillRect(x + f.face * 14 - (f.face < 0 ? 44 : 0), y - 42, 44, 12);
      else g.fillRect(x + f.face * 18 - (f.face < 0 ? 24 : 0), y - h + 14, 24, 24);
    }
  }

  function render(s: FighterState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    g.fillStyle = cfg.colors.wall;
    g.fillRect(0, 0, W, GROUND);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let k = 0; k < 8; k++) g.fillRect(40 + k * 100, 120 + (k % 3) * 30, 60, 200);
    g.fillStyle = cfg.colors.floor;
    g.fillRect(0, GROUND, W, H - GROUND);
    person(g, s.e, cfg.colors.foe, time);
    person(g, s.p, cfg.colors.hero, time);
    for (const b of s.balls) {
      g.fillStyle = COLORS.cyan;
      g.beginPath();
      g.arc(b.x, b.y, 14, 0, 6.3);
      g.fill();
    }
    drawSparks(g, s.sparks);
    // Bars.
    const bar = (x: number, v: number, max: number, rev: boolean, color: string) => {
      g.fillStyle = COLORS.muted;
      g.fillRect(x, 70, 300, 14);
      g.fillStyle = color;
      const w = (300 * Math.max(0, v)) / max;
      g.fillRect(rev ? x + 300 - w : x, 70, w, 14);
    };
    const name = cfg.roster[(s.level - 1) % cfg.roster.length]!;
    if (points) {
      g.fillStyle = COLORS.paper;
      g.font = '20px monospace';
      g.fillText(`YOU ${s.p.points}`, 40, 90);
      g.fillText(`${s.e.points} ${name.toUpperCase()}`, W - 40 - 180, 90);
    } else {
      bar(40, s.p.hp, cfg.hp, false, COLORS.cyan);
      bar(W - 340, s.e.hp, cfg.hp, true, COLORS.coral);
      g.fillStyle = COLORS.paper;
      g.font = '14px monospace';
      g.fillText('YOU', 40, 106);
      g.fillText(name.toUpperCase(), W - 340, 106);
    }
    g.fillStyle = COLORS.gold;
    g.font = '24px monospace';
    g.fillText(String(Math.ceil(s.timer)).padStart(2, '0'), W / 2 - 14, 90);
    g.fillStyle = COLORS.paper;
    g.font = '14px monospace';
    g.fillText(`ROUND ${s.round}   WINS ${s.wins[0]}-${s.wins[1]}`, W / 2 - 70, 112);
    hud(g, s, `BOUT ${s.level}`, s.lives);
    if (s.phase === 'intro') banner(g, s.pt > 0.5 ? `ROUND ${s.round}` : 'FIGHT!', 230);
    if (s.phase === 'ko' && s.msg) banner(g, s.msg, 230);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
