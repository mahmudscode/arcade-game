import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from '../_shared/ui';

const ROWS = 7;
const CW = 80;
const CH = 70;
const TOP_X = W / 2;
const TOP_Y = 90;
const START_LIVES = 3;
const HOP = 0.28;

interface Hopper { r: number; c: number; fr: number; fc: number; t: number; kind: 'ball' | 'snake'; wait: number }

export interface HopperState {
  /** Colour step per cube, indexed by row*(row+1)/2+col. Level target is `goal`. */
  cubes: number[];
  goal: number;
  player: { r: number; c: number; fr: number; fc: number; t: number; alive: boolean };
  foes: Hopper[];
  spawnTimer: number;
  falling: number;
  sparks: Spark[];
  levelDelay: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const cubeIndex = (r: number, c: number) => (r * (r + 1)) / 2 + c;
const onBoard = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c <= r;
const screen = (r: number, c: number) => ({ x: TOP_X + (c - r / 2) * CW, y: TOP_Y + r * CH });

function resetPlayer(s: HopperState): void {
  s.player = { r: 0, c: 0, fr: 0, fc: 0, t: 1, alive: true };
  s.falling = 0;
}

function init({ hiScore }: { rng: Rng; hiScore: number }): HopperState {
  const s: HopperState = {
    cubes: Array.from({ length: (ROWS * (ROWS + 1)) / 2 }, () => 0),
    goal: 1,
    player: { r: 0, c: 0, fr: 0, fc: 0, t: 1, alive: true },
    foes: [],
    spawnTimer: 2,
    falling: 0,
    sparks: [],
    levelDelay: 0,
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    level: 1,
    over: false,
  };
  s.cubes[0] = 1;
  return s;
}

function die(s: HopperState, rng: Rng, emit: UpdateContext['emit']): void {
  if (!s.player.alive) return;
  s.player.alive = false;
  s.lives -= 1;
  s.falling = 1.2;
  const p = screen(s.player.r, s.player.c);
  burst(s.sparks, rng, p.x, p.y - 20, COLORS.coral, 18);
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
  stepSparks(s.sparks, dt);

  if (s.levelDelay > 0) {
    s.levelDelay -= dt;
    if (s.levelDelay <= 0) {
      s.level += 1;
      s.goal = s.level >= 3 ? 2 : 1;
      s.cubes = s.cubes.map(() => 0);
      s.cubes[0] = 1;
      s.foes = [];
      resetPlayer(s);
      emit('wave');
    }
    return;
  }

  const p = s.player;
  if (!p.alive) {
    s.falling -= dt;
    if (s.falling <= 0 && s.lives > 0) {
      resetPlayer(s);
      s.foes = [];
    }
    return;
  }

  // Hopping: arrows map to the four diagonals.
  if (p.t >= 1) {
    const dir = input.pressed.up || input.held.up ? [-1, 0] : input.pressed.right || input.held.right ? [1, 1] : input.pressed.down || input.held.down ? [1, 0] : input.pressed.left || input.held.left ? [-1, -1] : null;
    if (dir) {
      p.fr = p.r;
      p.fc = p.c;
      p.r += dir[0]!;
      p.c += dir[1]!;
      p.t = 0;
      emit('fire');
    }
  } else {
    p.t = Math.min(1, p.t + dt / HOP);
    if (p.t >= 1) {
      if (!onBoard(p.r, p.c)) {
        die(s, rng, emit);
        return;
      }
      const i = cubeIndex(p.r, p.c);
      if (s.cubes[i]! < s.goal) {
        s.cubes[i]! += 1;
        s.score += 25;
        emit('pickup');
      }
      if (s.cubes.every((c) => c >= s.goal)) {
        s.score += 500;
        s.levelDelay = 1.4;
        s.foes = [];
        emit('explode');
      }
    }
  }

  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.foes.length < 2 + Math.floor(s.level / 2)) {
    s.spawnTimer = Math.max(1.2, 3.5 - s.level * 0.25);
    const kind = s.foes.some((f) => f.kind === 'snake') ? 'ball' : rng.pick<'ball' | 'snake'>(['ball', 'snake']);
    const c = rng.int(0, 1);
    s.foes.push({ r: 1, c, fr: 0, fc: 0, t: 1, kind, wait: 0.4 });
  }

  for (let i = s.foes.length - 1; i >= 0; i--) {
    const f = s.foes[i]!;
    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / (f.kind === 'ball' ? 0.45 : 0.4));
    } else {
      f.wait -= dt;
      if (f.wait <= 0) {
        f.fr = f.r;
        f.fc = f.c;
        if (f.kind === 'ball') {
          f.r += 1;
          f.c += rng.int(0, 1);
        } else {
          // The snake hops toward you along the pyramid.
          const wantR = p.r >= f.r ? 1 : -1;
          f.r += wantR;
          f.c += p.c > f.c ? (wantR === 1 ? 1 : 0) : wantR === 1 ? 0 : -1;
          f.c = Math.min(Math.max(f.c, 0), Math.max(0, f.r));
        }
        f.t = 0;
        f.wait = f.kind === 'ball' ? 0.2 : 0.35;
        if (!onBoard(f.r, f.c)) {
          s.foes.splice(i, 1);
          continue;
        }
      }
    }
    if (f.t >= 1 && f.r === p.r && f.c === p.c && p.t >= 1) die(s, rng, emit);
  }
  if (s.score > s.hi) s.hi = s.score;
}

function cubePos(r: number, c: number, fr: number, fc: number, t: number): { x: number; y: number } {
  const a = screen(fr, fc);
  const b = screen(r, c);
  const arc = Math.sin(Math.min(1, t) * Math.PI) * 28;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - arc };
}

function render(s: HopperState, g: CanvasRenderingContext2D): void {
  clear(g);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      const { x, y } = screen(r, c);
      const v = s.cubes[cubeIndex(r, c)]!;
      const top = v >= s.goal ? COLORS.gold : v === 1 ? COLORS.cyan : COLORS.purple;
      g.fillStyle = top;
      g.beginPath();
      g.moveTo(x, y - 18);
      g.lineTo(x + 36, y);
      g.lineTo(x, y + 18);
      g.lineTo(x - 36, y);
      g.fill();
      g.fillStyle = '#3b2a78';
      g.beginPath();
      g.moveTo(x - 36, y);
      g.lineTo(x, y + 18);
      g.lineTo(x, y + 44);
      g.lineTo(x - 36, y + 26);
      g.fill();
      g.fillStyle = '#271a55';
      g.beginPath();
      g.moveTo(x + 36, y);
      g.lineTo(x, y + 18);
      g.lineTo(x, y + 44);
      g.lineTo(x + 36, y + 26);
      g.fill();
    }
  }
  for (const f of s.foes) {
    const p = cubePos(f.r, f.c, f.fr, f.fc, f.t);
    g.fillStyle = f.kind === 'ball' ? COLORS.coral : '#7BE495';
    g.beginPath();
    g.arc(p.x, p.y - 16, f.kind === 'ball' ? 12 : 10, 0, Math.PI * 2);
    g.fill();
  }
  if (s.player.alive || s.falling > 0.6) {
    const p = cubePos(s.player.r, s.player.c, s.player.fr, s.player.fc, s.player.t);
    const drop = s.player.alive ? 0 : (1.2 - s.falling) * 200;
    g.fillStyle = COLORS.gold;
    g.beginPath();
    g.arc(p.x, p.y - 18 + drop, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.coral;
    g.fillRect(p.x - 4, p.y - 18 + drop, 14, 5);
  }
  drawSparks(g, s.sparks);
  hud(g, s, `LEVEL ${s.level}  TARGET ${s.goal === 2 ? '2 HOPS' : '1 HOP'}`, s.lives);
  if (s.levelDelay > 0) banner(g, 'PYRAMID DONE!', 300);
  gameOver(g, s.over);
}

const game: GameDefinition<HopperState> = {
  id: 'cube-hopper',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.level),
};
export default game;
