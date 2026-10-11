import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, GEM_COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const R = 20;
const RH = 35;
const COLS = 11;
const ROWS = 14;
/** Bubbles at or below this row end the game. */
const DANGER_ROW = 12;
const TOP = 36;
const OX = (W - COLS * 2 * R) / 2;
const SX = W / 2;
const SY = 525;
const MAX_AIM = 1.3;
const SHOT_SPEED = 900;

export interface PopperState {
  /** rows * COLS bubble colours, 0 = empty. Odd (indented) rows only use COLS - 1 columns. */
  grid: number[];
  /** Flips each time a row is added on top, so existing rows keep their indentation. */
  par: number;
  aim: number;
  current: number;
  next: number;
  flight: { active: boolean; x: number; y: number; vx: number; vy: number; color: number };
  falling: { x: number; y: number; vy: number; color: number }[];
  sparks: Spark[];
  misses: number;
  palette: number;
  levelDelay: number;
  score: number;
  hi: number;
  level: number;
  over: boolean;
}

const indented = (s: PopperState, r: number) => ((r + s.par) & 1) === 1;
const rowLen = (s: PopperState, r: number) => (indented(s, r) ? COLS - 1 : COLS);
const cellX = (s: PopperState, r: number, c: number) => OX + R + c * 2 * R + (indented(s, r) ? R : 0);
const cellY = (r: number) => TOP + R + r * RH;
const at = (s: PopperState, r: number, c: number) => s.grid[r * COLS + c]!;
const missLimit = (level: number) => Math.max(4, 8 - level);

function neighbours(s: PopperState, r: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  if (c > 0) out.push([r, c - 1]);
  if (c < rowLen(s, r) - 1) out.push([r, c + 1]);
  for (const r2 of [r - 1, r + 1]) {
    if (r2 < 0 || r2 >= ROWS) continue;
    for (let c2 = 0; c2 < rowLen(s, r2); c2++) if (Math.abs(cellX(s, r2, c2) - cellX(s, r, c)) < R + 1) out.push([r2, c2]);
  }
  return out;
}

/** Colours still on the board, so the next bubble is always useful. */
function presentColors(s: PopperState): number[] {
  const set = new Set<number>();
  for (const v of s.grid) if (v > 0) set.add(v);
  return [...set].sort((a, b) => a - b);
}

function drawColor(s: PopperState, rng: Rng): number {
  const pool = presentColors(s);
  return pool.length > 0 ? rng.pick(pool) : rng.int(1, s.palette);
}

function fillRow(s: PopperState, r: number, rng: Rng): void {
  for (let c = 0; c < rowLen(s, r); c++) s.grid[r * COLS + c] = rng.int(1, s.palette);
}

function buildLevel(s: PopperState, rng: Rng): void {
  s.grid = Array.from({ length: ROWS * COLS }, () => 0);
  s.par = 0;
  s.palette = Math.min(3 + Math.floor(s.level / 2), 6);
  const rows = Math.min(4 + s.level, 9);
  for (let r = 0; r < rows; r++) fillRow(s, r, rng);
  s.misses = 0;
  s.flight.active = false;
  s.falling = [];
  s.current = drawColor(s, rng);
  s.next = drawColor(s, rng);
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): PopperState {
  const s: PopperState = {
    grid: [],
    par: 0,
    aim: 0,
    current: 1,
    next: 1,
    flight: { active: false, x: SX, y: SY, vx: 0, vy: 0, color: 1 },
    falling: [],
    sparks: [],
    misses: 0,
    palette: 3,
    levelDelay: 0,
    score: 0,
    hi: hiScore,
    level: 1,
    over: false,
  };
  buildLevel(s, rng);
  return s;
}

/** Puts the bubble in the empty cell nearest to (x, y), then resolves matches and floating clusters. */
function land(s: PopperState, x: number, y: number, color: number, rng: Rng, emit: UpdateContext['emit']): void {
  const r0 = Math.round((y - TOP - R) / RH);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let r = Math.max(0, r0 - 2); r <= Math.min(ROWS - 1, r0 + 2); r++) {
    for (let c = 0; c < rowLen(s, r); c++) {
      if (at(s, r, c) !== 0) continue;
      const d = Math.hypot(cellX(s, r, c) - x, cellY(r) - y);
      if (d < bestD) {
        bestD = d;
        best = [r, c];
      }
    }
  }
  if (!best) {
    s.over = true;
    return;
  }
  const [pr, pc] = best;
  s.grid[pr * COLS + pc] = color;

  // Flood the matching colour.
  const group = [[pr, pc]] as [number, number][];
  const seen = new Set<number>([pr * COLS + pc]);
  for (let k = 0; k < group.length; k++) {
    for (const [nr, nc] of neighbours(s, group[k]![0], group[k]![1])) {
      if (at(s, nr, nc) === color && !seen.has(nr * COLS + nc)) {
        seen.add(nr * COLS + nc);
        group.push([nr, nc]);
      }
    }
  }
  if (group.length >= 3) {
    for (const [r, c] of group) {
      burst(s.sparks, rng, cellX(s, r, c), cellY(r), GEM_COLORS[(color - 1) % GEM_COLORS.length]!, 4);
      s.grid[r * COLS + c] = 0;
    }
    s.score += group.length * 10 + Math.max(0, group.length - 3) * 10;
    s.misses = 0;
    emit('explode');
    // Anything no longer attached to the ceiling falls.
    const held = new Set<number>();
    const queue: [number, number][] = [];
    for (let c = 0; c < rowLen(s, 0); c++) if (at(s, 0, c) !== 0) (held.add(c), queue.push([0, c]));
    for (let k = 0; k < queue.length; k++) {
      for (const [nr, nc] of neighbours(s, queue[k]![0], queue[k]![1])) {
        if (at(s, nr, nc) !== 0 && !held.has(nr * COLS + nc)) {
          held.add(nr * COLS + nc);
          queue.push([nr, nc]);
        }
      }
    }
    let dropped = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < rowLen(s, r); c++) {
        if (at(s, r, c) !== 0 && !held.has(r * COLS + c)) {
          s.falling.push({ x: cellX(s, r, c), y: cellY(r), vy: 0, color: at(s, r, c) });
          s.grid[r * COLS + c] = 0;
          dropped += 1;
        }
      }
    }
    if (dropped > 0) {
      s.score += dropped * 30;
      emit('wave');
    }
  } else {
    s.misses += 1;
    emit('pickup');
    if (s.misses >= missLimit(s.level)) {
      // The ceiling creeps down: shift everything one row and add a fresh row on top.
      s.grid.splice(0, 0, ...Array.from({ length: COLS }, () => 0));
      s.grid.length = ROWS * COLS;
      s.par = (s.par + 1) & 1;
      fillRow(s, 0, rng);
      s.misses = 0;
      emit('die');
    }
  }
  for (let r = DANGER_ROW; r < ROWS; r++) for (let c = 0; c < rowLen(s, r); c++) if (at(s, r, c) !== 0) s.over = true;
}

function update(s: PopperState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  stepSparks(s.sparks, dt);
  for (let i = s.falling.length - 1; i >= 0; i--) {
    const f = s.falling[i]!;
    f.vy += 1400 * dt;
    f.y += f.vy * dt;
    if (f.y > H + 30) s.falling.splice(i, 1);
  }
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
      s.score += 1000;
      buildLevel(s, rng);
      emit('wave');
    }
    return;
  }

  if (input.held.left) s.aim = Math.max(-MAX_AIM, s.aim - 1.7 * dt);
  if (input.held.right) s.aim = Math.min(MAX_AIM, s.aim + 1.7 * dt);
  if (input.pressed.b && !s.flight.active) [s.current, s.next] = [s.next, s.current];

  const f = s.flight;
  if (!f.active && (input.pressed.a || input.pressed.up)) {
    f.active = true;
    f.x = SX;
    f.y = SY;
    f.vx = Math.sin(s.aim) * SHOT_SPEED;
    f.vy = 0 - Math.cos(s.aim) * SHOT_SPEED;
    f.color = s.current;
    s.current = s.next;
    s.next = drawColor(s, rng);
    emit('fire');
  }

  if (f.active) {
    const steps = Math.ceil((SHOT_SPEED * dt) / 6);
    for (let k = 0; k < steps && f.active; k++) {
      f.x += (f.vx * dt) / steps;
      f.y += (f.vy * dt) / steps;
      if (f.x < OX + R) {
        f.x = OX + R;
        f.vx = 0 - f.vx;
      } else if (f.x > OX + COLS * 2 * R - R) {
        f.x = OX + COLS * 2 * R - R;
        f.vx = 0 - f.vx;
      }
      let hit = f.y <= TOP + R;
      if (!hit) {
        const r0 = Math.round((f.y - TOP - R) / RH);
        for (let r = Math.max(0, r0 - 2); r <= Math.min(ROWS - 1, r0 + 2) && !hit; r++) {
          for (let c = 0; c < rowLen(s, r); c++) {
            if (at(s, r, c) !== 0 && Math.hypot(cellX(s, r, c) - f.x, cellY(r) - f.y) < 2 * R - 4) {
              hit = true;
              break;
            }
          }
        }
      }
      if (hit) {
        f.active = false;
        land(s, f.x, f.y, f.color, rng, emit);
      }
    }
  }

  if (!s.over && !s.flight.active && s.grid.every((v) => v === 0)) s.levelDelay = 1.5;
  if (s.score > s.hi) s.hi = s.score;
}

function bubble(g: CanvasRenderingContext2D, x: number, y: number, color: number): void {
  g.fillStyle = GEM_COLORS[(color - 1) % GEM_COLORS.length]!;
  g.beginPath();
  g.arc(x, y, R - 2, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(x - 8, y - 9, 6, 4);
}

function render(s: PopperState, g: CanvasRenderingContext2D): void {
  clear(g);
  g.strokeStyle = COLORS.muted;
  g.lineWidth = 2;
  g.strokeRect(OX - 2, TOP - 2, COLS * 2 * R + 4, SY + 40 - TOP);
  g.strokeStyle = 'rgba(255,93,115,0.5)';
  g.beginPath();
  g.moveTo(OX, cellY(DANGER_ROW) - R);
  g.lineTo(OX + COLS * 2 * R, cellY(DANGER_ROW) - R);
  g.stroke();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < rowLen(s, r); c++) if (at(s, r, c) !== 0) bubble(g, cellX(s, r, c), cellY(r), at(s, r, c));
  for (const f of s.falling) bubble(g, f.x, f.y, f.color);
  // Aim guide and cannon.
  g.strokeStyle = 'rgba(246,239,255,0.35)';
  g.beginPath();
  g.moveTo(SX, SY);
  g.lineTo(SX + Math.sin(s.aim) * 120, SY - Math.cos(s.aim) * 120);
  g.stroke();
  g.fillStyle = COLORS.muted;
  g.beginPath();
  g.arc(SX, SY, 26, Math.PI, 0);
  g.fill();
  if (s.flight.active) bubble(g, s.flight.x, s.flight.y, s.flight.color);
  else bubble(g, SX, SY, s.current);
  g.fillStyle = COLORS.muted;
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('NEXT', OX + COLS * 2 * R + 40, SY - 30);
  bubble(g, OX + COLS * 2 * R + 60, SY + 10, s.next);
  g.fillText(`SHOTS ${missLimit(s.level) - s.misses}`, 40, SY - 10);
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}`);
  if (s.levelDelay > 0) banner(g, 'BOARD CLEARED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<PopperState> = {
  id: 'orb-popper',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : 1, s.level),
};
export default game;
