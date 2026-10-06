import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const COLS = 20;
const CELL = 40;
const ROW_H = 46;
const OY = 90;
const FLOORS = 4;
const FLOOR_GAP = 3; // rows between platforms
const START_LIVES = 3;
const HOLE_TIME = 4;
const TRAP_TIME = 3.2;
const OXYGEN = 60;
/** Ladder columns between floor k and k+1. */
const LADDERS: number[][] = [[3, 12, 17], [6, 15], [2, 9, 18]];

interface Monster { x: number; f: number; dir: 1 | -1; trapped: number; /** Ladder it is climbing: target floor, or -1. */ to: number; y: number; wait: number }
interface Hole { f: number; c: number; t: number }

export interface PanicState {
  /** x in columns, y in rows (platform k sits at row k*FLOOR_GAP). */
  player: { x: number; y: number; face: 1 | -1; alive: boolean; invuln: number };
  monsters: Monster[];
  holes: Hole[];
  oxygen: number;
  sparks: Spark[];
  respawn: number;
  levelDelay: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const floorRow = (f: number) => f * FLOOR_GAP;
const laddersAt = (f: number) => [...(LADDERS[f] ?? []), ...(f > 0 ? LADDERS[f - 1]! : [])];

function newLevel(s: PanicState, rng: Rng): void {
  const count = Math.min(2 + s.level, 7);
  s.monsters = Array.from({ length: count }, (_, i) => {
    const f = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3;
    const x = rng.range(1, COLS - 2);
    return { x, f, dir: rng.pick<1 | -1>([1, -1]), trapped: 0, to: -1, y: floorRow(f), wait: rng.range(0, 1) };
  });
  s.holes = [];
  s.oxygen = OXYGEN;
}

function resetPlayer(s: PanicState): void {
  s.player = { x: 1, y: floorRow(FLOORS - 1), face: 1, alive: true, invuln: 2 };
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): PanicState {
  const s: PanicState = {
    player: { x: 1, y: floorRow(FLOORS - 1), face: 1, alive: true, invuln: 2 },
    monsters: [],
    holes: [],
    oxygen: OXYGEN,
    sparks: [],
    respawn: 0,
    levelDelay: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  newLevel(s, rng);
  return s;
}

const holeAt = (s: PanicState, f: number, c: number) => s.holes.find((h) => h.f === f && h.c === c);

function loseLife(s: PanicState, rng: Rng, emit: UpdateContext['emit']): void {
  const p = s.player;
  p.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  burst(s.sparks, rng, p.x * CELL + CELL / 2, OY + p.y * ROW_H, COLORS.cyan, 22);
  emit('die');
  if (s.lives <= 0) s.over = true;
}

function update(s: PanicState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }
  stepSparks(s.sparks, dt);

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      newLevel(s, rng);
      resetPlayer(s);
      emit('wave');
    }
    return;
  }

  const p = s.player;
  if (p.alive) {
    p.invuln = Math.max(0, p.invuln - dt);
    const f = Math.round(p.y / FLOOR_GAP);
    const onFloor = Math.abs(p.y - floorRow(f)) < 0.001;
    const ladderCol = laddersAt(Math.min(FLOORS - 1, Math.max(0, f))).find((c) => Math.abs(c - p.x) < 0.45);
    const dirX = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    if (onFloor && dirX !== 0) {
      p.face = dirX as 1 | -1;
      const nx = Math.min(COLS - 1, Math.max(0, p.x + dirX * 6 * dt));
      // Holes block the way.
      if (!holeAt(s, f, Math.round(nx + dirX * 0.4))) p.x = nx;
    }
    const dirY = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if (dirY !== 0) {
      const atTop = p.y + dirY * 0.0001 < 0;
      const atBottom = p.y > floorRow(FLOORS - 1) - 0.0001 && dirY > 0;
      let canClimb = false;
      if (!atTop && !atBottom) {
        if (ladderCol !== undefined) {
          // Which floors does this ladder connect?
          const lower = LADDERS.map((cols, i) => (cols.includes(ladderCol) ? i : -1)).filter((i) => i >= 0);
          const inRange = lower.some((i) => p.y >= floorRow(i) - 0.001 && p.y <= floorRow(i + 1) + 0.001);
          canClimb = inRange;
        }
      }
      if (canClimb) {
        p.x = ladderCol!;
        p.y = Math.min(floorRow(FLOORS - 1), Math.max(0, p.y + dirY * 3.2 * dt));
        // Snap to a floor when close, so walking resumes cleanly.
        for (let k = 0; k < FLOORS; k++) if (Math.abs(p.y - floorRow(k)) < 0.06) p.y = floorRow(k);
      }
    }
    if (input.pressed.a && onFloor) {
      const col = Math.round(p.x) + p.face;
      const trapped = s.monsters.findIndex((m) => m.trapped > 0 && m.f === f && Math.round(m.x) === col);
      if (trapped >= 0) {
        const m = s.monsters[trapped]!;
        s.score += 100 * (s.monsters.filter((q) => q.trapped > 0).length || 1) + 100 * (FLOORS - 1 - m.f + 1);
        burst(s.sparks, rng, m.x * CELL + CELL / 2, OY + floorRow(m.f) * ROW_H, COLORS.coral, 14);
        s.monsters.splice(trapped, 1);
        s.holes = s.holes.filter((h) => !(h.f === f && h.c === col));
        emit('explode');
      } else if (col >= 0 && col < COLS && !laddersAt(f).includes(col) && !holeAt(s, f, col) && s.holes.length < 3 && f < FLOORS) {
        s.holes.push({ f, c: col, t: HOLE_TIME });
        emit('fire');
      }
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) resetPlayer(s);
  }

  for (let i = s.holes.length - 1; i >= 0; i--) {
    s.holes[i]!.t -= dt;
    if (s.holes[i]!.t <= 0) {
      const h = s.holes[i]!;
      // Anyone still stuck climbs out when the floor closes.
      for (const m of s.monsters) if (m.f === h.f && Math.round(m.x) === h.c) m.trapped = 0;
      s.holes.splice(i, 1);
    }
  }

  for (const m of s.monsters) {
    if (m.trapped > 0) {
      m.trapped -= dt;
      continue;
    }
    if (m.to >= 0) {
      const dir = m.to > m.f ? 1 : -1;
      m.y += dir * 2.2 * dt;
      if ((dir === 1 && m.y >= floorRow(m.to)) || (dir === -1 && m.y <= floorRow(m.to))) {
        m.y = floorRow(m.to);
        m.f = m.to;
        m.to = -1;
      }
      continue;
    }
    m.wait -= dt;
    const speed = 2.2 + s.level * 0.2;
    const nx = m.x + m.dir * speed * dt;
    if (nx < 0 || nx > COLS - 1) m.dir = m.dir === 1 ? -1 : 1;
    else m.x = nx;
    const c = Math.round(m.x);
    if (holeAt(s, m.f, c)) {
      m.trapped = TRAP_TIME;
      m.x = c;
      continue;
    }
    if (m.wait <= 0 && Math.abs(m.x - c) < 0.08) {
      const here = laddersAt(m.f);
      if (here.includes(c) && rng.next() < 0.5) {
        const down = LADDERS[m.f]?.includes(c) && m.f < FLOORS - 1;
        const up = m.f > 0 && LADDERS[m.f - 1]!.includes(c);
        const options: number[] = [];
        if (down) options.push(m.f + 1);
        if (up) options.push(m.f - 1);
        if (options.length > 0) {
          m.to = rng.pick(options);
          m.x = c;
        }
        m.wait = 1.2;
      } else m.wait = 0.3;
    }
  }

  const p2 = s.player;
  if (p2.alive && p2.invuln <= 0 && s.monsters.some((m) => m.trapped <= 0 && Math.abs(m.x - p2.x) < 0.7 && Math.abs(m.y - p2.y) < 1)) loseLife(s, rng, emit);

  s.oxygen -= dt;
  if (s.oxygen <= 0 && p2.alive) {
    s.oxygen = OXYGEN;
    loseLife(s, rng, emit);
  }
  if (!s.over && s.monsters.length === 0) {
    s.score += 300 + Math.floor(s.oxygen) * 10;
    s.levelDelay = 1.4;
    emit('pickup');
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: PanicState, g: CanvasRenderingContext2D): void {
  clear(g);
  const px = (x: number) => x * CELL;
  const py = (y: number) => OY + y * ROW_H;
  for (let f = 0; f < FLOORS; f++) {
    g.fillStyle = COLORS.purple;
    for (let c = 0; c < COLS; c++) {
      if (holeAt(s, f, c)) continue;
      g.fillRect(px(c), py(floorRow(f)), CELL - 1, 8);
    }
  }
  g.fillStyle = COLORS.muted;
  LADDERS.forEach((cols, k) => {
    for (const c of cols) {
      for (let y = floorRow(k); y < floorRow(k + 1); y += 0.5) g.fillRect(px(c) + 8, py(y) + 8, 24, 3);
      g.fillRect(px(c) + 8, py(floorRow(k)), 3, py(floorRow(k + 1)) - py(floorRow(k)));
      g.fillRect(px(c) + 29, py(floorRow(k)), 3, py(floorRow(k + 1)) - py(floorRow(k)));
    }
  });
  for (const m of s.monsters) {
    g.fillStyle = m.trapped > 0 ? COLORS.gold : COLORS.coral;
    g.fillRect(px(m.x) + 6, py(m.y) - 28 + (m.trapped > 0 ? 14 : 0), CELL - 12, m.trapped > 0 ? 14 : 28);
  }
  const p = s.player;
  if (p.alive && (p.invuln <= 0 || Math.floor(p.invuln * 10) % 2 === 0)) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(px(p.x) + 8, py(p.y) - 32, CELL - 16, 32);
    g.fillStyle = COLORS.paper;
    g.fillRect(px(p.x) + (p.face === 1 ? 24 : 8), py(p.y) - 26, 8, 8);
  }
  drawSparks(g, s.sparks);
  g.fillStyle = COLORS.muted;
  g.fillRect(W / 2 - 100, 54, 200, 10);
  g.fillStyle = s.oxygen < 12 ? COLORS.coral : COLORS.cyan;
  g.fillRect(W / 2 - 100, 54, (s.oxygen / OXYGEN) * 200, 10);
  hud(g, s, `LEVEL ${s.level}   A = DIG / WHACK`, s.lives);
  if (s.levelDelay > 0) banner(g, 'LEVEL CLEARED!', 260);
  gameOver(g, s.over);
}

const game: GameDefinition<PanicState> = {
  id: 'pit-panic',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
