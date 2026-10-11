import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * Pattern-boxing archetype (FT). You see the opponent from behind. Read each wind-up: lean away from
 * the incoming glove, then counter while he is open. Land hits on the right height (he guards head or body),
 * earn stars, spend one on an uppercut. Three rounds, knockdowns, and a decision if nobody falls.
 */
export interface BoxerConfig {
  id: string;
  roster: string[];
  colors: { ring: string; rope: string; foe: string; glove: string };
}

type Height = 'head' | 'body';
type FoePhase = 'idle' | 'wind' | 'strike' | 'open' | 'hurt' | 'down';

const ROUND_TIME = 60;
const ROUNDS = 3;
const START_LIVES = 3;
const MY_HP = 100;
const EXTRA_LIFE_EVERY = 30000;
const GETUP_PRESSES = 8;
const GETUP_TIME = 6;
const MAX_DOWNS = 3;

interface Foe {
  hp: number;
  max: number;
  phase: FoePhase;
  t: number;
  /** Side of the incoming glove: -1 left, 1 right. */
  side: -1 | 1;
  height: Height;
  guard: Height | 'none';
  /** Strikes still to throw in the current combination. */
  chain: number;
  downs: number;
  /** Duration of the current phase. */
  dur: number;
  starred: boolean;
}

export interface BoxerState {
  /** -1 leaning left, 1 leaning right, 0 centred. */
  lean: number;
  block: boolean;
  /** Punch in progress: kind and time left; cooldown after. */
  punch: 'none' | Height | 'upper';
  punchT: number;
  hurt: number;
  stars: number;
  hp: number;
  downs: number;
  /** Down count: seconds left and presses made while on the canvas. */
  count: number;
  presses: number;
  foe: Foe;
  round: number;
  timer: number;
  dealt: number;
  taken: number;
  phase: 'intro' | 'fight' | 'result';
  pt: number;
  msg: string;
  sparks: Spark[];
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

export function createBoxer(cfg: BoxerConfig): GameDefinition<BoxerState> {
  const foeHp = (level: number) => 70 + level * 12;
  const tell = (level: number) => Math.max(0.28, 0.75 - level * 0.05);

  function newFoe(level: number): Foe {
    return { hp: foeHp(level), max: foeHp(level), phase: 'idle', t: 0, side: 1, height: 'head', guard: 'none', chain: 0, downs: 0, dur: 1.2, starred: false };
  }

  function init({ hiScore }: { rng: Rng; hiScore: number }): BoxerState {
    return { lean: 0, block: false, punch: 'none', punchT: 0, hurt: 0, stars: 0, hp: MY_HP, downs: 0, count: 0, presses: 0, foe: newFoe(1), round: 1, timer: ROUND_TIME, dealt: 0, taken: 0, phase: 'intro', pt: 1.5, msg: '', sparks: [], nextLife: EXTRA_LIFE_EVERY, score: 0, hi: hiScore, lives: START_LIVES, level: 1, over: false };
  }

  function newBout(s: BoxerState): void {
    s.foe = newFoe(s.level);
    s.hp = MY_HP;
    s.downs = 0;
    s.count = 0;
    s.stars = 0;
    s.round = 1;
    s.timer = ROUND_TIME;
    s.dealt = 0;
    s.taken = 0;
    s.hurt = 0;
    s.punch = 'none';
    s.phase = 'intro';
    s.pt = 1.5;
    s.msg = '';
  }

  function finishBout(s: BoxerState, won: boolean, why: string, emit: UpdateContext['emit']): void {
    s.phase = 'result';
    s.pt = 2.5;
    s.msg = won ? why : `${why} - YOU LOSE`;
    if (won) {
      s.score += 3000 * s.level + Math.max(0, s.hp) * 10;
      emit('wave');
    } else emit('die');
    s.stars = 0;
    // Remember the outcome in `level` handling after the pause.
    s.count = won ? 1 : -1;
  }

  function foeThink(s: BoxerState, rng: Rng): void {
    const f = s.foe;
    f.t = 0;
    f.phase = 'idle';
    f.dur = rng.range(0.8, 1.6) * Math.max(0.6, 1 - s.level * 0.05);
    f.guard = rng.next() < 0.5 ? 'none' : rng.next() < 0.5 ? 'head' : 'body';
  }

  function startWind(s: BoxerState, rng: Rng): void {
    const f = s.foe;
    f.phase = 'wind';
    f.t = 0;
    f.side = rng.next() < 0.5 ? -1 : 1;
    f.height = rng.next() < 0.6 ? 'head' : 'body';
    f.dur = tell(s.level) * (f.chain > 0 ? 0.55 : 1);
    f.guard = 'none';
  }

  function update(s: BoxerState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    stepSparks(s.sparks, dt);
    if (s.over) {
      if (input.pressed.a || input.pressed.start) {
        Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
        emit('start');
      }
      return;
    }
    if (s.phase === 'intro') {
      s.pt -= dt;
      if (s.pt <= 0) {
        s.phase = 'fight';
        foeThink(s, rng);
      }
      return;
    }
    if (s.phase === 'result') {
      s.pt -= dt;
      if (s.pt > 0) return;
      if (s.count > 0) {
        s.level += 1;
        s.score += 0;
      } else {
        s.lives -= 1;
        if (s.lives <= 0) {
          s.over = true;
          return;
        }
      }
      newBout(s);
      return;
    }

    const f = s.foe;
    s.timer -= dt;
    s.hurt = Math.max(0, s.hurt - dt);

    // ---- the player is on the canvas
    if (s.count > 0 && s.hp <= 0) {
      s.count -= dt;
      if (input.pressed.a || input.pressed.b) s.presses += 1;
      if (s.presses >= GETUP_PRESSES) {
        s.hp = 40;
        s.count = 0;
        s.presses = 0;
        s.hurt = 0.8;
        foeThink(s, rng);
        f.dur += 1;
        emit('pickup');
      } else if (s.count <= 0) {
        finishBout(s, false, 'COUNTED OUT', emit);
      }
      return;
    }

    // ---- controls
    s.lean = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    s.block = input.held.down && s.hurt <= 0;
    s.punchT = Math.max(0, s.punchT - dt);
    if (s.punchT <= 0) s.punch = 'none';
    if (s.hurt <= 0 && s.punch === 'none' && !s.block) {
      let kind: BoxerState['punch'] = 'none';
      if (input.pressed.a) kind = input.held.up && s.stars > 0 ? 'upper' : 'head';
      else if (input.pressed.b) kind = 'body';
      if (kind !== 'none') {
        s.punch = kind;
        s.punchT = kind === 'upper' ? 0.5 : 0.3;
        s.lean = 0;
        if (kind === 'upper') s.stars -= 1;
        emit('fire');
        resolvePunch(s, kind, rng, emit);
      }
    }

    // ---- the opponent
    f.t += dt;
    if (f.phase === 'idle' && f.t >= f.dur) {
      f.chain = s.level >= 3 && rng.next() < 0.3 + s.level * 0.03 ? 1 : 0;
      startWind(s, rng);
    } else if (f.phase === 'wind' && f.t >= f.dur) {
      f.phase = 'strike';
      f.t = 0;
      f.dur = 0.22;
      resolveStrike(s, rng, emit);
    } else if (f.phase === 'strike' && f.t >= f.dur) {
      if (f.chain > 0) {
        f.chain -= 1;
        startWind(s, rng);
      } else foeThink(s, rng);
    } else if (f.phase === 'open' && f.t >= f.dur) foeThink(s, rng);
    else if (f.phase === 'hurt' && f.t >= f.dur) foeThink(s, rng);
    else if (f.phase === 'down') {
      if (f.t >= 3) {
        if (f.downs >= MAX_DOWNS) {
          finishBout(s, true, 'TKO!', emit);
          return;
        }
        f.hp = Math.round(f.max * 0.35);
        foeThink(s, rng);
        f.dur += 0.6;
      }
    }

    // ---- the clock
    if (s.timer <= 0) {
      s.timer = ROUND_TIME;
      if (s.round >= ROUNDS) {
        const won = s.dealt >= s.taken;
        finishBout(s, won, won ? 'DECISION: YOU WIN' : 'DECISION', emit);
        return;
      }
      s.round += 1;
      s.msg = `ROUND ${s.round}`;
      s.phase = 'intro';
      s.pt = 1.4;
      f.downs = 0;
      s.hp = Math.min(MY_HP, s.hp + 20);
      foeThink(s, rng);
    }
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function resolvePunch(s: BoxerState, kind: BoxerState['punch'], rng: Rng, emit: UpdateContext['emit']): void {
    const f = s.foe;
    if (f.phase === 'down') return;
    const height: Height = kind === 'body' ? 'body' : 'head';
    if (kind !== 'upper' && f.guard === height && f.phase === 'idle') {
      // Guarded: no damage and you are open for a moment.
      s.hurt = 0.35;
      burst(s.sparks, rng, W / 2, 250, COLORS.paper, 3);
      emit('pickup');
      return;
    }
    const open = f.phase === 'open';
    let dmg = kind === 'upper' ? 22 : open ? 9 : 3;
    if (f.phase === 'wind') dmg = 6;
    f.hp -= dmg;
    s.dealt += dmg;
    s.score += dmg * 20;
    burst(s.sparks, rng, W / 2 + s.lean * 20, height === 'head' ? 170 : 260, COLORS.gold, 6);
    emit('explode');
    if (open && !f.starred) {
      f.starred = true;
      s.stars = Math.min(3, s.stars + 1);
    }
    if (f.hp <= 0) {
      f.downs += 1;
      f.phase = 'down';
      f.t = 0;
      f.hp = 0;
      s.score += 1000;
      emit('wave');
      if (f.downs >= MAX_DOWNS) {
        // The count still runs, but a third knockdown is a TKO right away.
        finishBout(s, true, 'TKO!', emit);
      }
    } else if (kind === 'upper' || open) {
      f.phase = 'open';
      f.t = 0;
      f.dur = Math.max(f.dur, 0.9);
    } else if (f.phase === 'idle') {
      // Hitting him while he is ready makes him throw sooner.
      f.t = Math.max(f.t, f.dur - 0.25);
    }
  }

  function resolveStrike(s: BoxerState, rng: Rng, emit: UpdateContext['emit']): void {
    const f = s.foe;
    const dodged = s.lean === -f.side && s.hurt <= 0 && s.punch === 'none';
    if (dodged) {
      f.phase = 'open';
      f.t = 0;
      f.dur = 1.3;
      f.starred = false;
      f.chain = 0;
      emit('pickup');
      return;
    }
    const base = 8 + s.level * 2;
    const dmg = s.block ? Math.ceil(base * 0.25) : base;
    s.hp -= dmg;
    s.taken += dmg;
    s.hurt = s.block ? 0.2 : 0.5;
    burst(s.sparks, rng, W / 2, 400, COLORS.coral, 6);
    emit('die');
    if (s.hp <= 0) {
      s.hp = 0;
      s.downs += 1;
      if (s.downs >= MAX_DOWNS) {
        finishBout(s, false, 'KNOCKED OUT', emit);
        return;
      }
      s.count = GETUP_TIME;
      s.presses = 0;
    }
  }

  function render(s: BoxerState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    g.fillStyle = cfg.colors.ring;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#10082a';
    g.fillRect(0, 0, W, 200);
    g.strokeStyle = cfg.colors.rope;
    g.lineWidth = 6;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(0, 190 + k * 18);
      g.lineTo(W, 190 + k * 18);
      g.stroke();
    }
    const f = s.foe;
    const shift = -s.lean * 40;
    const fx = W / 2 + shift;
    const down = f.phase === 'down';
    const wob = Math.sin(time * 3) * 3;
    // Opponent.
    g.fillStyle = cfg.colors.foe;
    if (down) g.fillRect(fx - 90, 380, 180, 60);
    else {
      g.fillRect(fx - 70, 215 + wob, 140, 190);
      g.fillStyle = '#e8d2b0';
      g.fillRect(fx - 34, 140 + wob, 68, 76);
      // Gloves: raised guard, or the tell.
      const glove = (x: number, y: number, hot: boolean) => {
        g.fillStyle = hot ? COLORS.coral : cfg.colors.glove;
        g.fillRect(x - 24, y - 24, 48, 48);
      };
      const guardH = f.guard === 'head';
      const guardB = f.guard === 'body';
      const winding = f.phase === 'wind' || f.phase === 'strike';
      const extend = f.phase === 'strike' ? 70 : 0;
      glove(fx - 90, (winding && f.side === -1 ? (f.height === 'head' ? 190 : 330) : guardH ? 190 : guardB ? 330 : 280) + extend, winding && f.side === -1 && Math.floor(time * 16) % 2 === 0);
      glove(fx + 90, (winding && f.side === 1 ? (f.height === 'head' ? 190 : 330) : guardH ? 190 : guardB ? 330 : 280) + extend, winding && f.side === 1 && Math.floor(time * 16) % 2 === 0);
    }
    if (f.phase === 'open') {
      g.fillStyle = COLORS.gold;
      g.font = '28px monospace';
      g.fillText('OPEN!', fx - 40, 120);
    }
    drawSparks(g, s.sparks);
    // Player gloves.
    const punching = s.punch !== 'none';
    g.fillStyle = cfg.colors.glove;
    const py = s.punch === 'body' ? 330 : s.punch === 'none' ? 520 : 260;
    g.fillRect(W / 2 - 150 + s.lean * 30, s.block ? 420 : punching ? py : 500, 80, 70);
    g.fillRect(W / 2 + 70 + s.lean * 30, s.block ? 420 : punching ? py : 500, 80, 70);
    // Bars.
    const bar = (x: number, v: number, max: number, color: string, label: string) => {
      g.fillStyle = COLORS.muted;
      g.fillRect(x, 60, 280, 14);
      g.fillStyle = color;
      g.fillRect(x, 60, (280 * Math.max(0, v)) / max, 14);
      g.fillStyle = COLORS.paper;
      g.font = '14px monospace';
      g.fillText(label, x, 92);
    };
    bar(40, s.hp, MY_HP, COLORS.cyan, `YOU  KD ${s.downs}`);
    bar(W - 320, f.hp, f.max, COLORS.coral, `${cfg.roster[(s.level - 1) % cfg.roster.length]!.toUpperCase()}  KD ${f.downs}`);
    g.fillStyle = COLORS.gold;
    g.font = '22px monospace';
    g.fillText(`${'★'.repeat(s.stars)}`, 40, 118);
    g.fillText(String(Math.ceil(s.timer)).padStart(2, '0'), W / 2 - 14, 88);
    g.fillStyle = COLORS.paper;
    g.font = '14px monospace';
    g.fillText(`ROUND ${s.round}/${ROUNDS}`, W / 2 - 40, 108);
    hud(g, s, `BOUT ${s.level}`, s.lives);
    if (s.count > 0 && s.hp <= 0) banner(g, `GET UP! MASH A  ${s.presses}/${GETUP_PRESSES}`, 250);
    else if (s.phase === 'intro') banner(g, `ROUND ${s.round}`, 250);
    else if (s.phase === 'result') banner(g, s.msg, 250);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
