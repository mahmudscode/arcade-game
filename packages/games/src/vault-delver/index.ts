import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';
import { generateDungeon } from '../_shared/dungeon';

const COLS = 21;
const ROWS = 15;
const CELL = 32;
const OX = (W - COLS * CELL) / 2;
const OY = 62;
const START_HEALTH = 800;
const HERO_R = 0.3;
const HERO_SPEED = 3.7;
const ARROW_SPEED = 10;
const FLOOR = 0;
const WALL = 1;
const DOOR = 2;
const EXIT = 3;
const FOOD = 0;
const TREASURE = 1;
const POTION = 2;
const KEY = 3;

/** Monster tiers: speed (tiles/s), hit points, contact damage per hit, points. */
const MOBS = [
  { name: 'ghost', speed: 2.5, hp: 1, dmg: 3, points: 10, color: COLORS.paper },
  { name: 'grunt', speed: 1.7, hp: 2, dmg: 6, points: 20, color: COLORS.coral },
  { name: 'demon', speed: 1.3, hp: 2, dmg: 5, points: 40, color: COLORS.purple },
] as const;

interface Mob {
  kind: 0 | 1 | 2;
  x: number;
  y: number;
  hp: number;
  /** Seconds until the next contact hit / shot. */
  cd: number;
}
interface Gen {
  x: number;
  y: number;
  hp: number;
  timer: number;
}
interface Arrow {
  x: number;
  y: number;
  dx: number;
  dy: number;
  mine: boolean;
}
interface Item {
  x: number;
  y: number;
  kind: number;
}

export interface DelverState {
  grid: number[];
  hero: { x: number; y: number; fx: number; fy: number; cd: number };
  mobs: Mob[];
  gens: Gen[];
  arrows: Arrow[];
  items: Item[];
  /** Walking distance to the hero for every tile (-1 = unreachable); refreshed a few times a second. */
  flow: number[];
  flowTimer: number;
  sparks: Spark[];
  health: number;
  drain: number;
  keys: number;
  potions: number;
  levelDelay: number;
  score: number;
  hi: number;
  level: number;
  over: boolean;
}

const idx = (x: number, y: number) => y * COLS + x;
const tileAt = (s: DelverState, x: number, y: number) => {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS ? WALL : s.grid[idx(tx, ty)]!;
};
const solid = (s: DelverState, x: number, y: number) => {
  const t = tileAt(s, x, y);
  return t === WALL || t === DOOR;
};
const px = (x: number) => OX + x * CELL;
const py = (y: number) => OY + y * CELL;

function floorCells(s: DelverState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === FLOOR) out.push(i);
  return out;
}

function buildLevel(s: DelverState, rng: Rng): void {
  s.grid = generateDungeon(rng, COLS, ROWS);
  // The vault: the exit sits behind a door in the bottom-right corner.
  s.grid[idx(COLS - 2, ROWS - 2)] = EXIT;
  s.grid[idx(COLS - 2, ROWS - 3)] = WALL;
  s.grid[idx(COLS - 3, ROWS - 2)] = DOOR;
  s.hero = { x: 1.5, y: 1.5, fx: 1, fy: 0, cd: 0 };
  s.mobs = [];
  s.arrows = [];
  s.items = [];
  s.gens = [];
  s.keys = 0;
  const cells = floorCells(s).filter((i) => Math.hypot((i % COLS) - 1, Math.floor(i / COLS) - 1) > 7);
  const take = () => {
    const k = rng.int(0, cells.length - 1);
    return cells.splice(k, 1)[0]!;
  };
  const gens = Math.min(2 + Math.floor(s.level / 2), 5);
  for (let g = 0; g < gens && cells.length > 0; g++) {
    const c = take();
    s.gens.push({ x: (c % COLS) + 0.5, y: Math.floor(c / COLS) + 0.5, hp: 3, timer: rng.range(1, 3) });
  }
  const place = (kind: number, n: number) => {
    for (let k = 0; k < n && cells.length > 0; k++) {
      const c = take();
      s.items.push({ x: (c % COLS) + 0.5, y: Math.floor(c / COLS) + 0.5, kind });
    }
  };
  place(KEY, 1);
  place(FOOD, 3);
  place(TREASURE, 4);
  place(POTION, 1);
  s.flow = s.grid.map(() => -1);
  s.flowTimer = 0;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): DelverState {
  const s: DelverState = {
    grid: [],
    hero: { x: 1.5, y: 1.5, fx: 1, fy: 0, cd: 0 },
    mobs: [],
    gens: [],
    arrows: [],
    items: [],
    flow: [],
    flowTimer: 0,
    sparks: [],
    health: START_HEALTH,
    drain: 0,
    keys: 0,
    potions: 1,
    levelDelay: 0,
    score: 0,
    hi: hiScore,
    level: 1,
    over: false,
  };
  buildLevel(s, rng);
  return s;
}

function refreshFlow(s: DelverState): void {
  s.flow.fill(-1);
  const start = idx(Math.floor(s.hero.x), Math.floor(s.hero.y));
  s.flow[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!;
    for (const n of [c - 1, c + 1, c - COLS, c + COLS]) {
      if (n < 0 || n >= s.flow.length || s.flow[n] !== -1 || s.grid[n] === WALL || s.grid[n] === DOOR) continue;
      if ((n === c - 1 && c % COLS === 0) || (n === c + 1 && c % COLS === COLS - 1)) continue;
      s.flow[n] = s.flow[c]! + 1;
      q.push(n);
    }
  }
}

/** Moves a circle along an axis unless it would enter a solid tile. */
function slide(s: DelverState, e: { x: number; y: number }, dx: number, dy: number, r: number): void {
  const free = (x: number, y: number) => !solid(s, x - r, y - r) && !solid(s, x + r, y - r) && !solid(s, x - r, y + r) && !solid(s, x + r, y + r);
  if (free(e.x + dx, e.y)) e.x += dx;
  if (free(e.x, e.y + dy)) e.y += dy;
}

function spawnMob(s: DelverState, g: Gen, rng: Rng): void {
  const roll = rng.next();
  const kind = (s.level >= 3 && roll < 0.2 ? 2 : roll < 0.55 ? 1 : 0) as 0 | 1 | 2;
  s.mobs.push({ kind, x: g.x, y: g.y, hp: MOBS[kind].hp, cd: 0.6 });
}

function damage(s: DelverState, amount: number, emit: UpdateContext['emit']): void {
  s.health -= amount;
  if (s.health <= 0) {
    s.health = 0;
    s.over = true;
    emit('die');
  }
}

function update(s: DelverState, input: Input, dt: number, ctx: UpdateContext): void {
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

  // Health slowly drains: stay moving, find food.
  s.drain += dt;
  if (s.drain >= 1) {
    s.drain -= 1;
    damage(s, 1, emit);
    if (s.over) return;
  }

  const h = s.hero;
  const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    h.fx = dx / len;
    h.fy = dy / len;
    // A closed door opens for a key.
    const tx = Math.floor(h.x + h.fx * (HERO_R + 0.15));
    const ty = Math.floor(h.y + h.fy * (HERO_R + 0.15));
    if (tileAt(s, tx + 0.5, ty + 0.5) === DOOR && s.keys > 0) {
      s.keys -= 1;
      s.grid[idx(tx, ty)] = FLOOR;
      emit('pickup');
    }
    slide(s, h, h.fx * HERO_SPEED * dt, h.fy * HERO_SPEED * dt, HERO_R);
  }
  h.cd -= dt;
  if (input.held.a && h.cd <= 0 && s.arrows.filter((a) => a.mine).length < 3) {
    h.cd = 0.24;
    s.arrows.push({ x: h.x, y: h.y, dx: h.fx, dy: h.fy, mine: true });
    emit('fire');
  }
  if (input.pressed.b && s.potions > 0) {
    s.potions -= 1;
    for (let i = s.mobs.length - 1; i >= 0; i--) {
      const m = s.mobs[i]!;
      if (Math.hypot(m.x - h.x, m.y - h.y) > 6) continue;
      s.score += MOBS[m.kind].points;
      burst(s.sparks, rng, px(m.x), py(m.y), MOBS[m.kind].color, 8);
      s.mobs.splice(i, 1);
    }
    for (const g of s.gens) if (Math.hypot(g.x - h.x, g.y - h.y) <= 6) g.hp -= 1;
    emit('explode');
  }

  // Items.
  for (let i = s.items.length - 1; i >= 0; i--) {
    const it = s.items[i]!;
    if (Math.hypot(it.x - h.x, it.y - h.y) > 0.55) continue;
    if (it.kind === FOOD) s.health = Math.min(s.health + 150, 1500);
    else if (it.kind === TREASURE) s.score += 100;
    else if (it.kind === POTION) s.potions += 1;
    else s.keys += 1;
    s.items.splice(i, 1);
    emit('pickup');
  }

  // Generators spawn monsters until they are shot down.
  for (let i = s.gens.length - 1; i >= 0; i--) {
    const g = s.gens[i]!;
    if (g.hp <= 0) {
      s.score += 100;
      burst(s.sparks, rng, px(g.x), py(g.y), COLORS.gold, 18);
      s.gens.splice(i, 1);
      emit('explode');
      continue;
    }
    g.timer -= dt;
    if (g.timer <= 0 && s.mobs.length < 14 + s.level && Math.hypot(g.x - h.x, g.y - h.y) < 14) {
      g.timer = Math.max(1.8, 4.4 - s.level * 0.2) + rng.range(0, 1);
      spawnMob(s, g, rng);
    }
  }

  // Monsters follow the flow field to the hero.
  s.flowTimer -= dt;
  if (s.flowTimer <= 0) {
    s.flowTimer = 0.3;
    refreshFlow(s);
  }
  for (const m of s.mobs) {
    const def = MOBS[m.kind];
    const tx = Math.floor(m.x);
    const ty = Math.floor(m.y);
    const here = s.flow[idx(tx, ty)]!;
    let gx = h.x;
    let gy = h.y;
    if (here > 0) {
      let best = here;
      for (const [nx, ny] of [[tx, ty - 1], [tx + 1, ty], [tx, ty + 1], [tx - 1, ty]] as const) {
        const d = nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS ? -1 : s.flow[idx(nx, ny)]!;
        if (d >= 0 && d < best) {
          best = d;
          gx = nx + 0.5;
          gy = ny + 0.5;
        }
      }
    }
    const vx = gx - m.x;
    const vy = gy - m.y;
    const len = Math.hypot(vx, vy) || 1;
    const keepAway = m.kind === 2 && Math.hypot(h.x - m.x, h.y - m.y) < 4;
    if (!keepAway) slide(s, m, (vx / len) * def.speed * dt, (vy / len) * def.speed * dt, 0.3);
    m.cd -= dt;
    const d = Math.hypot(h.x - m.x, h.y - m.y);
    if (m.kind === 2) {
      if (m.cd <= 0 && d < 8) {
        const sx = (h.x - m.x) / d;
        const sy = (h.y - m.y) / d;
        s.arrows.push({ x: m.x, y: m.y, dx: sx, dy: sy, mine: false });
        m.cd = 2.8;
      }
    }
    if (d < 0.6 && m.cd <= 0) {
      damage(s, def.dmg, emit);
      m.cd = 0.25;
      if (s.over) return;
    }
  }

  // Arrows.
  for (let i = s.arrows.length - 1; i >= 0; i--) {
    const a = s.arrows[i]!;
    const speed = a.mine ? ARROW_SPEED : ARROW_SPEED * 0.45;
    a.x += a.dx * speed * dt;
    a.y += a.dy * speed * dt;
    if (solid(s, a.x, a.y)) {
      s.arrows.splice(i, 1);
      continue;
    }
    if (a.mine) {
      const mi = s.mobs.findIndex((m) => Math.hypot(m.x - a.x, m.y - a.y) < 0.5);
      const gi = s.gens.findIndex((g) => Math.hypot(g.x - a.x, g.y - a.y) < 0.6);
      if (mi >= 0) {
        const m = s.mobs[mi]!;
        m.hp -= 1;
        s.arrows.splice(i, 1);
        if (m.hp <= 0) {
          s.score += MOBS[m.kind].points;
          burst(s.sparks, rng, px(m.x), py(m.y), MOBS[m.kind].color, 8);
          s.mobs.splice(mi, 1);
          emit('explode');
        }
      } else if (gi >= 0) {
        s.gens[gi]!.hp -= 1;
        s.score += 10;
        s.arrows.splice(i, 1);
        emit('pickup');
      }
    } else if (Math.hypot(h.x - a.x, h.y - a.y) < 0.4) {
      s.arrows.splice(i, 1);
      damage(s, 25, emit);
      if (s.over) return;
    }
  }

  // The exit.
  if (tileAt(s, h.x, h.y) === EXIT) {
    s.score += 500 + Math.floor(s.health / 10);
    s.levelDelay = 1.6;
    emit('wave');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: DelverState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = s.grid[idx(x, y)];
      if (c === WALL) {
        g.fillStyle = COLORS.purple;
        g.fillRect(px(x) + 1, py(y) + 1, CELL - 2, CELL - 2);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(px(x) + 1, py(y) + CELL / 2, CELL - 2, 3);
      } else if (c === DOOR) {
        g.fillStyle = COLORS.gold;
        g.fillRect(px(x) + 4, py(y) + 2, CELL - 8, CELL - 4);
      } else if (c === EXIT) {
        g.fillStyle = Math.floor(time * 4) % 2 ? COLORS.cyan : COLORS.paper;
        g.fillRect(px(x) + 4, py(y) + 4, CELL - 8, CELL - 8);
      }
    }
  }
  for (const it of s.items) {
    const x = px(it.x);
    const y = py(it.y);
    g.fillStyle = it.kind === FOOD ? COLORS.coral : it.kind === TREASURE ? COLORS.gold : it.kind === POTION ? COLORS.cyan : COLORS.paper;
    if (it.kind === KEY) {
      g.fillRect(x - 3, y - 8, 6, 14);
      g.fillRect(x - 3, y + 2, 10, 4);
    } else {
      g.beginPath();
      g.arc(x, y, 7, 0, TAU);
      g.fill();
    }
  }
  for (const gen of s.gens) {
    g.fillStyle = COLORS.coral;
    g.fillRect(px(gen.x) - 13, py(gen.y) - 13, 26, 26);
    g.fillStyle = COLORS.bg;
    g.fillRect(px(gen.x) - 7, py(gen.y) - 5, 5, 6);
    g.fillRect(px(gen.x) + 3, py(gen.y) - 5, 5, 6);
    g.fillStyle = COLORS.gold;
    g.fillRect(px(gen.x) - 13, py(gen.y) + 16, (26 * Math.max(0, gen.hp)) / 3, 3);
  }
  for (const m of s.mobs) {
    g.fillStyle = MOBS[m.kind].color;
    g.beginPath();
    g.arc(px(m.x), py(m.y) - 1, 11, Math.PI, 0);
    g.lineTo(px(m.x) + 11, py(m.y) + 10);
    g.lineTo(px(m.x) - 11, py(m.y) + 10);
    g.fill();
    g.fillStyle = COLORS.bg;
    g.fillRect(px(m.x) - 6, py(m.y) - 4, 4, 4);
    g.fillRect(px(m.x) + 2, py(m.y) - 4, 4, 4);
  }
  for (const a of s.arrows) {
    g.fillStyle = a.mine ? COLORS.cyan : COLORS.coral;
    g.fillRect(px(a.x) - 3, py(a.y) - 3, 7, 7);
  }
  g.fillStyle = COLORS.gold;
  g.beginPath();
  g.arc(px(s.hero.x), py(s.hero.y), 10, 0, TAU);
  g.fill();
  g.fillStyle = COLORS.bg;
  g.fillRect(px(s.hero.x) - 3 + s.hero.fx * 4, py(s.hero.y) - 3 + s.hero.fy * 4, 7, 7);
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  HEALTH ${s.health}  KEYS ${s.keys}  POTIONS ${s.potions}`);
  if (s.levelDelay > 0) banner(g, 'VAULT ESCAPED!', 270);
  gameOver(g, s.over);
}

const game: GameDefinition<DelverState> = {
  id: 'vault-delver',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.over ? 0 : Math.min(5, Math.max(1, Math.ceil(s.health / 200))), s.level),
};
export default game;
