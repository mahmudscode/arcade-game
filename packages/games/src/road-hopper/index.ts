import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const CELL_W = 50;
const CELL_H = 44;
const OY = 20;
const COLS = 16;
const START_ROW = 11;
const START_LIVES = 3;
const TIME_LIMIT = 30;
const MAX_LEVEL = 20;
const SLOTS = [1.5, 4.5, 8, 11.5, 14.5].map((c) => c * CELL_W);
const SLOT_TOL = 34;

interface Lane {
  row: number;
  kind: 'car' | 'log';
  dir: 1 | -1;
  speed: number;
  width: number;
  period: number;
  /** Left edge of each object. */
  objs: number[];
}

export interface HopperState {
  lanes: Lane[];
  frog: { x: number; row: number; alive: boolean };
  best: number;
  home: boolean[];
  time: number;
  respawn: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  levelDelay: number;
}

function buildLanes(level: number, rng: Rng): Lane[] {
  const boost = 1 + Math.min(level - 1, MAX_LEVEL) * 0.08;
  const defs: { row: number; kind: 'car' | 'log'; speed: number; width: number; n: number }[] = [
    { row: 1, kind: 'log', speed: 70, width: 170, n: 3 },
    { row: 2, kind: 'log', speed: 110, width: 120, n: 3 },
    { row: 3, kind: 'log', speed: 60, width: 230, n: 2 },
    { row: 4, kind: 'log', speed: 95, width: 140, n: 3 },
    { row: 5, kind: 'log', speed: 80, width: 170, n: 3 },
    { row: 7, kind: 'car', speed: 90, width: 60, n: 3 },
    { row: 8, kind: 'car', speed: 140, width: 50, n: 3 },
    { row: 9, kind: 'car', speed: 70, width: 90, n: 2 },
    { row: 10, kind: 'car', speed: 110, width: 60, n: 3 },
  ];
  return defs.map((d, i) => {
    const period = W + 260;
    const offset = rng.range(0, period / d.n);
    return {
      row: d.row,
      kind: d.kind,
      dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
      speed: d.speed * (d.kind === 'car' ? boost : 1 + (boost - 1) * 0.5),
      width: d.width,
      period,
      objs: Array.from({ length: d.n }, (_, k) => offset + (k * period) / d.n - d.width),
    };
  });
}

function resetFrog(s: HopperState): void {
  s.frog = { x: W / 2 - CELL_W / 2 + CELL_W / 2, row: START_ROW, alive: true };
  s.best = START_ROW;
  s.time = TIME_LIMIT;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): HopperState {
  const s: HopperState = {
    lanes: buildLanes(1, rng),
    frog: { x: 0, row: START_ROW, alive: true },
    best: START_ROW,
    home: SLOTS.map(() => false),
    time: TIME_LIMIT,
    respawn: 0,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    levelDelay: 0,
  };
  resetFrog(s);
  return s;
}

function die(s: HopperState, rng: Rng, emit: UpdateContext['emit']): void {
  s.frog.alive = false;
  s.lives -= 1;
  s.respawn = 1.1;
  burst(s.sparks, rng, s.frog.x, OY + s.frog.row * CELL_H + CELL_H / 2, COLORS.coral, 20);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: HopperState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  for (const lane of s.lanes) {
    lane.objs = lane.objs.map((x) => ((x + lane.dir * lane.speed * dt + lane.width + lane.period) % lane.period) - lane.width);
  }

  const f = s.frog;
  if (!f.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0 && s.lives > 0) resetFrog(s);
  } else if (s.levelDelay <= 0) {
    s.time -= dt;
    if (s.time <= 0) die(s, rng, emit);

    if (f.alive) {
      if (input.pressed.up) f.row -= 1;
      else if (input.pressed.down) f.row = Math.min(START_ROW, f.row + 1);
      else if (input.pressed.left) f.x -= CELL_W;
      else if (input.pressed.right) f.x += CELL_W;
      if (f.row < s.best) {
        s.best = f.row;
        s.score += 10;
        emit('fire');
      }
      f.x = Math.min(W - CELL_W / 2, Math.max(CELL_W / 2, f.x));

      const lane = s.lanes.find((l) => l.row === f.row);
      if (lane?.kind === 'log') {
        const log = lane.objs.find((x) => f.x >= x && f.x <= x + lane.width);
        if (log === undefined) die(s, rng, emit);
        else {
          f.x += lane.dir * lane.speed * dt;
          if (f.x < 0 || f.x > W) die(s, rng, emit);
        }
      } else if (lane?.kind === 'car') {
        if (lane.objs.some((x) => f.x + 14 >= x && f.x - 14 <= x + lane.width)) die(s, rng, emit);
      } else if (f.row === 0) {
        const slot = SLOTS.findIndex((x, i) => !s.home[i] && Math.abs(f.x - x) <= SLOT_TOL);
        if (slot >= 0) {
          s.home[slot] = true;
          s.score += 50 + Math.floor(s.time) * 5;
          emit('pickup');
          if (s.home.every(Boolean)) {
            s.levelDelay = 1.4;
            s.score += 1000;
          } else resetFrog(s);
        } else die(s, rng, emit);
      }
    }
  }

  stepSparks(s.sparks, dt);

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level = Math.min(s.level + 1, MAX_LEVEL);
      s.home = SLOTS.map(() => false);
      s.lanes = buildLanes(s.level, rng);
      resetFrog(s);
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: HopperState, g: CanvasRenderingContext2D): void {
  clear(g);
  const y = (row: number) => OY + row * CELL_H;
  // River, road and safe strips.
  g.fillStyle = '#1b2a6b';
  g.fillRect(0, y(1), W, CELL_H * 5);
  g.fillStyle = '#2a2147';
  g.fillRect(0, y(7), W, CELL_H * 4);
  g.fillStyle = COLORS.purple;
  g.fillRect(0, y(6), W, CELL_H);
  g.fillRect(0, y(11), W, CELL_H);
  g.fillStyle = '#16301f';
  g.fillRect(0, y(0), W, CELL_H);
  SLOTS.forEach((x, i) => {
    g.fillStyle = s.home[i] ? COLORS.cyan : COLORS.bg;
    g.fillRect(x - 24, y(0) + 6, 48, CELL_H - 12);
  });

  for (const lane of s.lanes) {
    for (const x of lane.objs) {
      g.fillStyle = lane.kind === 'log' ? '#8a5a2b' : lane.row % 2 ? COLORS.coral : COLORS.gold;
      g.fillRect(x, y(lane.row) + 6, lane.width, CELL_H - 12);
    }
  }

  if (s.frog.alive) {
    g.fillStyle = '#7BE495';
    g.fillRect(s.frog.x - 14, y(s.frog.row) + 8, 28, CELL_H - 16);
    g.fillStyle = COLORS.bg;
    g.fillRect(s.frog.x - 8, y(s.frog.row) + 10, 5, 5);
    g.fillRect(s.frog.x + 3, y(s.frog.row) + 10, 5, 5);
  }
  drawSparks(g, s.sparks);

  g.fillStyle = COLORS.gold;
  g.fillRect(W - 200, H - 22, Math.max(0, (s.time / TIME_LIMIT) * 170), 8);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'ALL HOME!', 260);
  gameOver(g, s.over);
}

const game: GameDefinition<HopperState> = {
  id: 'road-hopper',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
