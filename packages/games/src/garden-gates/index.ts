import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, clear, gameOver, hud, makeStatus } from '../_shared/ui';
import { MCOLS, MROWS, generateMaze } from '../_shared/maze-chase';
import { DIRS, heldDir, isReverse, newWalker, reverseWalker, stepWalker, walkerPos, type Walker } from '../_shared/walker';

const CELL = 26;
const OX = (W - MCOLS * CELL) / 2;
const OY = 36;
const START = { x: 10, y: 13 };
const BUG_STARTS = [{ x: 9, y: 9 }, { x: 11, y: 9 }, { x: 9, y: 7 }, { x: 11, y: 7 }];
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const GATE_OPEN_TIME = 2.6;
const BUG_COLORS = [COLORS.coral, COLORS.purple, COLORS.cyan, COLORS.gold];

interface Gate {
  x: number;
  y: number;
  /** Seconds left open; 0 means closed (a wall to everyone). */
  open: number;
  /** 0 = sits in a horizontal corridor, 1 = vertical. */
  axis: number;
}
interface Bug extends Walker {
  wait: number;
  home: { x: number; y: number };
}

export interface GardenState {
  /** 0 floor, 1 wall, 2 dot, 3 heart. */
  grid: number[];
  gates: Gate[];
  me: Walker;
  bugs: Bug[];
  blossom: number;
  eaten: number;
  dots: number;
  dotsEaten: number;
  veg: { x: number; y: number; ttl: number };
  vegShown: boolean;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const idx = (x: number, y: number) => y * MCOLS + x;
const isWall = (s: GardenState, x: number, y: number) => x < 0 || y < 0 || x >= MCOLS || y >= MROWS || s.grid[idx(x, y)] === 1;
const gateAt = (s: GardenState, x: number, y: number) => s.gates.find((g) => g.x === x && g.y === y);
/** Can a walker step into (x, y)? Closed gates are walls. */
const passable = (s: GardenState, x: number, y: number) => {
  if (isWall(s, x, y)) return false;
  const g = gateAt(s, x, y);
  return !g || g.open > 0;
};

function placeGates(s: GardenState, rng: Rng): void {
  const open = (x: number, y: number) => !isWall(s, x, y);
  const cands: Gate[] = [];
  for (let y = 1; y < MROWS - 1; y++) {
    for (let x = 1; x < MCOLS - 1; x++) {
      if (!open(x, y)) continue;
      if ([START, ...BUG_STARTS].some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 4)) continue;
      const h = open(x - 1, y) && open(x + 1, y) && !open(x, y - 1) && !open(x, y + 1);
      const v = open(x, y - 1) && open(x, y + 1) && !open(x - 1, y) && !open(x + 1, y);
      if (h || v) cands.push({ x, y, open: 0, axis: h ? 0 : 1 });
    }
  }
  const want = Math.min(8 + s.level, 14);
  s.gates = [];
  while (s.gates.length < want && cands.length > 0) {
    const g = cands.splice(rng.int(0, cands.length - 1), 1)[0]!;
    // Keep gates apart so a corridor never ends up a string of doors.
    if (s.gates.some((o) => Math.abs(o.x - g.x) + Math.abs(o.y - g.y) < 3)) continue;
    s.gates.push(g);
  }
}

function setupActors(s: GardenState): void {
  s.me = newWalker(START.x, START.y);
  s.bugs = BUG_STARTS.slice(0, Math.min(3 + Math.floor(s.level / 4), 4)).map((p, i) => ({ ...newWalker(p.x, p.y), wait: 1 + i * 2.5, home: p }));
  s.blossom = 0;
  s.eaten = 0;
  s.veg = { x: START.x, y: 5, ttl: 0 };
}

function newLevel(s: GardenState, rng: Rng): void {
  s.grid = generateMaze(rng);
  s.dots = s.grid.filter((c) => c === 2 || c === 3).length;
  s.dotsEaten = 0;
  s.vegShown = false;
  placeGates(s, rng);
  setupActors(s);
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): GardenState {
  const s: GardenState = {
    grid: [],
    gates: [],
    me: newWalker(START.x, START.y),
    bugs: [],
    blossom: 0,
    eaten: 0,
    dots: 0,
    dotsEaten: 0,
    veg: { x: START.x, y: 5, ttl: 0 },
    vegShown: false,
    respawn: 1.5,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  newLevel(s, rng);
  return s;
}

/** Shortest-path first step from (fx, fy) toward (tx, ty), treating closed gates as walls. */
function pathStep(s: GardenState, fx: number, fy: number, tx: number, ty: number): readonly [number, number] | null {
  const dist = new Array<number>(MCOLS * MROWS).fill(-1);
  const queue = [idx(tx, ty)];
  dist[idx(tx, ty)] = 0;
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h]!;
    const cx = c % MCOLS;
    const cy = Math.floor(c / MCOLS);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!passable(s, nx, ny) || dist[idx(nx, ny)] !== -1) continue;
      dist[idx(nx, ny)] = dist[c]! + 1;
      queue.push(idx(nx, ny));
    }
  }
  let best: readonly [number, number] | null = null;
  let bestD = Infinity;
  for (const d of DIRS) {
    const nx = fx + d[0];
    const ny = fy + d[1];
    if (!passable(s, nx, ny)) continue;
    const dd = dist[idx(nx, ny)]!;
    if (dd >= 0 && dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

function chooseBugDir(s: GardenState, w: Bug, rng: Rng): readonly [number, number] | null {
  const options = DIRS.filter(([dx, dy]) => passable(s, w.tx + dx, w.ty + dy));
  const forward = options.filter(([dx, dy]) => !isReverse(w, dx, dy));
  const pool = forward.length > 0 ? forward : options;
  if (pool.length === 0) return null;
  if (s.blossom > 0 || rng.next() < 0.18) return rng.pick(pool);
  return pathStep(s, w.tx, w.ty, s.me.tx, s.me.ty) ?? rng.pick(pool);
}

function update(s: GardenState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    return;
  }
  if (s.respawn > 0) {
    s.respawn -= dt;
    return;
  }
  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      s.score += 500;
      newLevel(s, rng);
      s.respawn = 1.2;
      emit('wave');
    }
    return;
  }

  // Gates swing shut again unless something is standing in them.
  for (const g of s.gates) {
    if (g.open <= 0) continue;
    const occupied = [s.me, ...s.bugs].some((w) => (w.tx === g.x && w.ty === g.y) || (w.tx + w.dx === g.x && w.ty + w.dy === g.y));
    g.open = occupied ? Math.max(g.open - dt, 0.3) : Math.max(0, g.open - dt);
  }

  const me = s.me;
  const want = heldDir(input.held);
  if (want && me.dx === -want[0] && me.dy === -want[1]) reverseWalker(me);
  stepWalker(
    me,
    5,
    dt,
    () => {
      if (!want) return null;
      const g = gateAt(s, me.tx + want[0], me.ty + want[1]);
      if (g && g.open <= 0 && !isWall(s, g.x, g.y)) {
        g.open = GATE_OPEN_TIME;
        emit('pickup');
        return null;
      }
      return want;
    },
    (x, y, dx, dy) => passable(s, x + dx, y + dy),
    (w) => {
      const c = s.grid[idx(w.tx, w.ty)];
      if (c === 2 || c === 3) {
        s.grid[idx(w.tx, w.ty)] = 0;
        s.dots -= 1;
        s.dotsEaten += 1;
        s.score += c === 2 ? 10 : 50;
        emit('pickup');
        if (c === 3) {
          s.blossom = 6;
          s.eaten = 0;
        }
      }
    },
  );

  s.blossom = Math.max(0, s.blossom - dt);
  for (const b of s.bugs) {
    if (b.wait > 0) {
      b.wait -= dt;
      continue;
    }
    stepWalker(b, s.blossom > 0 ? 2.6 : 3.4 + Math.min(s.level, 10) * 0.18, dt, (w) => chooseBugDir(s, w as Bug, rng), (x, y, dx, dy) => passable(s, x + dx, y + dy));
  }

  // Bonus vegetable.
  if (!s.vegShown && s.dotsEaten >= 40) {
    s.vegShown = true;
    s.veg.ttl = 10;
  }
  if (s.veg.ttl > 0) {
    s.veg.ttl -= dt;
    const mp = walkerPos(me);
    if (Math.hypot(mp.x - s.veg.x, mp.y - s.veg.y) < 0.6) {
      s.score += 500 * Math.min(s.level, 7);
      s.veg.ttl = 0;
      emit('wave');
    }
  }

  // Bugs vs the gardener.
  const mp = walkerPos(me);
  for (const b of s.bugs) {
    const bp = walkerPos(b);
    if (b.wait > 0 || Math.hypot(bp.x - mp.x, bp.y - mp.y) > 0.6) continue;
    if (s.blossom > 0) {
      s.eaten += 1;
      s.score += 100 * 2 ** s.eaten;
      Object.assign(b, newWalker(b.home.x, b.home.y), { wait: 3 });
      emit('explode');
    } else {
      s.lives -= 1;
      emit('die');
      if (s.lives <= 0) s.over = true;
      else {
        setupActors(s);
        s.respawn = 1.5;
      }
      break;
    }
  }

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (!s.over && s.dots <= 0) s.levelDelay = 1.5;
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: GardenState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < MROWS; y++) {
    for (let x = 0; x < MCOLS; x++) {
      const c = s.grid[idx(x, y)];
      const px = OX + x * CELL;
      const py = OY + y * CELL;
      if (c === 1) {
        g.fillStyle = '#2f6b4a';
        g.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      } else if (c === 2) {
        g.fillStyle = COLORS.paper;
        g.fillRect(px + CELL / 2 - 2, py + CELL / 2 - 2, 4, 4);
      } else if (c === 3) {
        g.fillStyle = COLORS.coral;
        g.beginPath();
        g.arc(px + CELL / 2, py + CELL / 2, 7, 0, TAU);
        g.fill();
      }
    }
  }
  for (const gt of s.gates) {
    const px = OX + gt.x * CELL;
    const py = OY + gt.y * CELL;
    g.fillStyle = gt.open > 0 ? 'rgba(255,201,60,0.35)' : COLORS.gold;
    // A closed gate spans the corridor; an open one is swung flat along it.
    const across = gt.open <= 0;
    if ((gt.axis === 0) === across) g.fillRect(px + CELL / 2 - 3, py + 2, 6, CELL - 4);
    else g.fillRect(px + 2, py + CELL / 2 - 3, CELL - 4, 6);
  }
  const at = (w: Walker) => {
    const p = walkerPos(w);
    return { x: OX + p.x * CELL + CELL / 2, y: OY + p.y * CELL + CELL / 2 };
  };
  if (s.veg.ttl > 0) {
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.arc(OX + s.veg.x * CELL + CELL / 2, OY + s.veg.y * CELL + CELL / 2, 8, 0, TAU);
    g.fill();
  }
  s.bugs.forEach((b, i) => {
    const p = at(b);
    g.fillStyle = s.blossom > 0 ? (s.blossom < 2 && Math.floor(time * 6) % 2 ? COLORS.paper : '#3a49c9') : BUG_COLORS[i % 4]!;
    g.beginPath();
    g.ellipse(p.x, p.y, 10, 8, 0, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(p.x - 5, p.y - 4, 3, 3);
    g.fillRect(p.x + 2, p.y - 4, 3, 3);
  });
  const p = at(s.me);
  g.fillStyle = COLORS.coral;
  g.beginPath();
  g.arc(p.x, p.y, 10, 0, TAU);
  g.fill();
  g.fillStyle = COLORS.bg;
  g.fillRect(p.x - 4, p.y - 6, 2, 12);
  g.fillRect(p.x + 3, p.y - 6, 2, 12);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  if (s.respawn > 0 && !s.over) banner(g, 'READY!', 270);
  if (s.levelDelay > 0) banner(g, 'GARDEN CLEARED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<GardenState> = {
  id: 'garden-gates',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
