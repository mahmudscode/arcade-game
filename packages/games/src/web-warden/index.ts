import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { burst, clear, COLORS, drawSparks, gameOver, H, hud, makeStatus, stepSparks, TAU, W, type Spark } from '../_shared';

const CX = W / 2;
const CY = H / 2 + 6;
const LANES = 16;
const R_IN = 38;
const R_OUT = 225;
const MOVE_REPEAT = 0.085;
const SHOT_SPEED = 520;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 10000;
const MAX_WAVE = 30;
const KIND_POINTS = [150, 100, 250];

/** kind 0 flipper, 1 tanker (splits in two when shot), 2 spitter (climbs and fires down its lane). */
interface Foe {
  kind: number;
  lane: number;
  r: number;
  mode: 'climb' | 'rim';
  flipCd: number;
  cd: number;
}

export interface WardenState {
  foes: Foe[];
  lane: number;
  moveCd: number;
  alive: boolean;
  shots: { lane: number; r: number }[];
  fireCd: number;
  bolts: { lane: number; r: number }[];
  zap: boolean;
  zapFlash: number;
  toSpawn: number;
  spawnCd: number;
  sparks: Spark[];
  score: number;
  hi: number;
  lives: number;
  wave: number;
  over: boolean;
  respawn: number;
  waveDelay: number;
  nextLife: number;
}

const laneAngle = (lane: number) => ((lane + 0.5) / LANES) * TAU;
const rayAngle = (i: number) => (i / LANES) * TAU;
const pt = (lane: number, r: number) => ({ x: CX + Math.cos(laneAngle(lane)) * r, y: CY + Math.sin(laneAngle(lane)) * r });
const wrap = (lane: number) => ((lane % LANES) + LANES) % LANES;
/** Shortest signed lane distance from a to b around the rim. */
const laneDelta = (a: number, b: number) => {
  let d = wrap(b - a);
  if (d > LANES / 2) d -= LANES;
  return d;
};

function init({ hiScore }: { rng: Rng; hiScore: number }): WardenState {
  return {
    foes: [],
    lane: 0,
    moveCd: 0,
    alive: true,
    shots: [],
    fireCd: 0,
    bolts: [],
    zap: true,
    zapFlash: 0,
    toSpawn: 10,
    spawnCd: 1,
    sparks: [],
    score: 0,
    hi: hiScore,
    lives: START_LIVES,
    wave: 1,
    over: false,
    respawn: 0,
    waveDelay: 0,
    nextLife: EXTRA_LIFE_EVERY,
  };
}

function killPlayer(s: WardenState, rng: Rng, emit: UpdateContext['emit']): void {
  if (!s.alive) return;
  const p = pt(s.lane, R_OUT);
  burst(s.sparks, rng, p.x, p.y, COLORS.gold, 24);
  emit('die');
  s.alive = false;
  s.lives -= 1;
  s.respawn = 1.4;
  s.bolts = [];
  // Whatever sits on the rim is cleared so the next claw is not killed instantly.
  s.foes = s.foes.filter((f) => !(f.mode === 'rim' && f.lane === s.lane));
  if (s.lives <= 0) s.over = true;
}

function score(s: WardenState, rng: Rng, f: Foe, emit: UpdateContext['emit']): void {
  const p = pt(f.lane, f.r);
  s.score += KIND_POINTS[f.kind]! + (f.mode === 'rim' ? 50 : 0);
  burst(s.sparks, rng, p.x, p.y, f.kind === 1 ? COLORS.purple : f.kind === 2 ? COLORS.cyan : COLORS.coral, 12);
  emit('explode');
}

function update(s: WardenState, input: Input, dt: number, ctx: UpdateContext): void {
  const { rng, emit } = ctx;
  if (s.over) {
    if (input.pressed.a || input.pressed.start) {
      Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
      emit('start');
    }
    stepSparks(s.sparks, dt);
    return;
  }

  s.zapFlash = Math.max(0, s.zapFlash - dt);
  s.fireCd = Math.max(0, s.fireCd - dt);
  s.moveCd = Math.max(0, s.moveCd - dt);

  if (s.alive) {
    const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    if (dir !== 0 && (s.moveCd <= 0 || input.pressed.left || input.pressed.right)) {
      s.lane = wrap(s.lane + dir);
      s.moveCd = MOVE_REPEAT;
    }
    if ((input.pressed.a || input.held.a) && s.fireCd <= 0 && s.shots.length < 6) {
      s.fireCd = 0.13;
      s.shots.push({ lane: s.lane, r: R_OUT });
      emit('fire');
    }
    if (input.pressed.b && s.zap && s.foes.length > 0) {
      s.zap = false;
      s.zapFlash = 0.3;
      for (const f of s.foes) score(s, rng, f, emit);
      s.foes = [];
      s.toSpawn = Math.max(0, s.toSpawn - 4);
    }
  } else if (s.lives > 0) {
    s.respawn -= dt;
    if (s.respawn <= 0) s.alive = true;
  }

  // Spawning from the centre.
  s.spawnCd -= dt;
  if (s.toSpawn > 0 && s.spawnCd <= 0) {
    s.spawnCd = Math.max(0.45, 1.3 - s.wave * 0.04) * rng.range(0.7, 1.2);
    s.toSpawn -= 1;
    const roll = rng.next();
    const kind = roll < 0.25 ? 1 : roll < 0.4 && s.wave > 2 ? 2 : 0;
    s.foes.push({ kind, lane: rng.int(0, LANES - 1), r: R_IN, mode: 'climb', flipCd: rng.range(0.5, 1.5), cd: rng.range(1, 2.5) });
  }

  const climb = 45 + Math.min(s.wave, MAX_WAVE) * 3;
  for (const f of s.foes) {
    if (f.mode === 'climb') {
      f.r += climb * (f.kind === 1 ? 0.7 : 1) * dt;
      f.flipCd -= dt;
      if (f.kind === 0 && f.flipCd <= 0 && f.r < R_OUT - 30) {
        f.flipCd = rng.range(0.6, 1.4);
        f.lane = wrap(f.lane + rng.pick([-1, 1]));
      }
      if (f.kind === 2) {
        f.cd -= dt;
        if (f.cd <= 0) {
          f.cd = rng.range(1.2, 2.6);
          s.bolts.push({ lane: f.lane, r: f.r });
        }
      }
      if (f.r >= R_OUT) {
        f.r = R_OUT;
        f.mode = 'rim';
        f.flipCd = 0.35;
      }
    } else {
      // On the rim, hop around toward the claw.
      f.flipCd -= dt;
      if (f.flipCd <= 0) {
        f.flipCd = Math.max(0.15, 0.4 - s.wave * 0.01);
        const d = laneDelta(f.lane, s.lane);
        f.lane = wrap(f.lane + (d === 0 ? 0 : Math.sign(d)));
      }
    }
  }

  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i]!;
    sh.r -= SHOT_SPEED * dt;
    let spent = sh.r < R_IN;
    if (!spent) {
      let best = -1;
      for (let k = 0; k < s.foes.length; k++) {
        const f = s.foes[k]!;
        if (f.lane === sh.lane && Math.abs(f.r - sh.r) < 14 && (best < 0 || f.r > s.foes[best]!.r)) best = k;
      }
      if (best >= 0) {
        const f = s.foes[best]!;
        score(s, rng, f, emit);
        s.foes.splice(best, 1);
        if (f.kind === 1) {
          for (const d of [-1, 1]) s.foes.push({ kind: 0, lane: wrap(f.lane + d), r: f.r, mode: f.mode, flipCd: 0.5, cd: 1 });
        }
        spent = true;
      }
    }
    if (spent) s.shots.splice(i, 1);
  }

  for (let i = s.bolts.length - 1; i >= 0; i--) {
    const b = s.bolts[i]!;
    b.r += 230 * dt;
    if (b.r >= R_OUT) {
      if (s.alive && b.lane === s.lane) killPlayer(s, rng, emit);
      s.bolts.splice(i, 1);
    }
  }
  if (s.alive && s.foes.some((f) => f.mode === 'rim' && f.lane === s.lane)) killPlayer(s, rng, emit);

  stepSparks(s.sparks, dt);
  if (s.score >= s.nextLife) {
    s.lives += 1;
    s.nextLife += EXTRA_LIFE_EVERY;
    emit('pickup');
  }

  if (!s.over && s.toSpawn === 0 && s.foes.length === 0) {
    if (s.waveDelay <= 0) s.waveDelay = 1.6;
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) {
      s.wave += 1;
      s.toSpawn = 10 + Math.min(s.wave, MAX_WAVE) * 2;
      s.spawnCd = 1;
      s.zap = true;
      s.shots = [];
      s.bolts = [];
      emit('wave');
    }
  }
  if (s.score > s.hi) s.hi = s.score;
}

function render(s: WardenState, g: CanvasRenderingContext2D, time: number): void {
  clear(g);
  const webColor = s.zapFlash > 0 ? COLORS.paper : COLORS.purple;
  g.strokeStyle = webColor;
  g.lineWidth = 2;
  for (let i = 0; i < LANES; i++) {
    const a = rayAngle(i);
    g.beginPath();
    g.moveTo(CX + Math.cos(a) * R_IN, CY + Math.sin(a) * R_IN);
    g.lineTo(CX + Math.cos(a) * R_OUT, CY + Math.sin(a) * R_OUT);
    g.stroke();
  }
  for (const r of [R_IN, R_OUT]) {
    g.beginPath();
    g.arc(CX, CY, r, 0, TAU);
    g.stroke();
  }

  // Claw: highlight the player's lane on the rim.
  if (s.alive) {
    const a0 = rayAngle(s.lane);
    const a1 = rayAngle(s.lane + 1);
    g.strokeStyle = COLORS.gold;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(CX, CY, R_OUT + 4, a0, a1);
    g.stroke();
    g.lineWidth = 3;
    const m = pt(s.lane, R_OUT - 12);
    g.beginPath();
    g.moveTo(CX + Math.cos(a0) * (R_OUT + 8), CY + Math.sin(a0) * (R_OUT + 8));
    g.lineTo(m.x, m.y);
    g.lineTo(CX + Math.cos(a1) * (R_OUT + 8), CY + Math.sin(a1) * (R_OUT + 8));
    g.stroke();
  }

  g.fillStyle = COLORS.gold;
  for (const sh of s.shots) {
    const p = pt(sh.lane, sh.r);
    g.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  g.fillStyle = COLORS.coral;
  for (const b of s.bolts) {
    const p = pt(b.lane, b.r);
    g.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  for (const f of s.foes) {
    const p = pt(f.lane, f.r);
    const size = 6 + (f.r - R_IN) / 14;
    g.fillStyle = f.kind === 1 ? COLORS.purple : f.kind === 2 ? COLORS.cyan : COLORS.coral;
    g.beginPath();
    if (f.kind === 1) {
      g.arc(p.x, p.y, size, 0, TAU);
    } else {
      const a = laneAngle(f.lane);
      g.moveTo(p.x + Math.cos(a) * size, p.y + Math.sin(a) * size);
      g.lineTo(p.x + Math.cos(a + 2.2) * size * 1.3, p.y + Math.sin(a + 2.2) * size * 1.3);
      g.lineTo(p.x + Math.cos(a - 2.2) * size * 1.3, p.y + Math.sin(a - 2.2) * size * 1.3);
      g.closePath();
    }
    g.fill();
  }
  drawSparks(g, s.sparks);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  hud(g, s, `WAVE ${s.wave}  ZAP ${s.zap ? 'READY' : 'USED'}`, s.lives);
  void time;
  gameOver(g, s.over);
}

const webWarden: GameDefinition<WardenState> = {
  id: 'web-warden',
  size: { width: W, height: H },
  init,
  update,
  render,
  status: (s) => makeStatus(s, s.lives, s.wave),
};

export default webWarden;
