import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const CELL = 26;
const COLS = 30;
const ROWS = 20;
const OX = (W - COLS * CELL) / 2;
const OY = 24;
const PLAYER_ROWS = 5;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 12000;

interface Segment { x: number; y: number; dir: 1 | -1; head: boolean }

export interface SnapState {
  /** Mushroom hit points per cell (0 = none). */
  mush: number[];
  segs: Segment[];
  segTimer: number;
  player: { x: number; y: number; alive: boolean };
  shot: { x: number; y: number } | null;
  sparks: Spark[];
  respawn: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  waveDelay: number;
  nextLife: number;
}

const mi = (x: number, y: number) => y * COLS + x;

function newWave(s: SnapState, rng: Rng): void {
  const len = Math.min(8 + s.level * 2, 20);
  s.segs = Array.from({ length: len }, (_, i) => ({ x: COLS - 1 - i, y: 0, dir: -1 as const, head: i === 0 }));
  // Each wave adds a few mushrooms.
  for (let i = 0; i < 6; i++) s.mush[mi(rng.int(0, COLS - 1), rng.int(1, ROWS - PLAYER_ROWS - 2))] = 4;
  s.segTimer = 0;
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): SnapState {
  const s: SnapState = {
    mush: Array.from({ length: COLS * ROWS }, () => 0),
    segs: [],
    segTimer: 0,
    player: { x: COLS / 2, y: ROWS - 1, alive: true },
    shot: null,
    sparks: [],
    respawn: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
    waveDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
  for (let i = 0; i < 24; i++) s.mush[mi(rng.int(0, COLS - 1), rng.int(1, ROWS - PLAYER_ROWS - 2))] = 4;
  newWave(s, rng);
  return s;
}

function update(s: SnapState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  const p = s.player;
  if (p.alive) {
    const sp = 14 * dt;
    if (input.held.left) p.x -= sp;
    if (input.held.right) p.x += sp;
    if (input.held.up) p.y -= sp;
    if (input.held.down) p.y += sp;
    p.x = Math.min(COLS - 1, Math.max(0, p.x));
    p.y = Math.min(ROWS - 1, Math.max(ROWS - PLAYER_ROWS, p.y));
    if (input.pressed.a && !s.shot) {
      s.shot = { x: Math.round(p.x), y: p.y };
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.player = { x: COLS / 2, y: ROWS - 1, alive: true };
      // A new life clears the segments from the lower field so you are not respawned into them.
      s.segs = s.segs.filter((g) => g.y < ROWS - PLAYER_ROWS);
    }
  }

  if (s.shot) {
    const shot = s.shot;
    shot.y -= 40 * dt;
    const cx = Math.round(shot.x);
    const cy = Math.floor(shot.y);
    let spent = shot.y < 0;
    if (!spent && cy >= 0 && s.mush[mi(cx, cy)]! > 0) {
      s.mush[mi(cx, cy)]! -= 1;
      if (s.mush[mi(cx, cy)] === 0) s.score += 5;
      spent = true;
      emit('fire');
    }
    if (!spent) {
      const i = s.segs.findIndex((g) => g.x === cx && g.y === cy);
      if (i >= 0) {
        const seg = s.segs[i]!;
        s.score += seg.head ? 100 : 10;
        s.mush[mi(seg.x, seg.y)] = 4;
        burst(s.sparks, rng, OX + seg.x * CELL + CELL / 2, OY + seg.y * CELL + CELL / 2, COLORS.cyan, 10);
        s.segs.splice(i, 1);
        // The segment behind becomes a new head.
        if (s.segs[i]) s.segs[i]!.head = true;
        emit('explode');
        spent = true;
      }
    }
    if (spent) s.shot = null;
  }

  s.segTimer += dt;
  const interval = Math.max(0.05, 0.14 - s.level * 0.006);
  if (s.segTimer >= interval) {
    s.segTimer -= interval;
    // Move heads first, then each follower takes the previous position of the one ahead.
    const prev = s.segs.map((g) => ({ x: g.x, y: g.y }));
    s.segs.forEach((g, i) => {
      if (g.head) {
        const nx = g.x + g.dir;
        if (nx < 0 || nx >= COLS || s.mush[mi(nx, g.y)]! > 0) {
          g.dir = (g.dir === 1 ? -1 : 1) as 1 | -1;
          g.y = Math.min(ROWS - 1, g.y + 1);
        } else g.x = nx;
        // Once in the player zone, bounce back up when hitting the bottom.
        if (g.y >= ROWS - 1 && g.x < 0) g.x = 0;
      } else {
        const lead = prev[i - 1]!;
        g.x = lead.x;
        g.y = lead.y;
        g.dir = s.segs[i - 1]!.dir;
      }
    });
  }

  if (p.alive) {
    for (const g of s.segs) {
      if (Math.abs(g.x - p.x) < 0.8 && Math.abs(g.y - p.y) < 0.8) {
        p.alive = false;
        s.lives -= 1;
        s.respawn = 1.3;
        burst(s.sparks, rng, OX + p.x * CELL + CELL / 2, OY + p.y * CELL + CELL / 2, COLORS.coral, 24);
        emit('die');
        if (s.lives <= 0) s.over = true;
        break;
      }
    }
  }

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }
  if (!s.over && s.segs.length === 0) {
    if (s.waveDelay <= 0) s.waveDelay = 1.2;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.level += 1;
      newWave(s, rng);
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: SnapState, g: CanvasRenderingContext2D): void {
  clear(g);
  s.mush.forEach((hp, i) => {
    if (hp <= 0) return;
    const x = OX + (i % COLS) * CELL;
    const y = OY + Math.floor(i / COLS) * CELL;
    g.fillStyle = hp > 2 ? COLORS.purple : COLORS.muted;
    g.fillRect(x + 4, y + 8, CELL - 8, CELL - 10);
    g.fillRect(x + 8, y + 4, CELL - 16, 6);
  });
  s.segs.forEach((seg) => {
    g.fillStyle = seg.head ? COLORS.gold : COLORS.cyan;
    g.beginPath();
    g.arc(OX + seg.x * CELL + CELL / 2, OY + seg.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    g.fill();
  });
  if (s.player.alive) {
    const x = OX + Math.round(s.player.x) * CELL + CELL / 2;
    const y = OY + s.player.y * CELL + CELL / 2;
    g.fillStyle = COLORS.coral;
    g.beginPath();
    g.moveTo(x, y - 12);
    g.lineTo(x - 11, y + 10);
    g.lineTo(x + 11, y + 10);
    g.fill();
  }
  if (s.shot) {
    g.fillStyle = COLORS.paper;
    g.fillRect(OX + Math.round(s.shot.x) * CELL + CELL / 2 - 2, OY + s.shot.y * CELL, 4, 12);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}`, s.lives);
  gameOver(g, s.over);
}

const game: GameDefinition<SnapState> = {
  id: 'segment-snap',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
