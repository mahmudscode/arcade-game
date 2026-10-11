import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * Vertical road archetype (RT). A winding road scrolls down the screen. In `spy` mode you shoot
 * (machine gun, missiles from weapon vans) and must spare civilians; in `bump` mode your car
 * bounces: jump over water, land on rivals to squash them and shoulder them off the road.
 */
export interface VRoadConfig {
  id: string;
  mode: 'spy' | 'bump';
  colors: { ground: string; road: string; edge: string; car: string };
}

type Kind = 'civilian' | 'blade' | 'lord' | 'van' | 'buggy';

const PY = H - 150;
const START_LIVES = 3;
const LEVEL_DIST = 4000;
const EXTRA_LIFE_EVERY = 30000;
const LATERAL = 300;
const MIN_SPEED = 120;
const MAX_SPEED = 340;
const CRUISE = 220;
const GRAV = 1000;
const HOP_V = 280;
const BIG_V = 560;

interface Rival {
  kind: Kind;
  d: number;
  /** Lateral offset from the road centre. */
  off: number;
  v: number;
  hp: number;
  /** Seconds since this rival was last shoved by the player (credits road kills). */
  shoved: number;
}
interface Shot {
  x: number;
  d: number;
  missile: boolean;
}
interface Gap {
  d: number;
  len: number;
}

export interface VRoadState {
  /** Distance travelled, in pixels. */
  dist: number;
  x: number;
  speed: number;
  z: number;
  vz: number;
  jumpBuf: number;
  /** Lateral velocity from shoves. */
  kick: number;
  rivals: Rival[];
  shots: Shot[];
  gaps: Gap[];
  nextGap: number;
  nextSpawn: number;
  fire: number;
  missiles: number;
  jam: number;
  crash: number;
  invuln: number;
  phase: [number, number, number, number];
  sparks: Spark[];
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const RIVAL = { civilian: { v: 150, hp: 1, pts: 0 }, blade: { v: 290, hp: 1, pts: 150 }, lord: { v: 250, hp: 99, pts: 400 }, van: { v: 160, hp: 1, pts: 0 }, buggy: { v: 200, hp: 1, pts: 200 } } as const;

export const roadWidth = (level: number) => Math.max(250, 340 - level * 8);
export const roadCentre = (s: VRoadState, d: number) => W / 2 + (1 + Math.min(s.level, 6) * 0.07) * (68 * Math.sin(d / 175 + s.phase[0]) + 44 * Math.sin(d / 104 + s.phase[1]));

export function createVRoad(cfg: VRoadConfig): GameDefinition<VRoadState> {
  const spy = cfg.mode === 'spy';
  const widthAt = roadWidth;
  const centre = roadCentre;

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): VRoadState {
    const s: VRoadState = {
      dist: 0, x: W / 2, speed: CRUISE, z: 0, vz: 0, jumpBuf: 0, kick: 0, rivals: [], shots: [], gaps: [], nextGap: 900, nextSpawn: 1.5, fire: 0, missiles: 0, jam: 0, crash: 0, invuln: 2,
      phase: [rng.range(0, 6.28), rng.range(0, 6.28), 0, 0], sparks: [], nextLife: EXTRA_LIFE_EVERY, score: 0, hi: hiScore, lives: START_LIVES, level: 1, over: false,
    };
    s.x = centre(s, 0);
    return s;
  }

  function wreck(s: VRoadState, rng: Rng, emit: UpdateContext['emit']): void {
    if (s.crash > 0) return;
    s.crash = 1.4;
    s.lives -= 1;
    s.speed = 0;
    s.kick = 0;
    burst(s.sparks, rng, s.x, PY, COLORS.coral, 16);
    emit('die');
    if (s.lives <= 0) s.over = true;
  }

  function spawn(s: VRoadState, rng: Rng): void {
    const half = widthAt(s.level) / 2 - 36;
    const roll = rng.next();
    const lvl = Math.min(s.level, 8);
    let kind: Kind;
    if (spy) kind = roll < 0.3 ? 'civilian' : roll < 0.62 ? 'blade' : roll < 0.62 + 0.04 + lvl * 0.02 ? 'lord' : roll < 0.9 ? 'civilian' : 'van';
    else kind = roll < 0.45 ? 'civilian' : roll < 0.8 ? 'buggy' : 'blade';
    const behind = spy && kind !== 'civilian' && kind !== 'van' && rng.next() < 0.35;
    const base = RIVAL[kind].v;
    s.rivals.push({
      kind,
      d: behind ? s.dist - 160 : s.dist + H + 80,
      off: rng.range(-half, half),
      v: behind ? Math.max(base, s.speed + 50) : base + lvl * 4,
      hp: RIVAL[kind].hp,
      shoved: 99,
    });
  }

  function update(s: VRoadState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    stepSparks(s.sparks, dt);
    if (s.over) {
      if (input.pressed.a || input.pressed.start) {
        Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
        emit('start');
      }
      return;
    }
    s.invuln = Math.max(0, s.invuln - dt);
    s.jam = Math.max(0, s.jam - dt);
    s.fire = Math.max(0, s.fire - dt);

    if (s.crash > 0) {
      s.crash -= dt;
      if (s.crash <= 0) {
        s.crash = 0;
        s.x = centre(s, s.dist);
        s.z = 0;
        s.vz = 0;
        s.speed = CRUISE;
        s.invuln = 2.5;
        s.rivals = s.rivals.filter((r) => Math.abs(r.d - s.dist) > 140);
      }
    } else {
      // Speed: accelerate, brake, or settle at cruising speed.
      if (input.held.up) s.speed += 160 * dt;
      else if (input.held.down) s.speed -= 220 * dt;
      else s.speed += Math.sign(CRUISE - s.speed) * Math.min(Math.abs(CRUISE - s.speed), 60 * dt);
      s.speed = Math.min(MAX_SPEED + s.level * 4, Math.max(MIN_SPEED, s.speed));
      const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      s.x += (dx * LATERAL + s.kick) * dt;
      s.kick *= Math.max(0, 1 - 6 * dt);
      const before = Math.floor(s.dist * 0.1);
      s.dist += s.speed * dt;
      s.score += Math.floor(s.dist * 0.1) - before;

      // Jumping (bump mode).
      if (!spy) {
        s.jumpBuf = Math.max(0, s.jumpBuf - dt);
        if (input.pressed.a || input.pressed.b) s.jumpBuf = 0.15;
        if (s.z <= 0 && s.vz <= 0) {
          s.z = 0;
          s.vz = s.jumpBuf > 0 ? BIG_V : HOP_V;
          s.jumpBuf = 0;
          emit('fire');
        }
        s.vz -= GRAV * dt;
        s.z = Math.max(0, s.z + s.vz * dt);
        if (s.z === 0 && s.vz < 0) s.vz = 0;
      }

      // Guns (spy mode).
      if (spy) {
        if (input.held.a && s.fire <= 0 && s.jam <= 0) {
          s.fire = 0.12;
          s.shots.push({ x: s.x, d: s.dist + 30, missile: false });
          emit('fire');
        }
        if (input.pressed.b && s.missiles > 0 && s.jam <= 0) {
          s.missiles -= 1;
          s.shots.push({ x: s.x, d: s.dist + 30, missile: true });
          emit('wave');
        }
      }

      // The road edges and water.
      const off = Math.abs(s.x - centre(s, s.dist)) > widthAt(s.level) / 2 - 8;
      if (off && (spy || s.z <= 0) && s.invuln <= 0) wreck(s, rng, emit);
      else if (off && s.invuln > 0) s.x = Math.min(centre(s, s.dist) + widthAt(s.level) / 2 - 10, Math.max(centre(s, s.dist) - widthAt(s.level) / 2 + 10, s.x));
      if (!spy && s.z <= 0 && s.invuln <= 0) for (const g of s.gaps) if (s.dist > g.d && s.dist < g.d + g.len) wreck(s, rng, emit);
    }

    // ---- generation
    s.nextSpawn -= dt;
    if (s.nextSpawn <= 0) {
      spawn(s, rng);
      s.nextSpawn = Math.max(0.55, 1.5 - s.level * 0.08) * (0.6 + rng.next() * 0.8);
    }
    if (!spy) {
      while (s.nextGap < s.dist + H + 200) {
        s.gaps.push({ d: s.nextGap, len: rng.range(90, 120 + Math.min(s.level, 6) * 12) });
        s.nextGap += rng.range(700, 1200);
      }
      s.gaps = s.gaps.filter((g) => g.d + g.len > s.dist - 200);
    }

    // ---- rivals
    const half = widthAt(s.level) / 2;
    for (const r of s.rivals) {
      r.d += r.v * dt;
      r.shoved += dt;
      const dd = r.d - s.dist;
      if (s.crash <= 0 && Math.abs(dd) < 90 && (r.kind === 'blade' || r.kind === 'lord' || r.kind === 'buggy')) {
        const rx = centre(s, r.d) + r.off;
        const want = Math.sign(s.x - rx);
        r.off += want * (r.kind === 'lord' ? 70 : r.kind === 'buggy' ? 50 : 110) * dt;
      }
      if (Math.abs(r.off) > half - 6 && r.hp > 0 && r.kind !== 'van') {
        r.hp = 0;
        burst(s.sparks, rng, centre(s, r.d) + r.off, PY - dd, COLORS.gold, 6);
        emit('explode');
        if (r.shoved < 1.5) s.score += RIVAL[r.kind].pts + 100;
      }
    }

    // ---- shots
    for (const b of s.shots) {
      b.d += (b.missile ? 900 : 760) * dt;
      for (const r of s.rivals) {
        if (r.hp <= 0 || Math.abs(b.d - r.d) > 22 || Math.abs(b.x - (centre(s, r.d) + r.off)) > 18) continue;
        if (r.kind === 'van') continue;
        if (r.kind === 'lord' && !b.missile) {
          b.d = Infinity;
          burst(s.sparks, rng, b.x, PY - (r.d - s.dist), COLORS.paper, 2);
          break;
        }
        r.hp = 0;
        b.d = Infinity;
        burst(s.sparks, rng, b.x, PY - (r.d - s.dist), COLORS.gold, 8);
        emit('explode');
        if (r.kind === 'civilian') {
          s.jam = 4;
          s.score = Math.max(0, s.score - 300);
        } else s.score += RIVAL[r.kind].pts;
        break;
      }
    }
    s.shots = s.shots.filter((b) => b.d < s.dist + H + 60);

    // ---- player vs rivals
    if (s.crash <= 0) {
      for (const r of s.rivals) {
        if (r.hp <= 0) continue;
        const rx = centre(s, r.d) + r.off;
        const dd = r.d - s.dist;
        const dx = s.x - rx;
        if (Math.abs(dd) < 32 && Math.abs(dx) < 28) {
          if (r.kind === 'van') {
            r.hp = 0;
            s.missiles = Math.min(9, s.missiles + 4);
            s.score += 100;
            emit('pickup');
          } else if (!spy && s.z > 14 && s.vz < 0) {
            // Landing on a rival squashes it.
            r.hp = 0;
            s.vz = BIG_V * 0.8;
            s.score += RIVAL[r.kind].pts + 150;
            burst(s.sparks, rng, rx, PY - dd, COLORS.gold, 8);
            emit('explode');
          } else if (!spy && s.z > 14) {
            // Passing over a rival mid-air is harmless.
          } else if (s.invuln <= 0 || !spy) {
            const dir = Math.sign(dx || 1);
            const heavy = r.kind === 'lord' ? 1.6 : 1;
            s.kick += dir * 420 * heavy;
            r.off -= dir * 26 * (spy ? 0.4 : 1);
            r.shoved = 0;
            if (spy) s.speed = Math.max(MIN_SPEED, s.speed - 20);
            emit('pickup');
          }
        }
      }
    }
    s.rivals = s.rivals.filter((r) => r.hp > 0 && r.d > s.dist - 360 && r.d < s.dist + H + 360);

    // ---- levels
    if (Math.floor(s.dist / LEVEL_DIST) + 1 > s.level) {
      s.level += 1;
      s.score += 1000;
      emit('wave');
    }
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function render(s: VRoadState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    g.fillStyle = cfg.colors.ground;
    g.fillRect(0, 0, W, H);
    const w = widthAt(s.level);
    for (let y = 0; y < H; y += 6) {
      const d = s.dist + (PY - y);
      const cx = centre(s, d);
      g.fillStyle = cfg.colors.edge;
      g.fillRect(cx - w / 2 - 6, y, w + 12, 7);
      g.fillStyle = cfg.colors.road;
      g.fillRect(cx - w / 2, y, w, 7);
      if (Math.floor(d / 60) % 2 === 0) {
        g.fillStyle = COLORS.paper;
        g.fillRect(cx - 2, y, 4, 7);
      }
      for (const gp of s.gaps) {
        if (d > gp.d && d < gp.d + gp.len) {
          g.fillStyle = '#2b6cd0';
          g.fillRect(cx - w / 2 - 6, y, w + 12, 7);
        }
      }
    }
    const colorOf = (k: Kind) => (k === 'civilian' ? COLORS.paper : k === 'blade' ? COLORS.coral : k === 'lord' ? COLORS.purple : k === 'van' ? COLORS.gold : '#7BE495');
    for (const r of [...s.rivals].sort((a, b) => b.d - a.d)) {
      const x = centre(s, r.d) + r.off;
      const y = PY - (r.d - s.dist);
      g.fillStyle = colorOf(r.kind);
      const big = r.kind === 'lord' || r.kind === 'van';
      g.fillRect(x - (big ? 17 : 13), y - (big ? 30 : 24), big ? 34 : 26, big ? 60 : 48);
      g.fillStyle = COLORS.bg;
      g.fillRect(x - 8, y - 14, 16, 12);
    }
    for (const b of s.shots) {
      g.fillStyle = b.missile ? COLORS.coral : COLORS.gold;
      g.fillRect(b.x - 2, PY - (b.d - s.dist) - (b.missile ? 8 : 4), b.missile ? 5 : 3, b.missile ? 16 : 8);
    }
    if (s.crash <= 0 && (s.invuln <= 0 || Math.floor(time * 12) % 2 === 0)) {
      const lift = s.z * 0.4;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(s.x - 15, PY - 22, 30, 50);
      g.fillStyle = cfg.colors.car;
      g.fillRect(s.x - 14, PY - 26 - lift, 28, 52);
      g.fillStyle = COLORS.paper;
      g.fillRect(s.x - 9, PY - 14 - lift, 18, 14);
    }
    drawSparks(g, s.sparks);
    hud(g, s, spy ? `ZONE ${s.level}  MISSILES ${s.missiles}${s.jam > 0 ? '  GUNS JAMMED' : ''}` : `ZONE ${s.level}  SPEED ${Math.round(s.speed)}`, s.lives);
    if (s.crash > 0.8) banner(g, 'WRECKED!', 200);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
