import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, clear, gameOver, hud, makeStatus } from '../_shared/ui';

const START_LIVES = 3;
const SHOW_TIME = 0.5;
const GAP_TIME = 0.2;
const INPUT_TIMEOUT = 5;
const PAD_COLORS = [COLORS.cyan, COLORS.gold, COLORS.coral, COLORS.purple];

type Phase = 'show' | 'input' | 'pause';

export interface EchoState {
  seq: number[];
  phase: Phase;
  /** Index being shown or expected. */
  pos: number;
  timer: number;
  /** Pad currently lit (-1 for none). */
  lit: number;
  score: number;
  hi: number;
  lives: number;
  over: boolean;
}

function beginShow(s: EchoState): void {
  s.phase = 'show';
  s.pos = 0;
  s.timer = 0.7;
  s.lit = -1;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): EchoState {
  const s: EchoState = { seq: [rng.int(0, 3)], phase: 'show', pos: 0, timer: 0.7, lit: -1, score: 0, hi: hiScore, lives: START_LIVES, over: false };
  beginShow(s);
  return s;
}

const level = (s: EchoState) => s.seq.length;

function miss(s: EchoState, emit: UpdateContext['emit']): void {
  s.lives -= 1;
  s.lit = -1;
  emit('die');
  if (s.lives <= 0) s.over = true;
  else {
    s.phase = 'pause';
    s.timer = 1;
  }
}

function update(s: EchoState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }

  s.timer -= dt;
  if (s.phase === 'show') {
    if (s.timer <= 0) {
      if (s.lit >= 0) {
        // Finished lighting a pad: gap, then move to the next one.
        s.lit = -1;
        s.pos += 1;
        s.timer = GAP_TIME;
      } else if (s.pos >= s.seq.length) {
        s.phase = 'input';
        s.pos = 0;
        s.timer = INPUT_TIMEOUT;
      } else {
        s.lit = s.seq[s.pos]!;
        s.timer = Math.max(0.2, SHOW_TIME - s.seq.length * 0.01);
        emit('fire');
      }
    }
  } else if (s.phase === 'input') {
    const tapped = input.pressed.up ? 0 : input.pressed.right ? 1 : input.pressed.down ? 2 : input.pressed.left ? 3 : input.pressed.a ? 0 : input.pressed.b ? 2 : -1;
    s.lit = s.timer > INPUT_TIMEOUT - 0.15 && s.pos > 0 ? s.lit : -1;
    if (tapped >= 0) {
      if (tapped === s.seq[s.pos]) {
        s.lit = tapped;
        s.pos += 1;
        s.timer = INPUT_TIMEOUT;
        s.score += 10;
        emit('pickup');
        if (s.pos >= s.seq.length) {
          s.score += 100 * level(s);
          s.seq.push(rng.int(0, 3));
          emit('wave');
          s.phase = 'pause';
          s.timer = 0.9;
        }
      } else miss(s, emit);
    } else if (s.timer <= 0) miss(s, emit);
  } else if (s.timer <= 0) beginShow(s);
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: EchoState, g: CanvasRenderingContext2D): void {
  clear(g);
  const cx = W / 2;
  const cy = H / 2 - 10;
  const size = 130;
  const spots = [
    [cx, cy - size - 6], // up
    [cx + size + 6, cy], // right
    [cx, cy + size + 6], // down
    [cx - size - 6, cy], // left
  ] as const;
  spots.forEach(([x, y], i) => {
    g.globalAlpha = s.lit === i ? 1 : 0.28;
    g.fillStyle = PAD_COLORS[i]!;
    g.fillRect(x - size / 2, y - size / 2, size, size);
  });
  g.globalAlpha = 1;
  g.fillStyle = COLORS.paper;
  g.font = '14px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(s.phase === 'input' ? 'YOUR TURN' : s.phase === 'show' ? 'WATCH' : 'GET READY', cx, cy);
  hud(g, s, `ROUND ${level(s)}`, s.lives);
  gameOver(g, s.over);
}

const game: GameDefinition<EchoState> = {
  id: 'echo-tones',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, level(s)),
};
export default game;
