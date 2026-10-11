import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * Beat-'em-up archetype (BU). A scrolling street with depth: move across and into the screen, punch in
 * combos, jump-kick, pick up weapons. Waves of enemies lock the screen until they are beaten; a boss
 * closes each stage. Games pick the special move, enemy mix and whether there is any depth at all.
 */
export type FoeKind = 'thug' | 'fast' | 'knife' | 'big' | 'thrower' | 'gripper' | 'thief' | 'boss';

export interface BrawlerConfig {
  id: string;
  /** False = a single corridor (Kung-Fu Master style): no moving into the screen. */
  lanes: boolean;
  hp: number;
  /** Damage of the three punches in a combo. */
  combo: [number, number, number];
  reach: number;
  weapons: boolean;
  special: 'none' | 'spin' | 'magic';
  mix: Partial<Record<FoeKind, number>>;
  colors: { floor: string; wall: string; hero: string; accent: string };
}

export const STAGE_LEN = 3600;
const Y0 = 372;
const Y1 = 520;
const FLAT_Y = 470;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 30000;
const GRAV = 1300;
const JUMP_V = 430;
const MAX_ATTACKERS = 2;
const MAX_MAGIC = 6;

interface Fighter {
  x: number;
  y: number;
  z: number;
  vz: number;
  face: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'walk' | 'attack' | 'hurt' | 'down' | 'getup' | 'dead';
  /** Time in the current state. */
  t: number;
  /** The current swing has already landed. */
  hitDone: boolean;
  /** Knocked-back velocity, decaying. */
  kx: number;
}
export interface Foe extends Fighter {
  kind: FoeKind;
  cd: number;
  /** Seconds of windup left before a strike; 0 when not attacking. */
  wind: number;
  speed: number;
  dmg: number;
  reach: number;
  drop: 'none' | 'food' | 'pot' | 'knife' | 'bat';
  id: number;
}
interface Item {
  x: number;
  y: number;
  kind: 'food' | 'pot' | 'knife' | 'bat';
}
interface Crate {
  x: number;
  y: number;
  hp: number;
}
interface Knife {
  x: number;
  y: number;
  vx: number;
  /** Thrown at head height (true) or shin height (false). */
  high: boolean;
}
interface Segment {
  x: number;
  count: number;
  done: boolean;
  boss: boolean;
}

export interface BrawlerState {
  hero: Fighter & {
    combo: number;
    comboT: number;
    weapon: 'none' | 'knife' | 'bat';
    uses: number;
    magic: number;
    invuln: number;
    grabber: number;
    shake: number;
    kick: boolean;
    crouch: boolean;
  };
  foes: Foe[];
  items: Item[];
  crates: Crate[];
  knives: Knife[];
  segments: Segment[];
  locked: boolean;
  lockX: number;
  camX: number;
  lull: number;
  nextId: number;
  sparks: Spark[];
  go: number;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const KIND: Record<FoeKind, { hp: number; speed: number; dmg: number; reach: number; wind: number; points: number }> = {
  thug: { hp: 26, speed: 70, dmg: 8, reach: 34, wind: 0.42, points: 100 },
  fast: { hp: 18, speed: 120, dmg: 6, reach: 32, wind: 0.3, points: 150 },
  knife: { hp: 22, speed: 85, dmg: 11, reach: 42, wind: 0.38, points: 200 },
  big: { hp: 80, speed: 52, dmg: 16, reach: 42, wind: 0.6, points: 500 },
  thrower: { hp: 16, speed: 60, dmg: 0, reach: 0, wind: 0, points: 200 },
  gripper: { hp: 14, speed: 110, dmg: 0, reach: 22, wind: 0, points: 150 },
  thief: { hp: 14, speed: 130, dmg: 0, reach: 0, wind: 0, points: 150 },
  boss: { hp: 180, speed: 72, dmg: 18, reach: 46, wind: 0.34, points: 5000 },
};

export function createBrawler(cfg: BrawlerConfig): GameDefinition<BrawlerState> {
  const laneY = (y: number) => (cfg.lanes ? Math.min(Y1, Math.max(Y0, y)) : FLAT_Y);

  function fighter(x: number, y: number, hp: number): Fighter {
    return { x, y: laneY(y), z: 0, vz: 0, face: 1, hp, maxHp: hp, state: 'idle', t: 0, hitDone: false, kx: 0 };
  }

  function makeFoe(s: BrawlerState, kind: FoeKind, x: number, y: number): Foe {
    const k = KIND[kind];
    const hpScale = 1 + (s.level - 1) * 0.12;
    const f: Foe = { ...fighter(x, y, Math.round(k.hp * (kind === 'boss' ? 1 + (s.level - 1) * 0.25 : hpScale))), kind, cd: 0.6 + (s.nextId % 5) * 0.2, wind: 0, speed: k.speed + Math.min(s.level, 6) * 3, dmg: k.dmg + Math.min(s.level - 1, 4), reach: k.reach, drop: 'none', id: s.nextId++ };
    return f;
  }

  function buildStage(s: BrawlerState, rng: Rng): void {
    s.foes = [];
    s.items = [];
    s.crates = [];
    s.knives = [];
    s.segments = [];
    s.locked = false;
    s.lockX = 0;
    s.camX = 0;
    s.lull = 0;
    const n = Math.min(4 + s.level, 7);
    for (let k = 0; k < n; k++) {
      s.segments.push({ x: k === 0 ? 0 : 300 + (k * (STAGE_LEN - 900)) / n, count: Math.min(2 + s.level + Math.floor(k / 2), 6), done: false, boss: false });
    }
    s.segments.push({ x: STAGE_LEN - 760, count: 2, done: false, boss: true });
    const crateCount = cfg.weapons ? 5 : 3;
    for (let k = 0; k < crateCount; k++) s.crates.push({ x: 500 + k * ((STAGE_LEN - 1200) / crateCount) + rng.range(-80, 80), y: laneY(rng.range(Y0 + 10, Y1 - 10)), hp: 2 });
    if (cfg.weapons) s.items.push({ x: 900, y: laneY(440), kind: rng.pick(['knife', 'bat'] as const) });
    const hero = s.hero;
    Object.assign(hero, fighter(80, 460, cfg.hp), { combo: 0, comboT: 0, invuln: 1.5, grabber: -1, shake: 0, kick: false, crouch: false });
    hero.weapon = s.hero.weapon;
    s.go = 0;
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): BrawlerState {
    const s: BrawlerState = {
      hero: { ...fighter(80, 460, cfg.hp), combo: 0, comboT: 0, weapon: 'none', uses: 0, magic: 0, invuln: 1.5, grabber: -1, shake: 0, kick: false, crouch: false },
      foes: [],
      items: [],
      crates: [],
      knives: [],
      segments: [],
      locked: false,
      lockX: 0,
      camX: 0,
      lull: 0,
      nextId: 1,
      sparks: [],
      go: 0,
      respawn: 0,
      levelDelay: 0,
      nextLife: EXTRA_LIFE_EVERY,
      score: 0,
      hi: hiScore,
      lives: START_LIVES,
      level: 1,
      over: false,
    };
    buildStage(s, rng);
    return s;
  }

  function spawnWave(s: BrawlerState, seg: Segment, rng: Rng): void {
    const kinds = Object.entries(cfg.mix).flatMap(([k, w]) => Array.from({ length: w ?? 0 }, () => k as FoeKind));
    const pool = kinds.length > 0 ? kinds : (['thug'] as FoeKind[]);
    for (let k = 0; k < seg.count; k++) {
      const left = k % 2 === 0;
      const kind = rng.pick(pool);
      const f = makeFoe(s, kind, left ? s.camX - 40 - k * 24 : s.camX + W + 40 + k * 24, rng.range(Y0, Y1));
      if (kind === 'thief') f.drop = rng.next() < 0.5 ? 'pot' : 'food';
      else if (rng.next() < 0.12) f.drop = 'food';
      s.foes.push(f);
    }
    if (seg.boss) {
      s.foes.push(makeFoe(s, 'boss', s.camX + W + 80, FLAT_Y));
    }
  }

  function hurtHero(s: BrawlerState, dmg: number, fromX: number, rng: Rng, emit: UpdateContext['emit']): void {
    const h = s.hero;
    if (h.invuln > 0 || h.state === 'dead' || h.state === 'down' || h.state === 'getup') return;
    h.hp -= dmg;
    h.invuln = 0.55;
    h.state = 'hurt';
    h.t = 0;
    h.kx = Math.sign(h.x - fromX || 1) * 90;
    h.combo = 0;
    h.kick = false;
    burst(s.sparks, rng, h.x - s.camX, h.y - 50 - h.z, COLORS.coral, 8);
    emit('pickup');
    if (h.hp <= 0) {
      h.state = 'dead';
      h.t = 0;
      s.lives -= 1;
      s.respawn = 1.6;
      h.grabber = -1;
      emit('die');
      if (s.lives <= 0) s.over = true;
    }
  }

  function damageFoe(s: BrawlerState, f: Foe, dmg: number, knock: boolean, dir: number, rng: Rng, emit: UpdateContext['emit']): void {
    if (f.state === 'dead' || f.state === 'down' || f.state === 'getup') return;
    f.hp -= dmg;
    f.wind = 0;
    s.score += 10;
    burst(s.sparks, rng, f.x - s.camX, f.y - 50 - f.z, COLORS.gold, 5);
    if (f.hp <= 0) {
      f.state = 'dead';
      f.t = 0;
      f.kx = dir * 120;
      s.score += KIND[f.kind].points;
      if (f.drop !== 'none') s.items.push({ x: f.x, y: f.y, kind: f.drop });
      if (s.hero.grabber === f.id) s.hero.grabber = -1;
      emit('explode');
    } else if (knock && f.kind !== 'big' && f.kind !== 'boss') {
      f.state = 'down';
      f.t = 0;
      f.vz = 200;
      f.kx = dir * 140;
      emit('pickup');
    } else {
      f.state = 'hurt';
      f.t = 0;
      f.kx = dir * (f.kind === 'big' || f.kind === 'boss' ? 25 : 60);
      emit('pickup');
    }
  }

  function heroStrike(s: BrawlerState, reach: number, dmg: number, knock: boolean, rng: Rng, emit: UpdateContext['emit'], dzMax = 36): number {
    const h = s.hero;
    let hits = 0;
    for (const f of s.foes) {
      if (f.state === 'dead' || f.state === 'down' || f.state === 'getup') continue;
      const dx = (f.x - h.x) * h.face;
      if (dx > -8 && dx < reach && Math.abs(f.y - h.y) <= (cfg.lanes ? 18 : 60) && Math.abs(f.z - h.z) < dzMax) {
        damageFoe(s, f, dmg, knock, h.face, rng, emit);
        hits += 1;
      }
    }
    for (const c of s.crates) {
      const dx = (c.x - h.x) * h.face;
      if (c.hp > 0 && dx > -8 && dx < reach && Math.abs(c.y - h.y) <= (cfg.lanes ? 20 : 60)) {
        c.hp -= 1;
        hits += 1;
        if (c.hp <= 0) {
          s.score += 200;
          const roll = rng.next();
          s.items.push({ x: c.x, y: c.y, kind: roll < 0.5 ? 'food' : cfg.weapons && roll < 0.8 ? 'knife' : cfg.special === 'magic' ? 'pot' : 'food' });
          emit('explode');
        }
      }
    }
    return hits;
  }

  function update(s: BrawlerState, input: Input, dt: number, ctx: UpdateContext): void {
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
        buildStage(s, rng);
        emit('wave');
      }
      return;
    }
    const h = s.hero;
    s.go = Math.max(0, s.go - dt);

    // ---- the hero
    if (h.state === 'dead') {
      s.respawn -= dt;
      if (s.respawn <= 0) {
        Object.assign(h, { hp: cfg.hp, state: 'idle', t: 0, invuln: 2.5, combo: 0, z: 0, vz: 0, kick: false, grabber: -1 });
        h.weapon = 'none';
        // Push anything standing on the spot away.
        for (const f of s.foes) if (Math.abs(f.x - h.x) < 70 && f.state !== 'dead') f.x += (f.x < h.x ? -1 : 1) * 80;
      }
    } else {
      h.t += dt;
      h.invuln = Math.max(0, h.invuln - dt);
      h.comboT = Math.max(0, h.comboT - dt);
      if (h.comboT <= 0 && h.state !== 'attack') h.combo = 0;
      h.x += h.kx * dt;
      h.kx *= Math.max(0, 1 - 7 * dt);
      const grounded = h.z <= 0 && h.vz <= 0;
      const held = h.state === 'hurt' || h.state === 'down' || h.state === 'getup';
      if (held) {
        if (h.t > (h.state === 'hurt' ? 0.3 : h.state === 'down' ? 0.8 : 0.35)) {
          h.state = h.state === 'down' ? 'getup' : 'idle';
          h.t = 0;
        }
      }
      const grabbed = h.grabber >= 0;
      h.crouch = !cfg.lanes && input.held.down && grounded && !grabbed;
      if (!held && h.state !== 'attack' && !grabbed && !h.crouch) {
        const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
        const dy = cfg.lanes ? (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0) : 0;
        const speed = grounded ? 150 : 110;
        h.x += dx * speed * dt;
        h.y = laneY(h.y + dy * 95 * dt);
        if (dx !== 0) h.face = dx;
        h.state = dx !== 0 || dy !== 0 ? 'walk' : 'idle';
      }
      if (grabbed) {
        // A gripper has you: shake free by mashing left and right, or beat it.
        if (input.pressed.left || input.pressed.right) h.shake += 1;
        h.hp -= 3 * dt;
        if (h.shake >= 6) {
          h.grabber = -1;
          h.shake = 0;
          const g = s.foes.find((f) => f.state !== 'dead' && f.kind === 'gripper' && Math.abs(f.x - h.x) < 60);
          if (g) g.x += (g.x < h.x ? -1 : 1) * 70;
        }
        if (h.hp <= 0) hurtHero(s, 1, h.x + 1, rng, emit);
      }
      // Jumping and gravity.
      if (input.pressed.b && grounded && !held && h.state !== 'attack' && !grabbed && !h.crouch) h.vz = JUMP_V;
      if (!grounded || h.vz > 0) {
        h.vz -= GRAV * dt;
        h.z += h.vz * dt;
        if (h.z <= 0) {
          h.z = 0;
          h.vz = 0;
          h.kick = false;
        }
      }
      // Attacks.
      if (input.pressed.a && !held) {
        const wp = h.weapon;
        const reach = cfg.reach + (wp === 'knife' ? 10 : wp === 'bat' ? 22 : 0);
        const mult = wp === 'knife' ? 1.8 : wp === 'bat' ? 2.4 : 1;
        if (cfg.special === 'spin' && input.held.down && cfg.lanes && grounded && h.hp > 8) {
          h.hp -= 6;
          h.invuln = Math.max(h.invuln, 0.6);
          h.state = 'attack';
          h.t = 0;
          emit('wave');
          for (const f of s.foes) if (Math.abs(f.x - h.x) < 90 && Math.abs(f.y - h.y) < 44) damageFoe(s, f, 14, true, Math.sign(f.x - h.x) || 1, rng, emit);
        } else if (cfg.special === 'magic' && input.held.up && h.magic > 0 && grounded) {
          const use = Math.min(h.magic, 3);
          h.magic -= use;
          h.state = 'attack';
          h.t = 0;
          emit('wave');
          for (const f of s.foes) if (f.x > s.camX - 20 && f.x < s.camX + W + 20) damageFoe(s, f, 18 * use, true, Math.sign(f.x - h.x) || 1, rng, emit);
        } else if (!grounded) {
          if (!h.kick) {
            h.kick = true;
            h.hitDone = false;
            emit('fire');
          }
        } else if (h.state !== 'attack' || h.t > 0.18) {
          h.combo = h.comboT > 0 ? (h.combo % 3) + 1 : 1;
          h.comboT = 0.55;
          h.state = 'attack';
          h.t = 0;
          h.hitDone = false;
          emit('fire');
          void reach;
          void mult;
        }
      }
      if (h.state === 'attack' && grounded && !h.hitDone && h.t >= 0.09) {
        h.hitDone = true;
        const wp = h.weapon;
        const reach = cfg.reach + (wp === 'knife' ? 10 : wp === 'bat' ? 22 : 0);
        const mult = wp === 'knife' ? 1.8 : wp === 'bat' ? 2.4 : 1;
        const step = Math.max(1, h.combo);
        if (!(cfg.special === 'spin' && input.held.down && h.hp <= 0)) {
          const hits = heroStrike(s, reach, Math.round(cfg.combo[step - 1]! * mult), step === 3, rng, emit);
          if (hits > 0 && wp !== 'none') {
            h.uses -= 1;
            if (h.uses <= 0) h.weapon = 'none';
          }
        }
      }
      if (h.state === 'attack' && h.t >= 0.28) {
        h.state = 'idle';
        h.t = 0;
      }
      if (h.kick && !h.hitDone && h.z > 8) {
        const hits = heroStrike(s, cfg.reach + 4, 12, true, rng, emit, 50);
        if (hits > 0) h.hitDone = true;
      }
      // Camera and bounds.
      if (s.locked) h.x = Math.min(s.lockX + W - 24, Math.max(s.lockX + 24, h.x));
      else h.x = Math.max(s.camX + 20, Math.min(STAGE_LEN, h.x));
      // Items.
      for (let i = s.items.length - 1; i >= 0; i--) {
        const it = s.items[i]!;
        if (Math.abs(it.x - h.x) < 26 && Math.abs(it.y - h.y) < 22 && h.z < 20) {
          if (it.kind === 'food') h.hp = Math.min(h.maxHp, h.hp + 30);
          else if (it.kind === 'pot') h.magic = Math.min(MAX_MAGIC, h.magic + 1);
          else {
            h.weapon = it.kind;
            h.uses = it.kind === 'knife' ? 12 : 8;
          }
          s.items.splice(i, 1);
          s.score += 50;
          emit('pickup');
        }
      }
    }

    // ---- stage flow
    const target = s.locked ? s.lockX : Math.max(0, Math.min(STAGE_LEN - W, h.x - 280));
    if (!s.locked) s.camX = Math.max(s.camX, target);
    for (const seg of s.segments) {
      if (!seg.done && !s.locked && h.x >= seg.x && s.camX + W > seg.x) {
        s.locked = true;
        s.lockX = s.camX;
        spawnWave(s, seg, rng);
        seg.done = true;
        s.lull = 0;
        break;
      }
    }
    // Thieves only run away, so they never hold the screen.
    if (s.locked && s.foes.every((f) => f.state === 'dead' || f.kind === 'thief')) {
      s.locked = false;
      s.foes = s.foes.filter((f) => f.kind !== 'thief' || f.state !== 'dead');
      s.go = 3;
      emit('wave');
    }
    // A foe-free, unlocked screen for too long brings stragglers, so waiting around never works.
    if (!s.locked && s.foes.filter((f) => f.state !== 'dead').length === 0 && h.state !== 'dead') {
      s.lull += dt;
      if (s.lull > 12) {
        s.lull = 0;
        for (let k = 0; k < 2; k++) s.foes.push(makeFoe(s, k === 0 ? 'thug' : 'fast', s.camX + (k === 0 ? -40 : W + 40), h.y));
      }
    }

    // ---- foes
    const attackers = s.foes.filter((f) => f.wind > 0).length;
    let tokens = MAX_ATTACKERS - attackers;
    for (let i = s.foes.length - 1; i >= 0; i--) {
      const f = s.foes[i]!;
      f.t += dt;
      f.cd = Math.max(0, f.cd - dt);
      f.x += f.kx * dt;
      f.kx *= Math.max(0, 1 - 6 * dt);
      if (f.state === 'dead') {
        if (f.t > 1.1) s.foes.splice(i, 1);
        continue;
      }
      if (f.state === 'down') {
        f.vz -= GRAV * dt;
        f.z = Math.max(0, f.z + f.vz * dt);
        if (f.z === 0 && f.t > 0.8) {
          f.state = 'getup';
          f.t = 0;
        }
        continue;
      }
      if (f.state === 'getup') {
        if (f.t > 0.4) {
          f.state = 'idle';
          f.t = 0;
        }
        continue;
      }
      if (f.state === 'hurt') {
        if (f.t > 0.35) {
          f.state = 'idle';
          f.t = 0;
        }
        continue;
      }
      if (h.state === 'dead') continue;
      const dx = h.x - f.x;
      const dy = h.y - f.y;
      f.face = Math.sign(dx) || f.face;

      if (f.kind === 'thief') {
        // Thieves run from you.
        f.x += -Math.sign(dx || 1) * f.speed * dt * (Math.abs(dx) < 260 ? 1 : 0.2);
        f.y = laneY(f.y + Math.sign(dy) * 30 * dt);
        continue;
      }
      if (f.kind === 'thrower') {
        // Keep a distance and throw knives at head or shin height.
        const want = 240;
        if (Math.abs(dx) > want + 30) f.x += Math.sign(dx) * f.speed * dt;
        else if (Math.abs(dx) < want - 40) f.x -= Math.sign(dx) * f.speed * dt;
        if (f.cd <= 0 && Math.abs(dx) < 420) {
          s.knives.push({ x: f.x, y: f.y, vx: Math.sign(dx) * 280, high: ((f.id + Math.floor(s.hero.hp)) & 1) === 0 });
          f.cd = 2.2;
        }
        continue;
      }
      if (f.kind === 'gripper') {
        if (h.grabber === f.id) continue;
        f.x += Math.sign(dx) * f.speed * dt;
        f.y = laneY(f.y + Math.sign(dy) * 40 * dt);
        if (Math.abs(dx) < f.reach && Math.abs(dy) < 20 && h.grabber < 0 && h.z < 10 && h.invuln <= 0) {
          h.grabber = f.id;
          h.shake = 0;
          emit('pickup');
        }
        continue;
      }
      // Fighters: close in, then wind up and strike.
      if (f.wind > 0) {
        f.wind -= dt;
        if (f.wind <= 0) {
          f.wind = 0;
          f.cd = f.kind === 'boss' ? 0.8 : 1.3;
          const hit = Math.abs(dx) < f.reach + 8 && Math.abs(dy) < 18 && h.z < 30 && (h.state as string) !== 'dead';
          if (hit && Math.sign(dx) === f.face) hurtHero(s, f.dmg, f.x, rng, emit);
        }
        continue;
      }
      const stand = f.reach - 8;
      const tx = h.x - Math.sign(dx || 1) * stand;
      const moveX = Math.sign(tx - f.x) * Math.min(f.speed * dt, Math.abs(tx - f.x));
      f.x += moveX;
      if (cfg.lanes) f.y = laneY(f.y + Math.sign(dy) * Math.min(Math.abs(dy), f.speed * 0.6 * dt));
      if (Math.abs(dx) < f.reach && Math.abs(dy) < 14 && f.cd <= 0 && tokens > 0) {
        f.wind = KIND[f.kind].wind;
        tokens -= 1;
      }
    }

    if (s.locked) for (const f of s.foes) f.x = Math.min(s.lockX + W - 10, Math.max(s.lockX + 10, f.x));

    // Thrown knives.
    for (let i = s.knives.length - 1; i >= 0; i--) {
      const k = s.knives[i]!;
      k.x += k.vx * dt;
      if (k.x < s.camX - 60 || k.x > s.camX + W + 60) {
        s.knives.splice(i, 1);
        continue;
      }
      if (h.state !== 'dead' && Math.abs(k.x - h.x) < 18 && Math.abs(k.y - h.y) < 24) {
        // A high knife sails over a crouching hero; a low one is jumped.
        const ducked = k.high && h.crouch;
        const jumped = !k.high && h.z > 24;
        if (!ducked && !jumped) {
          s.knives.splice(i, 1);
          hurtHero(s, 10, k.x - Math.sign(k.vx) * 20, rng, emit);
        }
      }
    }

    // Wooden crates disappear when broken.
    s.crates = s.crates.filter((c) => c.hp > 0);

    if (h.state !== 'dead' && STAGE_LEN - h.x < 60 && s.segments.every((q) => q.done) && s.foes.filter((f) => f.state !== 'dead' && f.kind !== 'thief').length === 0 && !s.locked) {
      s.score += 3000 + s.level * 500 + Math.floor(h.hp) * 20;
      s.levelDelay = 2;
      emit('wave');
    }
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function render(s: BrawlerState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    const sx = (x: number) => x - s.camX;
    g.fillStyle = cfg.colors.wall;
    g.fillRect(0, 0, W, 320);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let k = 0; k < 10; k++) {
      const x = ((k * 160 - s.camX * 0.5) % (W + 160) + W + 160) % (W + 160) - 80;
      g.fillRect(x, 60 + (k % 3) * 40, 70, 180);
    }
    g.fillStyle = cfg.colors.floor;
    g.fillRect(0, cfg.lanes ? Y0 - 30 : FLAT_Y - 20, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let x = -((s.camX) % 60); x < W; x += 60) {
      g.beginPath();
      g.moveTo(x, cfg.lanes ? Y0 - 30 : FLAT_Y - 20);
      g.lineTo(x - 30, H);
      g.stroke();
    }
    type Draw = { y: number; draw: () => void };
    const items: Draw[] = [];
    const person = (f: Fighter, color: string, accent: string, big = false) => () => {
      const x = sx(f.x);
      const w = big ? 30 : 22;
      const hgt = big ? 78 : 62;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(x, f.y + 4, w * 0.8, 6, 0, 0, 6.3);
      g.fill();
      const lying = f.state === 'down' || f.state === 'dead';
      const y = f.y - f.z;
      g.fillStyle = color;
      if (lying) g.fillRect(x - hgt / 2, y - 16, hgt, 16);
      else g.fillRect(x - w / 2, y - hgt, w, hgt);
      g.fillStyle = accent;
      if (!lying) g.fillRect(x - w / 2 - 1, y - hgt - 12, w + 2, 14);
      if (f.state === 'attack' && !lying) {
        g.fillStyle = COLORS.gold;
        g.fillRect(x + f.face * (w / 2 + 4) - 6, y - hgt * 0.7, 18, 8);
      }
    };
    for (const c of s.crates) items.push({ y: c.y, draw: () => { g.fillStyle = '#9b5a3c'; g.fillRect(sx(c.x) - 14, c.y - 28, 28, 28); } });
    for (const it of s.items) items.push({ y: it.y, draw: () => { g.fillStyle = it.kind === 'food' ? COLORS.coral : it.kind === 'pot' ? COLORS.purple : it.kind === 'knife' ? COLORS.paper : COLORS.gold; g.fillRect(sx(it.x) - 8, it.y - 14, 16, 12); } });
    for (const f of s.foes) {
      const col = f.kind === 'boss' ? COLORS.coral : f.kind === 'big' ? COLORS.purple : f.kind === 'fast' ? COLORS.gold : f.kind === 'knife' ? COLORS.cyan : f.kind === 'thief' ? COLORS.paper : f.kind === 'gripper' ? '#7BE495' : f.kind === 'thrower' ? COLORS.muted : '#6b8fd0';
      items.push({ y: f.y, draw: () => {
        person(f, col, f.wind > 0 && Math.floor(time * 20) % 2 ? COLORS.paper : '#e8d2b0', f.kind === 'big' || f.kind === 'boss')();
        if (f.hp < f.maxHp && f.state !== 'dead') {
          g.fillStyle = COLORS.muted;
          g.fillRect(sx(f.x) - 18, f.y - 100 - f.z, 36, 4);
          g.fillStyle = COLORS.coral;
          g.fillRect(sx(f.x) - 18, f.y - 100 - f.z, (36 * Math.max(0, f.hp)) / f.maxHp, 4);
        }
      } });
    }
    const hero = s.hero;
    if (hero.state !== 'dead' && (hero.invuln <= 0 || Math.floor(time * 12) % 2 === 0)) items.push({ y: hero.y, draw: () => {
      if (hero.crouch) {
        g.fillStyle = cfg.colors.hero;
        g.fillRect(sx(hero.x) - 12, hero.y - 36, 24, 36);
        g.fillStyle = '#e8d2b0';
        g.fillRect(sx(hero.x) - 11, hero.y - 46, 22, 14);
      } else person(hero, cfg.colors.hero, '#e8d2b0')();
      if (hero.kick) {
        g.fillStyle = COLORS.gold;
        g.fillRect(sx(hero.x) + hero.face * 14, hero.y - hero.z - 24, 26, 8);
      }
    } });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    for (const k of s.knives) {
      g.fillStyle = COLORS.paper;
      g.fillRect(sx(k.x) - 8, k.y - (k.high ? 52 : 16), 16, 4);
    }
    drawSparks(g, s.sparks);
    // Health, magic and weapon.
    g.fillStyle = COLORS.muted;
    g.fillRect(22, 40, 200, 12);
    g.fillStyle = hero.hp > cfg.hp * 0.3 ? COLORS.cyan : COLORS.coral;
    g.fillRect(22, 40, (200 * Math.max(0, hero.hp)) / cfg.hp, 12);
    const extra = [hero.weapon !== 'none' ? `${hero.weapon.toUpperCase()} ${hero.uses}` : '', cfg.special === 'magic' ? `MAGIC ${hero.magic}` : ''].filter(Boolean).join('  ');
    hud(g, s, `STAGE ${s.level}  ${extra}`, s.lives);
    if (s.go > 0 && Math.floor(time * 4) % 2) banner(g, 'GO →', 150);
    if (s.levelDelay > 0) banner(g, 'STAGE CLEAR!', 270);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
