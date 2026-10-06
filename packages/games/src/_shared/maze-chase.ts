import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, clear, gameOver, hud, makeStatus } from './ui';

/** Maze-chase archetype (MZ): eat every pellet while ghosts hunt you. Mazes are generated from ctx.rng. */
export interface MazeConfig {
  id: string;
  /** Chance a ghost turns randomly at an intersection instead of pursuing. */
  wander: number;
  /** Bonus fruit wanders the maze instead of sitting still. */
  movingFruit: boolean;
  wall: string;
}

export const MCOLS = 21;
export const MROWS = 19;
const CELL = 26;
const OX = (W - MCOLS * CELL) / 2;
const OY = 36;
const START_LIVES = 3;
const EXTRA_LIFE = 10000;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const GHOST_COLORS = [COLORS.coral, COLORS.purple, COLORS.cyan, COLORS.gold];

/** 0 floor, 1 wall, 2 pellet, 3 power pellet. */
interface Mover { tx: number; ty: number; dx: number; dy: number; p: number }
interface Ghost extends Mover { wait: number; home: { x: number; y: number } }

export interface MazeState {
  grid: number[];
  pac: Mover & { wx: number; wy: number };
  ghosts: Ghost[];
  fright: number;
  eaten: number;
  pellets: number;
  eatenTotal: number;
  fruit: (Mover & { ttl: number }) | null;
  fruitShown: boolean;
  respawn: number;
  levelDelay: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  nextLife: number;
}

const idx = (x: number, y: number) => y * MCOLS + x;
const START = { x: 10, y: 13 };
const GHOST_STARTS = [{ x: 9, y: 9 }, { x: 11, y: 9 }, { x: 9, y: 7 }, { x: 11, y: 7 }];

export function generateMaze(rng: Rng): number[] {
  const grid = Array.from({ length: MCOLS * MROWS }, () => 1);
  const cw = (MCOLS - 1) / 2;
  const ch = (MROWS - 1) / 2;
  const seen = Array.from({ length: cw * ch }, () => false);
  const stack: [number, number][] = [[0, 0]];
  seen[0] = true;
  grid[idx(1, 1)] = 2;
  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1]!;
    const opts = DIRS.map(([dx, dy]) => [cx + dx, cy + dy, dx, dy] as const).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny * cw + nx]);
    if (opts.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = rng.pick(opts);
    seen[ny * cw + nx] = true;
    grid[idx(2 * cx + 1 + dx, 2 * cy + 1 + dy)] = 2;
    grid[idx(2 * nx + 1, 2 * ny + 1)] = 2;
    stack.push([nx, ny]);
  }
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < MCOLS && y < MROWS && grid[idx(x, y)] !== 1;
  // Braid: open walls next to dead ends and some random walls so the maze has loops.
  for (let y = 1; y < MROWS - 1; y += 2) {
    for (let x = 1; x < MCOLS - 1; x += 2) {
      const n = DIRS.filter(([dx, dy]) => open(x + dx, y + dy)).length;
      if (n <= 1) {
        const walls = DIRS.filter(([dx, dy]) => !open(x + dx, y + dy) && x + dx * 2 > 0 && y + dy * 2 > 0 && x + dx * 2 < MCOLS - 1 && y + dy * 2 < MROWS - 1);
        if (walls.length > 0) {
          const [dx, dy] = rng.pick(walls);
          grid[idx(x + dx, y + dy)] = 2;
        }
      }
    }
  }
  for (let y = 1; y < MROWS - 1; y++) {
    for (let x = 1; x < MCOLS - 1; x++) {
      if ((x + y) % 2 === 1 && grid[idx(x, y)] === 1 && x % 2 !== y % 2 && rng.next() < 0.12 && open(x - 1, y) !== open(x, y - 1)) continue;
      if ((x + y) % 2 === 1 && grid[idx(x, y)] === 1 && rng.next() < 0.1 && ((x % 2 === 0 && open(x - 1, y) && open(x + 1, y)) || (y % 2 === 0 && open(x, y - 1) && open(x, y + 1)))) grid[idx(x, y)] = 2;
    }
  }
  // Wrap tunnel on the middle row.
  grid[idx(0, 9)] = 2;
  grid[idx(MCOLS - 1, 9)] = 2;
  for (const c of [[1, 1], [MCOLS - 2, 1], [1, MROWS - 2], [MCOLS - 2, MROWS - 2]] as const) grid[idx(c[0], c[1])] = 3;
  for (const g of [START, ...GHOST_STARTS]) grid[idx(g.x, g.y)] = 0;
  return grid;
}

export function createMazeChase(cfg: MazeConfig): GameDefinition<MazeState> {
  const wall = (s: MazeState, x: number, y: number) => {
    if (y < 0 || y >= MROWS) return true;
    if (x < 0 || x >= MCOLS) return y !== 9; // tunnel row wraps
    return s.grid[idx(x, y)] === 1;
  };
  const wrapX = (x: number) => (x < 0 ? MCOLS - 1 : x >= MCOLS ? 0 : x);

  function setupActors(s: MazeState): void {
    s.pac = { tx: START.x, ty: START.y, dx: 0, dy: 0, p: 0, wx: 0, wy: 0 };
    s.ghosts = GHOST_STARTS.map((g, i) => ({ tx: g.x, ty: g.y, dx: 0, dy: 0, p: 0, wait: 1 + i * 2.5, home: g }));
    s.fright = 0;
    s.eaten = 0;
    s.fruit = null;
  }

  function newLevel(s: MazeState, rng: Rng): void {
    s.grid = generateMaze(rng);
    s.pellets = s.grid.filter((c) => c === 2 || c === 3).length;
    s.eatenTotal = 0;
    s.fruitShown = false;
    setupActors(s);
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): MazeState {
    const s: MazeState = {
      grid: [],
      pac: { tx: 0, ty: 0, dx: 0, dy: 0, p: 0, wx: 0, wy: 0 },
      ghosts: [],
      fright: 0,
      eaten: 0,
      pellets: 0,
      eatenTotal: 0,
      fruit: null,
      fruitShown: false,
      respawn: 0,
      levelDelay: 0,
      score: 0,
      hi: hiScore,
      lives: START_LIVES,
      level: 1,
      over: false,
      nextLife: EXTRA_LIFE,
    };
    newLevel(s, rng);
    s.respawn = 1.5;
    return s;
  }

  const posOf = (m: Mover) => ({ x: m.tx + m.dx * m.p, y: m.ty + m.dy * m.p });

  /** Advance a mover along its direction; returns true each time it arrives on a tile. */
  function advance(s: MazeState, m: Mover, speed: number, dt: number): boolean {
    if (m.dx === 0 && m.dy === 0) return false;
    m.p += speed * dt;
    if (m.p < 1) return false;
    m.p -= 1;
    m.tx = wrapX(m.tx + m.dx);
    m.ty += m.dy;
    return true;
  }

  function chooseGhostDir(s: MazeState, gh: Ghost, i: number, rng: Rng): void {
    const options = DIRS.filter(([dx, dy]) => !wall(s, gh.tx + dx, gh.ty + dy));
    const noReverse = options.filter(([dx, dy]) => !(dx === -gh.dx && dy === -gh.dy));
    const pool = noReverse.length > 0 ? noReverse : options;
    if (pool.length === 0) {
      gh.dx = 0;
      gh.dy = 0;
      return;
    }
    let pick = pool[0]!;
    if (s.fright > 0 || rng.next() < cfg.wander) pick = rng.pick(pool);
    else {
      // Personalities: 0 chases, 1 ambushes ahead of you, 2 and 3 circle toward their corners.
      const pac = s.pac;
      let tx = pac.tx;
      let ty = pac.ty;
      if (i === 1) {
        tx += pac.dx * 4;
        ty += pac.dy * 4;
      } else if (i === 2) {
        tx = Math.hypot(pac.tx - gh.tx, pac.ty - gh.ty) > 7 ? pac.tx : 1;
        ty = Math.hypot(pac.tx - gh.tx, pac.ty - gh.ty) > 7 ? pac.ty : MROWS - 2;
      } else if (i === 3) {
        tx = Math.hypot(pac.tx - gh.tx, pac.ty - gh.ty) > 5 ? pac.tx : MCOLS - 2;
        ty = Math.hypot(pac.tx - gh.tx, pac.ty - gh.ty) > 5 ? pac.ty : 1;
      }
      let best = Infinity;
      for (const d of pool) {
        const dist = Math.hypot(gh.tx + d[0] - tx, gh.ty + d[1] - ty);
        if (dist < best) {
          best = dist;
          pick = d;
        }
      }
    }
    gh.dx = pick[0];
    gh.dy = pick[1];
  }

  function update(s: MazeState, input: Input, dt: number, ctx: UpdateContext): void {
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
        newLevel(s, rng);
        s.respawn = 1.2;
        emit('wave');
      }
      return;
    }

    const pac = s.pac;
    // Queue the wanted direction; take it as soon as the corridor allows.
    const want = input.held.up ? DIRS[0] : input.held.right ? DIRS[1] : input.held.down ? DIRS[2] : input.held.left ? DIRS[3] : null;
    if (want) {
      pac.wx = want[0];
      pac.wy = want[1];
    }
    const speed = 5.2 + Math.min(s.level, 10) * 0.12;
    // Reversing is allowed mid-corridor.
    if (pac.p > 0 && (pac.wx === -pac.dx && pac.wy === -pac.dy) && (pac.wx !== 0 || pac.wy !== 0)) {
      pac.tx = wrapX(pac.tx + pac.dx);
      pac.ty += pac.dy;
      pac.dx = pac.wx;
      pac.dy = pac.wy;
      pac.p = 1 - pac.p;
    }
    if (pac.dx === 0 && pac.dy === 0 && !wall(s, pac.tx + pac.wx, pac.ty + pac.wy) && (pac.wx !== 0 || pac.wy !== 0)) {
      pac.dx = pac.wx;
      pac.dy = pac.wy;
    }
    if (advance(s, pac, speed, dt)) {
      const c = s.grid[idx(pac.tx, pac.ty)];
      if (c === 2 || c === 3) {
        s.grid[idx(pac.tx, pac.ty)] = 0;
        s.pellets -= 1;
        s.eatenTotal += 1;
        s.score += c === 2 ? 10 : 50;
        emit('pickup');
        if (c === 3) {
          s.fright = 7;
          s.eaten = 0;
        }
      }
      if (!wall(s, pac.tx + pac.wx, pac.ty + pac.wy) && (pac.wx !== 0 || pac.wy !== 0)) {
        pac.dx = pac.wx;
        pac.dy = pac.wy;
      } else if (wall(s, pac.tx + pac.dx, pac.ty + pac.dy)) {
        pac.dx = 0;
        pac.dy = 0;
      }
    }

    s.fright = Math.max(0, s.fright - dt);
    s.ghosts.forEach((gh, i) => {
      if (gh.wait > 0) {
        gh.wait -= dt;
        return;
      }
      if (gh.dx === 0 && gh.dy === 0) chooseGhostDir(s, gh, i, rng);
      const gs = (s.fright > 0 ? 3.2 : 4.4 + Math.min(s.level, 10) * 0.18) * 1;
      if (advance(s, gh, gs, dt)) chooseGhostDir(s, gh, i, rng);
    });

    // Fruit.
    if (!s.fruitShown && s.eatenTotal >= 40) {
      s.fruitShown = true;
      s.fruit = { tx: START.x, ty: 5, dx: 0, dy: 0, p: 0, ttl: 10 };
    }
    const fr = s.fruit;
    if (fr) {
      fr.ttl -= dt;
      if (cfg.movingFruit) {
        if (fr.dx === 0 && fr.dy === 0) {
          const o = DIRS.filter(([dx, dy]) => !wall(s, fr.tx + dx, fr.ty + dy));
          if (o.length) {
            const d = rng.pick(o);
            fr.dx = d[0];
            fr.dy = d[1];
          }
        }
        if (advance(s, fr, 3.5, dt)) {
          const o = DIRS.filter(([dx, dy]) => !wall(s, fr.tx + dx, fr.ty + dy) && !(dx === -fr.dx && dy === -fr.dy));
          const d = o.length ? rng.pick(o) : [-fr.dx, -fr.dy];
          fr.dx = d[0]!;
          fr.dy = d[1]!;
        }
      }
      const fp = posOf(fr);
      const pp = posOf(pac);
      if (Math.hypot(fp.x - pp.x, fp.y - pp.y) < 0.6) {
        s.score += 100 * Math.min(s.level, 7);
        s.fruit = null;
        emit('wave');
      } else if (fr.ttl <= 0) s.fruit = null;
    }

    // Collisions.
    const pp = posOf(pac);
    for (const gh of s.ghosts) {
      const gp = posOf(gh);
      if (gh.wait > 0 || Math.hypot(gp.x - pp.x, gp.y - pp.y) > 0.6) continue;
      if (s.fright > 0) {
        s.eaten += 1;
        s.score += 100 * 2 ** s.eaten;
        Object.assign(gh, { tx: gh.home.x, ty: gh.home.y, dx: 0, dy: 0, p: 0, wait: 3 });
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
      s.nextLife += EXTRA_LIFE;
      emit('pickup');
    }
    if (!s.over && s.pellets <= 0) s.levelDelay = 1.5;
    if (s.score > s.hi) s.hi = s.score;
  }

  function render(s: MazeState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    for (let y = 0; y < MROWS; y++) {
      for (let x = 0; x < MCOLS; x++) {
        const c = s.grid[idx(x, y)];
        const px = OX + x * CELL;
        const py = OY + y * CELL;
        if (c === 1) {
          g.fillStyle = cfg.wall;
          g.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        } else if (c === 2) {
          g.fillStyle = COLORS.paper;
          g.fillRect(px + CELL / 2 - 2, py + CELL / 2 - 2, 4, 4);
        } else if (c === 3) {
          g.fillStyle = COLORS.gold;
          g.beginPath();
          g.arc(px + CELL / 2, py + CELL / 2, 7, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    const at = (m: Mover) => {
      const p = posOf(m);
      return { x: OX + p.x * CELL + CELL / 2, y: OY + p.y * CELL + CELL / 2 };
    };
    if (s.fruit) {
      const f = at(s.fruit);
      g.fillStyle = COLORS.coral;
      g.beginPath();
      g.arc(f.x, f.y, 8, 0, Math.PI * 2);
      g.fill();
    }
    s.ghosts.forEach((gh, i) => {
      const p = at(gh);
      g.fillStyle = s.fright > 0 ? (s.fright < 2 && Math.floor(time * 6) % 2 ? COLORS.paper : '#3a49c9') : GHOST_COLORS[i]!;
      g.beginPath();
      g.arc(p.x, p.y - 2, 10, Math.PI, 0);
      g.lineTo(p.x + 10, p.y + 10);
      g.lineTo(p.x - 10, p.y + 10);
      g.fill();
      g.fillStyle = COLORS.bg;
      g.fillRect(p.x - 6, p.y - 5, 4, 4);
      g.fillRect(p.x + 2, p.y - 5, 4, 4);
    });
    const p = at(s.pac);
    const open = 0.25 + Math.abs(Math.sin(time * 14)) * 0.4;
    const ang = s.pac.dx === 1 ? 0 : s.pac.dx === -1 ? Math.PI : s.pac.dy === 1 ? Math.PI / 2 : s.pac.dy === -1 ? -Math.PI / 2 : 0;
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.arc(p.x, p.y, 11, ang + open, ang + Math.PI * 2 - open);
    g.fill();
    hud(g, s, `LEVEL ${s.level}`, s.lives);
    if (s.respawn > 0 && !s.over) banner(g, 'READY!', 270);
    if (s.levelDelay > 0) banner(g, 'MAZE CLEARED!', 270);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
