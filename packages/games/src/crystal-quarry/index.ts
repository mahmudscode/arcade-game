import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { heldDir } from '../_shared/walker';

const COLS = 32;
const ROWS = 18;
const CELL = 24;
const OX = (W - COLS * CELL) / 2;
const OY = 76;
/** The cave advances in fixed ticks, like the arcade original. */
const STEP = 0.1;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 5000;
const EMPTY = 0;
const DIRT = 1;
const WALL = 2;
const ROCK = 3;
const GEM = 4;
const EXIT = 5;

interface Fly {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface QuarryState {
  grid: number[];
  /** 1 while a rock/gem is in motion (only a moving rock crushes). */
  fall: number[];
  me: { x: number; y: number; alive: boolean; fx: number };
  flies: Fly[];
  sparks: Spark[];
  got: number;
  need: number;
  open: boolean;
  time: number;
  acc: number;
  tick: number;
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
const cellAt = (s: QuarryState, x: number, y: number) => (inside(x, y) ? s.grid[idx(x, y)]! : WALL);
const flyAt = (s: QuarryState, x: number, y: number) => s.flies.findIndex((f) => f.x === x && f.y === y);
const px = (x: number) => OX + x * CELL;
const py = (y: number) => OY + y * CELL;

function buildLevel(s: QuarryState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return WALL;
    const r = rng.next();
    return r < 0.17 ? ROCK : r < 0.25 ? GEM : DIRT;
  });
  // A few inner wall bars.
  for (let k = 0; k < 4; k++) {
    const y = rng.int(4, ROWS - 4);
    const x0 = rng.int(3, COLS - 12);
    for (let x = x0; x < x0 + rng.int(4, 8); x++) s.grid[idx(x, y)] = WALL;
  }
  s.fall = s.grid.map(() => 0);
  // Clear the start nook and place the exit far away.
  for (let y = 1; y <= 2; y++) for (let x = 1; x <= 3; x++) s.grid[idx(x, y)] = EMPTY;
  s.grid[idx(COLS - 2, ROWS - 2)] = EXIT;
  s.grid[idx(COLS - 3, ROWS - 2)] = DIRT;
  s.grid[idx(COLS - 2, ROWS - 3)] = DIRT;
  // Make sure there are more gems than the quota.
  s.need = Math.min(10 + s.level * 2, 28);
  let gems = s.grid.filter((c) => c === GEM).length;
  for (let tries = 0; gems < s.need + 8 && tries < 500; tries++) {
    const i = idx(rng.int(1, COLS - 2), rng.int(1, ROWS - 2));
    if (s.grid[i] === DIRT || s.grid[i] === ROCK) {
      s.grid[i] = GEM;
      gems += 1;
    }
  }
  s.flies = [];
  const want = Math.min(1 + Math.floor(s.level / 2), 4);
  for (let tries = 0; s.flies.length < want && tries < 300; tries++) {
    const x = rng.int(6, COLS - 4);
    const y = rng.int(3, ROWS - 3);
    if (s.grid[idx(x, y)] === WALL || s.grid[idx(x, y)] === EXIT) continue;
    // Carve a little cave for it to patrol.
    for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 0; dy++) if (s.grid[idx(x + dx, y + dy)] !== WALL) s.grid[idx(x + dx, y + dy)] = EMPTY;
    s.flies.push({ x, y, dx: 1, dy: 0 });
  }
  s.me = { x: 1, y: 1, alive: true, fx: 1 };
  s.got = 0;
  s.open = false;
  s.time = 150;
  s.acc = 0;
  s.tick = 0;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): QuarryState {
  const s: QuarryState = {
    grid: [],
    fall: [],
    me: { x: 1, y: 1, alive: true, fx: 1 },
    flies: [],
    sparks: [],
    got: 0,
    need: 0,
    open: false,
    time: 150,
    acc: 0,
    tick: 0,
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

function killPlayer(s: QuarryState, rng: Rng, emit: UpdateContext['emit']): void {
  if (!s.me.alive) return;
  burst(s.sparks, rng, px(s.me.x) + CELL / 2, py(s.me.y) + CELL / 2, COLORS.gold, 24);
  s.me.alive = false;
  s.lives -= 1;
  s.respawn = 1.6;
  emit('die');
  if (s.lives <= 0) s.over = true;
}

/** A firefly crushed or blown up turns the surrounding 3x3 into gems. */
function explode(s: QuarryState, cx: number, cy: number, rng: Rng, emit: UpdateContext['emit']): void {
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (!inside(x, y) || s.grid[idx(x, y)] === WALL || s.grid[idx(x, y)] === EXIT) continue;
      s.grid[idx(x, y)] = GEM;
      s.fall[idx(x, y)] = 0;
      if (s.me.alive && s.me.x === x && s.me.y === y) killPlayer(s, rng, emit);
    }
  }
  burst(s.sparks, rng, px(cx) + CELL / 2, py(cy) + CELL / 2, COLORS.coral, 20);
  emit('explode');
}

function movePlayer(s: QuarryState, input: Input, emit: UpdateContext['emit']): boolean {
  const d = heldDir(input.held);
  if (!d || !s.me.alive) return false;
  const [dx, dy] = d;
  if (dx !== 0) s.me.fx = dx;
  const nx = s.me.x + dx;
  const ny = s.me.y + dy;
  const c = cellAt(s, nx, ny);
  const step = () => {
    s.me.x = nx;
    s.me.y = ny;
  };
  if (c === EMPTY || c === DIRT) {
    s.grid[idx(nx, ny)] = EMPTY;
    step();
  } else if (c === GEM) {
    s.grid[idx(nx, ny)] = EMPTY;
    s.got += 1;
    s.score += s.open ? 15 : 10;
    if (!s.open && s.got >= s.need) {
      s.open = true;
      emit('wave');
    } else emit('pickup');
    step();
  } else if (c === ROCK && dy === 0 && cellAt(s, nx + dx, ny) === EMPTY && flyAt(s, nx + dx, ny) < 0) {
    s.grid[idx(nx + dx, ny)] = ROCK;
    s.grid[idx(nx, ny)] = EMPTY;
    s.fall[idx(nx, ny)] = 0;
    step();
    emit('fire');
  } else if (c === EXIT && s.open) {
    step();
    return true;
  }
  return false;
}

function stepRocks(s: QuarryState, rng: Rng, emit: UpdateContext['emit']): void {
  const moved = new Set<number>();
  for (let y = ROWS - 2; y >= 1; y--) {
    for (let x = 1; x < COLS - 1; x++) {
      const i = idx(x, y);
      const kind = s.grid[i]!;
      if ((kind !== ROCK && kind !== GEM) || moved.has(i)) continue;
      const below = idx(x, y + 1);
      const meBelow = s.me.alive && s.me.x === x && s.me.y === y + 1;
      const flyBelow = flyAt(s, x, y + 1);
      if (s.grid[below] === EMPTY && !meBelow && flyBelow < 0) {
        s.grid[below] = kind;
        s.grid[i] = EMPTY;
        s.fall[below] = 1;
        s.fall[i] = 0;
        moved.add(below);
      } else if (s.fall[i] === 1 && (meBelow || flyBelow >= 0)) {
        // Only a rock that is already falling crushes what it lands on.
        s.grid[i] = EMPTY;
        s.fall[i] = 0;
        if (meBelow) {
          s.grid[below] = kind; // the rock lands where the digger stood
          killPlayer(s, rng, emit);
        } else {
          const f = s.flies[flyBelow]!;
          s.flies.splice(flyBelow, 1);
          s.score += 100;
          explode(s, f.x, f.y, rng, emit);
        }
      } else if (s.grid[below] === ROCK || s.grid[below] === GEM) {
        // Rocks roll off the shoulders of other rocks.
        const canRoll = (nx: number) => s.grid[idx(nx, y)] === EMPTY && s.grid[idx(nx, y + 1)] === EMPTY && !(s.me.alive && s.me.x === nx && (s.me.y === y || s.me.y === y + 1)) && flyAt(s, nx, y) < 0 && flyAt(s, nx, y + 1) < 0;
        const dir = canRoll(x - 1) ? -1 : canRoll(x + 1) ? 1 : 0;
        if (dir !== 0) {
          s.grid[idx(x + dir, y)] = kind;
          s.grid[i] = EMPTY;
          s.fall[idx(x + dir, y)] = 1;
          s.fall[i] = 0;
          moved.add(idx(x + dir, y));
        } else s.fall[i] = 0;
      } else s.fall[i] = 0;
    }
  }
}

function stepFlies(s: QuarryState, rng: Rng, emit: UpdateContext['emit']): void {
  for (const f of s.flies) {
    const free = (x: number, y: number) => cellAt(s, x, y) === EMPTY;
    // Left-hand wall follower: prefer turning left, then straight, then right, then back.
    const tries: [number, number][] = [[f.dy, 0 - f.dx], [f.dx, f.dy], [0 - f.dy, f.dx], [0 - f.dx, 0 - f.dy]];
    for (const [dx, dy] of tries) {
      if (free(f.x + dx, f.y + dy) || (s.me.alive && s.me.x === f.x + dx && s.me.y === f.y + dy)) {
        f.dx = dx;
        f.dy = dy;
        f.x += dx;
        f.y += dy;
        break;
      }
    }
    if (s.me.alive && s.me.x === f.x && s.me.y === f.y) killPlayer(s, rng, emit);
  }
}

function update(s: QuarryState, input: Input, dt: number, ctx: UpdateContext): void {
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
  if (!s.me.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) buildLevel(s, rng);
    return;
  }

  s.time -= dt;
  if (s.time <= 0) {
    s.time = 0;
    killPlayer(s, rng, emit);
    return;
  }
  s.acc += dt;
  while (s.acc >= STEP - 1e-9 && s.me.alive && s.levelDelay <= 0) {
    s.acc -= STEP;
    s.tick += 1;
    if (movePlayer(s, input, emit)) {
      s.score += Math.floor(s.time) * 5;
      s.levelDelay = 1.6;
      emit('wave');
      break;
    }
    stepRocks(s, rng, emit);
    if (s.tick % 2 === 0) stepFlies(s, rng, emit);
  }
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: QuarryState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      const X = px(x);
      const Y = py(y);
      if (c === WALL) {
        g.fillStyle = COLORS.purple;
        g.fillRect(X + 1, Y + 1, CELL - 2, CELL - 2);
      } else if (c === DIRT) {
        g.fillStyle = '#6b4a2f';
        g.fillRect(X, Y, CELL, CELL);
        g.fillStyle = '#7d5a3c';
        g.fillRect(X + 5 + ((x * 7 + y * 3) % 9), Y + 6 + ((x * 5 + y) % 9), 4, 3);
      } else if (c === ROCK) {
        g.fillStyle = COLORS.muted;
        g.beginPath();
        g.arc(X + CELL / 2, Y + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(X + 12, Y + 12, 5, 5);
      } else if (c === GEM) {
        g.fillStyle = Math.floor(time * 4 + x) % 2 ? COLORS.cyan : COLORS.paper;
        g.beginPath();
        g.moveTo(X + CELL / 2, Y + 2);
        g.lineTo(X + CELL - 3, Y + CELL / 2);
        g.lineTo(X + CELL / 2, Y + CELL - 2);
        g.lineTo(X + 3, Y + CELL / 2);
        g.closePath();
        g.fill();
      } else if (c === EXIT) {
        g.fillStyle = s.open ? (Math.floor(time * 6) % 2 ? COLORS.gold : COLORS.paper) : COLORS.muted;
        g.fillRect(X + 2, Y + 2, CELL - 4, CELL - 4);
      }
    }
  }
  for (const f of s.flies) {
    g.fillStyle = COLORS.coral;
    g.fillRect(px(f.x) + 4, py(f.y) + 4, CELL - 8, CELL - 8);
    g.fillStyle = COLORS.gold;
    g.fillRect(px(f.x) + 9, py(f.y) + 9, 6, 6);
  }
  if (s.me.alive) {
    g.fillStyle = COLORS.gold;
    g.fillRect(px(s.me.x) + 4, py(s.me.y) + 3, CELL - 8, CELL - 6);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(s.me.x) + 8 + s.me.fx * 3, py(s.me.y) + 8, 3, 4);
    g.fillRect(px(s.me.x) + 13 + s.me.fx * 3, py(s.me.y) + 8, 3, 4);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  GEMS ${Math.min(s.got, s.need)}/${s.need}  TIME ${Math.ceil(s.time)}`, s.lives);
  if (s.open && s.levelDelay <= 0) banner(g, 'EXIT OPEN!', 40);
  if (s.levelDelay > 0) banner(g, 'CAVE CLEARED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<QuarryState> = {
  id: 'crystal-quarry',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
