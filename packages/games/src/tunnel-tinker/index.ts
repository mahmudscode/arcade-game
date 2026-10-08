import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, TAU, W, type Spark } from '../_shared';

const COLS = 22;
const ROWS = 14;
const CELL = 36;
const OX = (W - COLS * CELL) / 2;
const OY = 58;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_LEVEL = 30;
const MOVE_EVERY = 0.11;
const PUMP_RATE = 1.8;
const POP_AT = 3;
const REACH = 3;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

interface Monster {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  moveCd: number;
  ghost: number;
  ghostCd: number;
  inflate: number;
}

interface Rock {
  x: number;
  y: number;
  /** Wobble time before falling, or -1 once falling. */
  wobble: number;
  fall: number;
  crush: number;
}

export interface TinkerState {
  /** 0 tunnel, 1 dirt. */
  grid: number[];
  px: number;
  py: number;
  fx: number;
  fy: number;
  moveCd: number;
  alive: boolean;
  /** Id of the monster the pump is attached to, or -1. */
  pumping: number;
  monsters: Monster[];
  rocks: Rock[];
  nextId: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  respawn: number;
  levelDelay: number;
  nextLife: number;
}

const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

function buildLevel(s: TinkerState, rng: Rng): void {
  s.grid = Array.from({ length: COLS * ROWS }, (_, i) => (Math.floor(i / COLS) === 0 ? 0 : 1));
  s.monsters = [];
  s.rocks = [];
  s.pumping = -1;
  s.px = COLS >> 1;
  s.py = 0;
  s.fx = 0;
  s.fy = 1;
  const count = Math.min(3 + Math.floor(s.level / 2), 7);
  for (let i = 0; i < count; i++) {
    const x = rng.int(2, COLS - 4);
    const y = rng.int(3, ROWS - 2);
    for (let k = 0; k < 3; k++) s.grid[idx(x + k, y)] = 0;
    s.monsters.push({ id: s.nextId++, x: x + 1, y, dx: 1, dy: 0, moveCd: rng.range(0.4, 1.2), ghost: 0, ghostCd: rng.range(6, 12), inflate: 0 });
  }
  for (let i = 0; i < 4; i++) {
    const x = rng.int(1, COLS - 2);
    const y = rng.int(2, ROWS - 3);
    if (s.grid[idx(x, y)] === 1 && !s.monsters.some((m) => m.x === x && m.y === y)) s.rocks.push({ x, y, wobble: 0.6, fall: 0, crush: 0 });
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): TinkerState {
  const s: TinkerState = {
    grid: [],
    px: 0,
    py: 0,
    fx: 0,
    fy: 1,
    moveCd: 0,
    alive: true,
    pumping: -1,
    monsters: [],
    rocks: [],
    nextId: 1,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    respawn: 0,
    levelDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
  buildLevel(s, rng);
  return s;
}

const cellCenter = (x: number, y: number) => ({ x: OX + x * CELL + CELL / 2, y: OY + y * CELL + CELL / 2 });

function killPlayer(s: TinkerState, rng: Rng, emit: UpdateContext['emit']): void {
  if (!s.alive) return;
  const c = cellCenter(s.px, s.py);
  burst(s.sparks, rng, c.x, c.y, COLORS.cyan, 24);
  emit('die');
  s.alive = false;
  s.pumping = -1;
  s.lives -= 1;
  s.respawn = 1.4;
  if (s.lives <= 0) s.over = true;
}

function popMonster(s: TinkerState, rng: Rng, emit: UpdateContext['emit'], i: number): void {
  const m = s.monsters[i]!;
  const c = cellCenter(m.x, m.y);
  s.score += 200 * (1 + Math.floor(m.y / 4));
  burst(s.sparks, rng, c.x, c.y, COLORS.coral, 16);
  emit('explode');
  if (s.pumping === m.id) s.pumping = -1;
  s.monsters.splice(i, 1);
}

function update(s: TinkerState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level = Math.min(s.level + 1, MAX_LEVEL);
      buildLevel(s, rng);
      emit('wave');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  s.moveCd -= dt;
  if (s.alive) {
    if (s.moveCd <= 0) {
      let dx = 0;
      let dy = 0;
      if (input.held.left) dx = -1;
      else if (input.held.right) dx = 1;
      else if (input.held.up) dy = -1;
      else if (input.held.down) dy = 1;
      if (dx !== 0 || dy !== 0) {
        s.fx = dx;
        s.fy = dy;
        const nx = s.px + dx;
        const ny = s.py + dy;
        const rockAt = s.rocks.some((r) => r.x === nx && r.y === ny);
        if (inside(nx, ny) && !rockAt) {
          if (s.grid[idx(nx, ny)] === 1) {
            s.grid[idx(nx, ny)] = 0;
            s.moveCd = MOVE_EVERY * 1.5;
          } else {
            s.moveCd = MOVE_EVERY;
          }
          s.px = nx;
          s.py = ny;
          s.pumping = -1;
        }
      }
    }
    // Pump: press to fire the harpoon, hold to inflate.
    if (input.pressed.a && s.pumping === -1) {
      for (let k = 1; k <= REACH; k++) {
        const x = s.px + s.fx * k;
        const y = s.py + s.fy * k;
        if (!inside(x, y) || s.grid[idx(x, y)] === 1) break;
        const m = s.monsters.find((mm) => mm.x === x && mm.y === y);
        if (m) {
          s.pumping = m.id;
          emit('fire');
          break;
        }
      }
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.alive = true;
      s.px = COLS >> 1;
      s.py = 0;
      s.pumping = -1;
    }
  }

  // Monsters creep through tunnels; now and then one turns to a ghost and drifts through dirt.
  const speed = Math.max(0.16, 0.42 - s.level * 0.012);
  for (let i = s.monsters.length - 1; i >= 0; i--) {
    const m = s.monsters[i]!;
    if (s.pumping === m.id && input.held.a && s.alive) {
      m.inflate += PUMP_RATE * dt;
      if (m.inflate >= POP_AT) {
        popMonster(s, rng, emit, i);
        continue;
      }
    } else {
      m.inflate = Math.max(0, m.inflate - 0.9 * dt);
    }
    if (s.pumping === m.id || m.inflate > 0) continue;
    m.ghostCd -= dt;
    if (m.ghost <= 0 && m.ghostCd <= 0) {
      m.ghost = 4;
      m.ghostCd = rng.range(8, 14);
    }
    m.ghost = Math.max(0, m.ghost - dt);
    m.moveCd -= dt;
    if (m.moveCd > 0) continue;
    m.moveCd = speed * (m.ghost > 0 ? 1.3 : 1);
    if (m.ghost > 0) {
      m.x += Math.sign(s.px - m.x);
      if (m.x === s.px) m.y += Math.sign(s.py - m.y);
    } else {
      const options = DIRS.filter(([dx, dy]) => inside(m.x + dx, m.y + dy) && s.grid[idx(m.x + dx, m.y + dy)] === 0 && !s.rocks.some((r) => r.x === m.x + dx && r.y === m.y + dy));
      const forward = options.filter(([dx, dy]) => !(dx === -m.dx && dy === -m.dy));
      const pool = forward.length > 0 ? forward : options;
      if (pool.length > 0) {
        const pick = rng.next() < 0.8 ? pool.reduce((a, b) => (Math.abs(m.x + a[0] - s.px) + Math.abs(m.y + a[1] - s.py) <= Math.abs(m.x + b[0] - s.px) + Math.abs(m.y + b[1] - s.py) ? a : b)) : rng.pick(pool);
        m.dx = pick[0];
        m.dy = pick[1];
        m.x += m.dx;
        m.y += m.dy;
      }
    }
    // A ghost that comes to rest inside dirt carves a pocket and turns solid again.
    if (m.ghost <= 0 && s.grid[idx(m.x, m.y)] === 1) s.grid[idx(m.x, m.y)] = 0;
  }
  if (s.alive) {
    for (const m of s.monsters) {
      if (m.x === s.px && m.y === s.py) {
        killPlayer(s, rng, emit);
        break;
      }
    }
  }

  // Rocks wobble, then drop through open tunnel below them.
  for (let i = s.rocks.length - 1; i >= 0; i--) {
    const r = s.rocks[i]!;
    if (r.crush > 0) {
      r.crush -= dt;
      if (r.crush <= 0) s.rocks.splice(i, 1);
      continue;
    }
    const belowOpen = inside(r.x, r.y + 1) && s.grid[idx(r.x, r.y + 1)] === 0;
    if (r.wobble >= 0) {
      if (belowOpen) {
        r.wobble -= dt;
        if (r.wobble < 0) r.fall = 0;
      } else r.wobble = 0.6;
    } else {
      r.fall -= dt;
      if (r.fall <= 0) {
        if (belowOpen) {
          r.y += 1;
          r.fall = 0.08;
          for (let k = s.monsters.length - 1; k >= 0; k--) {
            if (s.monsters[k]!.x === r.x && s.monsters[k]!.y === r.y) {
              s.score += 500;
              popMonster(s, rng, emit, k);
            }
          }
          if (s.alive && s.px === r.x && s.py === r.y) killPlayer(s, rng, emit);
        } else {
          r.crush = 0.3;
        }
      }
    }
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (s.monsters.length === 0 && s.levelDelay <= 0) {
    s.score += 500;
    s.levelDelay = 1.5;
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: TinkerState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  g.fillStyle = '#2b2060';
  g.fillRect(OX, OY - CELL, COLS * CELL, CELL);
  for (let y = 1; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (s.grid[idx(x, y)] !== 1) continue;
      g.fillStyle = y < 4 ? '#7a5c2e' : y < 8 ? '#9a6a2c' : y < 11 ? '#a8512b' : '#8a2f3a';
      g.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
    }
  }
  for (const r of s.rocks) {
    const c = cellCenter(r.x, r.y);
    g.fillStyle = COLORS.muted;
    g.beginPath();
    g.arc(c.x + (r.wobble >= 0 && r.wobble < 0.6 ? Math.sin(time * 40) * 2 : 0), c.y, CELL / 2 - 3, 0, TAU);
    g.fill();
  }
  for (const m of s.monsters) {
    const c = cellCenter(m.x, m.y);
    const size = CELL / 2 - 5 + m.inflate * 4;
    g.globalAlpha = m.ghost > 0 ? 0.6 : 1;
    g.fillStyle = m.inflate > 0 ? COLORS.paper : COLORS.coral;
    g.beginPath();
    g.arc(c.x, c.y, size, 0, TAU);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(c.x - 6, c.y - 4, 4, 5);
    g.fillRect(c.x + 3, c.y - 4, 4, 5);
    g.globalAlpha = 1;
  }
  if (s.alive) {
    const c = cellCenter(s.px, s.py);
    g.fillStyle = COLORS.cyan;
    g.fillRect(c.x - 10, c.y - 12, 20, 24);
    g.fillStyle = COLORS.paper;
    g.fillRect(c.x - 6, c.y - 8, 12, 8);
    if (s.pumping !== -1) {
      const m = s.monsters.find((mm) => mm.id === s.pumping);
      if (m) {
        const t = cellCenter(m.x, m.y);
        g.strokeStyle = COLORS.gold;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(c.x, c.y);
        g.lineTo(t.x, t.y);
        g.stroke();
      }
    }
  }
  drawSparks(g, s.sparks);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `ROUND ${s.level}  LEFT ${s.monsters.length}`, s.lives);
  gameOver(g, s.over);
}

const tunnelTinker: GameDefinition<TinkerState> = {
  id: 'tunnel-tinker',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};

export default tunnelTinker;
