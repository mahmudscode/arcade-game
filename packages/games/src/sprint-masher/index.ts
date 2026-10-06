import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const LANE_H = 70;
const TRACK_LEN = 5000;
const START_LIVES = 3;
const HURDLES = [900, 1500, 2100, 2700, 3300, 3900, 4400];

type Event = 'dash' | 'hurdles';
interface Runner { x: number; v: number; ai: boolean; down: number }

export interface MasherState {
  event: Event;
  runners: Runner[];
  /** Which alternating key is expected next (left or right). */
  expect: 'left' | 'right';
  jump: number;
  jumpV: number;
  clock: number;
  /** Seconds to beat to qualify; shrinks every round. */
  qualify: number;
  countdown: number;
  finishDelay: number;
  result: '' | 'qualified' | 'failed';
  score: number;
  hi: number;
  lives: number;
  round: number;
  over: boolean;
}

function startRound(s: MasherState, rng: Rng): void {
  s.event = s.round % 2 === 1 ? 'dash' : 'hurdles';
  s.runners = [{ x: 0, v: 0, ai: false, down: 0 }, ...[0, 1, 2].map(() => ({ x: 0, v: 0, ai: true, down: 0 }))];
  s.expect = 'left';
  s.jump = 0;
  s.jumpV = 0;
  s.clock = 0;
  s.countdown = 2;
  s.result = '';
  s.finishDelay = 0;
  // AI top speeds are seeded per round so each race is a little different.
  s.runners.forEach((r) => {
    if (r.ai) r.v = rng.range(0, 1);
  });
  s.qualify = Math.max(8, 14.5 - s.round * 0.35);
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): MasherState {
  const s: MasherState = { event: 'dash', runners: [], expect: 'left', jump: 0, jumpV: 0, clock: 0, qualify: 14, countdown: 2, finishDelay: 0, result: '', score: 0, hi: hiScore, lives: START_LIVES, round: 1, over: false };
  startRound(s, rng);
  return s;
}

const aiTop = (s: MasherState, i: number, v0: number) => (360 + s.round * 14 + v0 * 40 + i * 6) * (s.event === 'hurdles' ? 0.9 : 1);

function update(s: MasherState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  if (s.finishDelay > 0) {
    s.finishDelay -= dt;
    if (s.finishDelay <= 0) {
      if (s.lives <= 0) s.over = true;
      else {
        if (s.result === 'qualified') s.round += 1;
        startRound(s, rng);
        emit('wave');
      }
    }
    return;
  }
  if (s.countdown > 0) {
    s.countdown -= dt;
    return;
  }

  s.clock += dt;
  const me = s.runners[0]!;

  // Mash: alternate left and right to accelerate. Hitting the same key twice does nothing.
  const tap = input.pressed.left ? 'left' : input.pressed.right ? 'right' : null;
  if (tap) {
    if (tap === s.expect) {
      me.v = Math.min(520, me.v + 34);
      s.expect = tap === 'left' ? 'right' : 'left';
    } else me.v = Math.max(0, me.v - 10);
  }
  me.v = Math.max(0, me.v - 90 * dt);

  if (s.event === 'hurdles') {
    if ((input.pressed.a || input.pressed.up) && s.jump <= 0) {
      s.jump = 0.001;
      s.jumpV = 520;
      emit('fire');
    }
    if (s.jump > 0) {
      s.jumpV -= 1800 * dt;
      s.jump = Math.max(0, s.jump + s.jumpV * dt);
      if (s.jump <= 0) s.jumpV = 0;
    }
    if (me.down > 0) me.down -= dt;
    for (const h of HURDLES) {
      if (me.x < h && me.x + me.v * dt >= h && s.jump < 24 && me.down <= 0) {
        me.v *= 0.25;
        me.down = 0.6;
        emit('die');
      }
    }
  }
  me.x += me.v * dt;

  s.runners.forEach((r, i) => {
    if (!r.ai) return;
    const top = aiTop(s, i, 0.5);
    r.v += (top - r.v) * Math.min(1, dt * 0.9);
    r.x += r.v * dt;
  });

  const finished = s.runners.filter((r) => r.x >= TRACK_LEN);
  if (me.x >= TRACK_LEN) {
    const place = 1 + s.runners.filter((r) => r.ai && r.x >= TRACK_LEN).length + s.runners.filter((r) => r.ai && r.x < TRACK_LEN && r.x > me.x).length;
    const qualified = s.clock <= s.qualify && place <= 3;
    s.result = qualified ? 'qualified' : 'failed';
    if (qualified) {
      s.score += Math.round((s.qualify - s.clock) * 200) + (4 - place) * 300 + 500;
      emit('pickup');
    } else {
      s.lives -= 1;
      emit('die');
    }
    s.finishDelay = 2;
  } else if (finished.length >= 3 || s.clock > s.qualify + 6) {
    s.result = 'failed';
    s.lives -= 1;
    s.finishDelay = 2;
    emit('die');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: MasherState, g: CanvasRenderingContext2D): void {
  clear(g);
  const me = s.runners[0]!;
  const cam = Math.max(0, me.x - 220);
  const top = 90;
  s.runners.forEach((r, i) => {
    const y = top + i * LANE_H;
    g.fillStyle = i % 2 ? '#33295c' : '#2c2352';
    g.fillRect(0, y, W, LANE_H - 4);
    // Lane markers every 200 px of track scroll past.
    g.fillStyle = COLORS.muted;
    for (let m = Math.floor(cam / 200) * 200; m < cam + W + 200; m += 200) g.fillRect(m - cam, y + LANE_H - 8, 4, 4);
    if (s.event === 'hurdles' && i === 0) {
      g.fillStyle = COLORS.gold;
      for (const h of HURDLES) g.fillRect(h - cam + 220, y + LANE_H - 36, 6, 30);
    }
    const hy = i === 0 ? s.jump : 0;
    g.fillStyle = i === 0 ? COLORS.cyan : [COLORS.coral, COLORS.gold, COLORS.purple][i - 1]!;
    g.fillRect(r.x - cam + 200, y + LANE_H - 54 - hy, 18, 40);
    g.fillStyle = COLORS.paper;
    g.fillRect(r.x - cam + 202, y + LANE_H - 66 - hy, 14, 14);
  });
  const fx = TRACK_LEN - cam + 220;
  g.fillStyle = COLORS.paper;
  g.fillRect(fx, top, 6, LANE_H * 4);

  g.fillStyle = COLORS.muted;
  g.fillRect(W / 2 - 150, 380, 300, 14);
  g.fillStyle = COLORS.gold;
  g.fillRect(W / 2 - 150, 380, (me.v / 520) * 300, 14);
  g.fillStyle = COLORS.paper;
  g.font = '14px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(s.event === 'dash' ? 'ALTERNATE LEFT / RIGHT' : 'ALTERNATE LEFT / RIGHT   A = JUMP', W / 2, 410);
  g.fillText(`NEXT: ${s.expect.toUpperCase()}`, W / 2, 440);
  g.fillText(`TIME ${s.clock.toFixed(2)}  /  QUALIFY ${s.qualify.toFixed(2)}`, W / 2, 56);
  hud(g, s, `ROUND ${s.round}  ${s.event.toUpperCase()}`, s.lives);
  if (s.countdown > 0) banner(g, s.countdown > 1 ? 'ON YOUR MARKS' : 'GO!', 480);
  if (s.finishDelay > 0 && !s.over) banner(g, s.result === 'qualified' ? 'QUALIFIED!' : 'MISSED THE CUT', 480);
  gameOver(g, s.over);
}

const game: GameDefinition<MasherState> = {
  id: 'sprint-masher',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.round),
};
export default game;
