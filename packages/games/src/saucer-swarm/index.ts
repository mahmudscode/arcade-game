import type { GameDefinition, GameStatus, Input, Rng, UpdateContext } from '@arcade/engine';

const W = 800;
const H = 570;

const COLORS = {
  bg: '#120a2a',
  paper: '#F6EFFF',
  gold: '#FFC93C',
  coral: '#FF5D73',
  cyan: '#4FE3D6',
  purple: '#A78BFA',
  muted: '#B7A9DB',
};
const ROW_COLORS = [COLORS.purple, COLORS.coral, COLORS.coral, COLORS.gold, COLORS.gold];
const ROW_POINTS = [30, 20, 20, 10, 10];

const COLS = 10;
const ROWS = 5;
const GAP_X = 48;
const GAP_Y = 40;
const SHIP_R = 15;
const PLAYER_Y = H - 70;
const PLAYER_SPEED = 300;
const SHOT_SPEED = 560;
const BOMB_SPEED = 220;
const MAX_BOMBS = 3;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_WAVE = 30;

const SHIELD_COUNT = 4;
const SHIELD_CELLS_X = 10;
const SHIELD_CELLS_Y = 5;
const CELL = 7;
const SHIELD_Y = PLAYER_Y - 80;

interface Bomb {
  x: number;
  y: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface SwarmState {
  /** Flat COLS*ROWS array; row 0 is the top row. */
  alive: boolean[];
  swarmX: number;
  swarmY: number;
  dir: 1 | -1;
  stepTimer: number;
  frame: number;
  player: { x: number; alive: boolean };
  shot: { x: number; y: number } | null;
  bombs: Bomb[];
  bombTimer: number;
  ufo: { x: number; dir: 1 | -1; value: number } | null;
  ufoTimer: number;
  /** Per shield, flat SHIELD_CELLS_X*SHIELD_CELLS_Y of intact cells. */
  shields: boolean[][];
  sparks: Spark[];
  stars: { x: number; y: number; s: number }[];
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  respawn: number;
  waveDelay: number;
  nextLife: number;
}

const shieldX = (i: number) => (W / SHIELD_COUNT) * (i + 0.5) - (SHIELD_CELLS_X * CELL) / 2;

function newSwarm(s: SwarmState): void {
  s.alive = Array.from({ length: COLS * ROWS }, () => true);
  s.swarmX = 60;
  s.swarmY = 70 + Math.min(s.wave - 1, 6) * 12;
  s.dir = 1;
  s.stepTimer = 0.5;
  s.bombs = [];
  s.shot = null;
}

function newShields(): boolean[][] {
  return Array.from({ length: SHIELD_COUNT }, () =>
    Array.from({ length: SHIELD_CELLS_X * SHIELD_CELLS_Y }, (_, i) => {
      const cx = i % SHIELD_CELLS_X;
      const cy = Math.floor(i / SHIELD_CELLS_X);
      // Cut a notch in the bottom middle so it reads as a bunker.
      return !(cy >= SHIELD_CELLS_Y - 2 && cx >= 3 && cx <= SHIELD_CELLS_X - 4);
    }),
  );
}

function burst(s: SwarmState, rng: Rng, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const v = rng.range(40, 200);
    s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rng.range(0.3, 0.6), color });
  }
}

function init({ rng, hiScore }: { rng: Rng; hiScore: number }): SwarmState {
  const s: SwarmState = {
    alive: [],
    swarmX: 0,
    swarmY: 0,
    dir: 1,
    stepTimer: 0,
    frame: 0,
    player: { x: W / 2, alive: true },
    shot: null,
    bombs: [],
    bombTimer: 1,
    ufo: null,
    ufoTimer: 15,
    shields: newShields(),
    sparks: [],
    stars: Array.from({ length: 60 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), s: rng.pick([1, 1, 2]) })),
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    respawn: 0,
    waveDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
  newSwarm(s);
  return s;
}

const aliveCount = (s: SwarmState) => s.alive.reduce((n, a) => n + (a ? 1 : 0), 0);
const shipX = (s: SwarmState, col: number) => s.swarmX + col * GAP_X;
const shipY = (s: SwarmState, row: number) => s.swarmY + row * GAP_Y;

/** Returns true if the point hit (and eroded) a shield cell. */
function hitShield(s: SwarmState, x: number, y: number, erode: number): boolean {
  for (let i = 0; i < SHIELD_COUNT; i++) {
    const cx = Math.floor((x - shieldX(i)) / CELL);
    const cy = Math.floor((y - SHIELD_Y) / CELL);
    if (cx < 0 || cx >= SHIELD_CELLS_X || cy < 0 || cy >= SHIELD_CELLS_Y) continue;
    const cells = s.shields[i]!;
    if (!cells[cy * SHIELD_CELLS_X + cx]) continue;
    cells[cy * SHIELD_CELLS_X + cx] = false;
    // Erode neighbours too so damage looks chunky.
    for (let k = 1; k < erode; k++) {
      const nx = cx + (k % 2 ? 1 : -1);
      if (nx >= 0 && nx < SHIELD_CELLS_X) cells[cy * SHIELD_CELLS_X + nx] = false;
    }
    return true;
  }
  return false;
}

function update(s: SwarmState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  s.frame += 1;

  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s, dt);
    return;
  }

  // Player.
  if (s.player.alive) {
    if (input.held.left) s.player.x -= PLAYER_SPEED * dt;
    if (input.held.right) s.player.x += PLAYER_SPEED * dt;
    s.player.x = Math.min(W - 24, Math.max(24, s.player.x));
    if ((input.pressed.a || input.held.a) && !s.shot) {
      s.shot = { x: s.player.x, y: PLAYER_Y - 16 };
      emit('fire');
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) {
      s.player.alive = true;
      s.player.x = W / 2;
    }
  }

  // Swarm march: fewer ships and higher waves step faster.
  const count = aliveCount(s);
  if (count > 0) {
    s.stepTimer -= dt;
    if (s.stepTimer <= 0) {
      const interval = Math.max(0.04, (0.06 + (count / (COLS * ROWS)) * 0.7) * (1 - Math.min(s.wave - 1, MAX_WAVE) * 0.012));
      s.stepTimer += interval;
      let minC = COLS;
      let maxC = -1;
      s.alive.forEach((a, i) => {
        if (!a) return;
        const c = i % COLS;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      });
      const left = shipX(s, minC) - SHIP_R;
      const right = shipX(s, maxC) + SHIP_R;
      if ((s.dir === 1 && right + 14 > W - 10) || (s.dir === -1 && left - 14 < 10)) {
        s.dir = s.dir === 1 ? -1 : 1;
        s.swarmY += 16;
      } else {
        s.swarmX += s.dir * 14;
      }
    }
  }

  // Bombs from the lowest ship of a random live column.
  s.bombTimer -= dt;
  if (s.bombTimer <= 0 && count > 0 && s.bombs.length < MAX_BOMBS + Math.floor(s.wave / 4)) {
    s.bombTimer = Math.max(0.35, 1.1 - s.wave * 0.03) * rng.range(0.6, 1.4);
    const cols: number[] = [];
    for (let c = 0; c < COLS; c++) if (s.alive.some((a, i) => a && i % COLS === c)) cols.push(c);
    const col = rng.pick(cols);
    for (let r = ROWS - 1; r >= 0; r--) {
      if (s.alive[r * COLS + col]) {
        s.bombs.push({ x: shipX(s, col), y: shipY(s, r) + 14 });
        break;
      }
    }
  }

  // Bonus UFO.
  if (s.ufo) {
    s.ufo.x += s.ufo.dir * 150 * dt;
    if (s.ufo.x < -40 || s.ufo.x > W + 40) s.ufo = null;
  } else {
    s.ufoTimer -= dt;
    if (s.ufoTimer <= 0) {
      s.ufoTimer = rng.range(18, 30);
      const dir = rng.pick<1 | -1>([1, -1]);
      s.ufo = { x: dir === 1 ? -30 : W + 30, dir, value: rng.int(1, 6) * 50 };
    }
  }

  // Player shot.
  if (s.shot) {
    s.shot.y -= SHOT_SPEED * dt;
    let spent = s.shot.y < 20;
    if (!spent && hitShield(s, s.shot.x, s.shot.y, 2)) spent = true;
    if (!spent && s.ufo && Math.abs(s.shot.x - s.ufo.x) < 26 && Math.abs(s.shot.y - 40) < 14) {
      s.score += s.ufo.value;
      burst(s, rng, s.ufo.x, 40, COLORS.cyan, 16);
      emit('pickup');
      s.ufo = null;
      spent = true;
    }
    if (!spent) {
      for (let i = 0; i < s.alive.length; i++) {
        if (!s.alive[i]) continue;
        const row = Math.floor(i / COLS);
        const x = shipX(s, i % COLS);
        const y = shipY(s, row);
        if (Math.abs(s.shot.x - x) < SHIP_R + 2 && Math.abs(s.shot.y - y) < SHIP_R) {
          s.alive[i] = false;
          s.score += ROW_POINTS[row]!;
          burst(s, rng, x, y, ROW_COLORS[row]!, 12);
          emit('explode');
          spent = true;
          break;
        }
      }
    }
    if (spent) s.shot = null;
  }

  // Bombs.
  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const b = s.bombs[i]!;
    b.y += BOMB_SPEED * dt;
    let remove = b.y > H;
    if (!remove && hitShield(s, b.x, b.y, 3)) remove = true;
    if (!remove && s.player.alive && Math.abs(b.x - s.player.x) < 18 && Math.abs(b.y - PLAYER_Y) < 14) {
      remove = true;
      s.player.alive = false;
      s.lives -= 1;
      s.respawn = 1.4;
      burst(s, rng, s.player.x, PLAYER_Y, COLORS.cyan, 26);
      emit('die');
      if (s.lives <= 0) s.over = true;
    }
    if (remove) s.bombs.splice(i, 1);
  }

  // Swarm reaching the shields or the cannon row ends the game.
  for (let i = 0; i < s.alive.length; i++) {
    if (s.alive[i] && shipY(s, Math.floor(i / COLS)) + SHIP_R >= PLAYER_Y - 10) {
      if (!s.over) {
        s.over = true;
        s.lives = 0;
        burst(s, rng, s.player.x, PLAYER_Y, COLORS.coral, 30);
        emit('die');
      }
      break;
    }
  }

  stepSparks(s, dt);

  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }

  if (!s.over && count === 0) {
    if (s.waveDelay <= 0) s.waveDelay = 1.4;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave = Math.min(s.wave + 1, MAX_WAVE);
      newSwarm(s);
      s.shields = newShields();
      emit('wave');
    }
  }

  if (s.score > s.hi) s.hi = s.score;
}

function stepSparks(s: SwarmState, dt: number): void {
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i]!;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) s.sparks.splice(i, 1);
  }
}

const pad = (n: number) => String(Math.min(n, 999999)).padStart(6, '0');

function drawSaucer(g: CanvasRenderingContext2D, x: number, y: number, color: string, wobble: boolean): void {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y + 3, SHIP_R, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.paper;
  g.beginPath();
  g.arc(x, y - 1, 7, Math.PI, 0);
  g.fill();
  g.fillStyle = COLORS.bg;
  const dx = wobble ? 4 : -4;
  g.fillRect(x - 9, y + 3, 4, 3);
  g.fillRect(x + 5, y + 3, 4, 3);
  g.fillRect(x + dx - 2, y + 9, 4, 3);
}

function render(s: SwarmState, g: CanvasRenderingContext2D, time: number): void {
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);

  g.fillStyle = COLORS.paper;
  g.globalAlpha = 0.5;
  for (const star of s.stars) g.fillRect(star.x, star.y, star.s, star.s);
  g.globalAlpha = 1;

  const wobble = Math.floor(s.swarmX / 14) % 2 === 0;
  for (let i = 0; i < s.alive.length; i++) {
    if (!s.alive[i]) continue;
    const row = Math.floor(i / COLS);
    drawSaucer(g, shipX(s, i % COLS), shipY(s, row), ROW_COLORS[row]!, wobble);
  }

  if (s.ufo) {
    g.fillStyle = COLORS.cyan;
    g.beginPath();
    g.ellipse(s.ufo.x, 40, 24, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.paper;
    g.fillRect(s.ufo.x - 8, 30, 16, 6);
  }

  g.fillStyle = COLORS.cyan;
  s.shields.forEach((cells, i) => {
    cells.forEach((on, k) => {
      if (on) g.fillRect(shieldX(i) + (k % SHIELD_CELLS_X) * CELL, SHIELD_Y + Math.floor(k / SHIELD_CELLS_X) * CELL, CELL - 1, CELL - 1);
    });
  });

  if (s.player.alive) {
    g.fillStyle = COLORS.cyan;
    g.fillRect(s.player.x - 20, PLAYER_Y, 40, 10);
    g.fillRect(s.player.x - 6, PLAYER_Y - 8, 12, 10);
    g.fillRect(s.player.x - 2, PLAYER_Y - 16, 4, 10);
  }

  g.fillStyle = COLORS.gold;
  if (s.shot) g.fillRect(s.shot.x - 2, s.shot.y - 8, 4, 14);
  g.fillStyle = COLORS.coral;
  for (const b of s.bombs) g.fillRect(b.x - 2, b.y - 7, 5, 14);

  for (const p of s.sparks) {
    g.globalAlpha = Math.max(0, p.life * 2);
    g.fillStyle = p.color;
    g.fillRect(p.x, p.y, 3, 3);
  }
  g.globalAlpha = 1;

  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);

  g.font = '14px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.fillStyle = COLORS.paper;
  g.fillText(`1UP  ${pad(s.score)}`, 22, 14);
  g.textAlign = 'right';
  g.fillStyle = COLORS.gold;
  g.fillText(`HI ${pad(Math.max(s.hi, s.score))}`, W - 22, 14);
  g.textAlign = 'left';
  g.fillStyle = COLORS.muted;
  g.fillText(`WAVE ${s.wave}`, 22, H - 30);
  g.fillStyle = COLORS.cyan;
  for (let i = 0; i < Math.max(0, s.lives); i++) g.fillRect(W - 40 - i * 22, H - 30, 14, 12);

  if (s.over) {
    g.fillStyle = 'rgba(18,10,42,0.72)';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.fillStyle = COLORS.coral;
    g.font = '32px "Press Start 2P", monospace';
    g.fillText('GAME OVER', W / 2, H / 2 - 40);
    g.fillStyle = COLORS.paper;
    g.font = '13px "Press Start 2P", monospace';
    g.fillText('PRESS SPACE TO PLAY AGAIN', W / 2, H / 2 + 20);
  }
  void time;
}

function status(s: SwarmState): GameStatus {
  return { score: s.score, hiScore: Math.max(s.hi, s.score), lives: Math.max(0, s.lives), level: s.wave, over: s.over };
}

const saucerSwarm: GameDefinition<SwarmState> = {
  id: 'saucer-swarm',
  size: { width: W, height: H },
  init,
  update,
  render,
  status,
};

export default saucerSwarm;
