import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';
import { DEFAULT_PLAT, newBody, stepBody, type Body, type PlatConfig, type PlatWorld } from './platformer';

/**
 * Side-scrolling action platformer archetype (SC). A procedurally generated strip of ground with pits,
 * steps, spikes and floating ledges; enemies wake up as the hero approaches; a boss guards the end.
 * Games choose their weapon, enemy mix and a few optional mechanics (armour, energy, ammo, hostages...).
 */
export type EnemyKind = 'walker' | 'hopper' | 'flyer' | 'shooter' | 'zombie';

export interface Weapon {
  /** throw: straight shot; arc: lobbed shot; melee: short reach; hybrid: melee when close, else throw. */
  kind: 'throw' | 'arc' | 'melee' | 'hybrid';
  cd: number;
  speed: number;
  /** Reach of a melee swing, in tiles. */
  reach: number;
  dmg: number;
  /** Shots in flight at once. */
  max: number;
  /** Seconds a shot lives. */
  life: number;
}

export interface ScrollerConfig {
  id: string;
  weapon: Weapon;
  /** Spawn weights for the ordinary enemies. */
  mix: Partial<Record<EnemyKind, number>>;
  /** Hits the hero can take (1 = every hit is fatal). */
  health: number;
  /** Energy drains over time; fruit refills it (Wonder Boy). */
  energy?: boolean;
  /** Limited ammunition, refilled at doors (Rolling Thunder). */
  ammo?: number;
  /** Zombies rise from the ground near the hero (Ghosts 'n Goblins). */
  rising?: boolean;
  /** Hostages to rescue along the way (Shinobi). */
  hostages?: boolean;
  /** Doors along the route restock ammo and release a guard (Rolling Thunder). */
  doors?: boolean;
  jump: number;
  walk: number;
  pitRate: number;
  spikeRate: number;
  ledgeRate: number;
  colors: { sky: string; ground: string; top: string; accent: string };
}

export const ROWS = 18;
export const CELL = 27;
export const VIEW = 30;
const BASE = 14;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const CHECK_EVERY = 45;

export interface Foe {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  cd: number;
  t: number;
  dir: number;
  /** Set once the hero gets close; sleeping foes do nothing. */
  awake: boolean;
  dead: boolean;
  onGround: boolean;
}
interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  mine: boolean;
  dmg: number;
}
interface Item {
  x: number;
  y: number;
  kind: 'fruit' | 'ammo' | 'coin';
}
interface Hostage {
  x: number;
  y: number;
  saved: boolean;
}
interface Door {
  x: number;
  used: boolean;
}

export interface ScrollerState {
  len: number;
  /** Top row of the ground in each column, -1 for a pit. */
  top: number[];
  /** One-way ledges: [row, from, to]. */
  ledges: [number, number, number][];
  spikes: number[];
  hero: Body & { alive: boolean; hp: number; invuln: number; cd: number; ammo: number; energy: number; swing: number };
  foes: Foe[];
  shots: Shot[];
  items: Item[];
  hostages: Hostage[];
  doors: Door[];
  boss: { x: number; y: number; hp: number; maxHp: number; dir: number; cd: number; awake: boolean; dead: boolean; body: Body };
  flag: boolean;
  checkpoint: number;
  riseTimer: number;
  sparks: Spark[];
  time: number;
  /** Seconds left to finish the stage. */
  clock: number;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const POINTS: Record<EnemyKind, number> = { walker: 100, hopper: 150, flyer: 150, shooter: 250, zombie: 100 };
const HP: Record<EnemyKind, number> = { walker: 1, hopper: 1, flyer: 1, shooter: 2, zombie: 1 };

export function createScroller(cfg: ScrollerConfig): GameDefinition<ScrollerState> {
  const heroCfg: PlatConfig = { ...DEFAULT_PLAT, walk: cfg.walk, jump: cfg.jump, air: 1 };
  const foeCfg: PlatConfig = { ...DEFAULT_PLAT, walk: 1.8, jump: 11 };

  const world = (s: ScrollerState): PlatWorld => ({
    solid: (tx, ty) => tx < 0 || tx >= s.len + 2 || (tx < s.len && s.top[tx]! >= 0 && ty >= s.top[tx]!),
    platform: (tx, ty) => s.ledges.some(([r, a, b]) => r === ty && tx >= a && tx <= b),
  });

  function generate(s: ScrollerState, rng: Rng): void {
    s.len = Math.min(150 + s.level * 20, 260);
    s.top = [];
    s.ledges = [];
    s.spikes = [];
    let row = BASE;
    let x = 0;
    while (x < s.len) {
      const arena = x > s.len - 32;
      const r = rng.next();
      if (x < 12 || arena) {
        const n = Math.min(arena ? s.len - x : 12 - x, 8);
        for (let i = 0; i < n; i++) s.top.push(row);
        x += n;
      } else if (r < cfg.pitRate) {
        const w = rng.int(2, 3);
        for (let i = 0; i < w; i++) s.top.push(-1);
        x += w;
        // Land on a flat stretch after every pit.
        for (let i = 0; i < 3; i++) s.top.push(row);
        x += 3;
      } else if (r < cfg.pitRate + 0.18) {
        row = Math.max(11, Math.min(15, row + rng.pick([-1, 1])));
        const n = rng.int(4, 7);
        for (let i = 0; i < n; i++) s.top.push(row);
        x += n;
      } else {
        const n = rng.int(6, 11);
        const start = x;
        for (let i = 0; i < n; i++) s.top.push(row);
        x += n;
        if (rng.next() < cfg.ledgeRate && n >= 6) s.ledges.push([row - 4, start + 1, start + n - 2]);
        if (rng.next() < cfg.spikeRate && n >= 6) s.spikes.push(start + rng.int(2, n - 3));
      }
    }
    s.top.length = s.len;
  }

  function place(s: ScrollerState, rng: Rng): void {
    s.foes = [];
    s.items = [];
    s.hostages = [];
    s.doors = [];
    const count = Math.min(22 + s.level * 5, 60);
    const kinds = Object.entries(cfg.mix).flatMap(([k, w]) => Array.from({ length: w ?? 0 }, () => k as EnemyKind));
    const pool = kinds.length > 0 ? kinds : (['walker'] as EnemyKind[]);
    const safe = (c: number) => c > 0 && s.top[c]! >= 0 && !s.spikes.includes(c);
    for (let k = 0; k < count; k++) {
      const c = rng.int(16, s.len - 36);
      if (!safe(c)) continue;
      const kind = rng.pick(pool);
      if (kind === 'zombie') continue;
      const flying = kind === 'flyer';
      s.foes.push({ kind, x: c + 0.5, y: flying ? s.top[c]! - rng.range(2.5, 5) : s.top[c]!, vx: 0, vy: 0, hp: HP[kind], cd: rng.range(0.6, 2), t: 0, dir: -1, awake: false, dead: false, onGround: !flying });
    }
    const goodies = Math.min(12 + s.level * 2, 24);
    for (let k = 0; k < goodies; k++) {
      const c = rng.int(8, s.len - 34);
      if (!safe(c)) continue;
      const kind: Item['kind'] = cfg.energy ? 'fruit' : cfg.ammo && rng.next() < 0.4 ? 'ammo' : 'coin';
      s.items.push({ x: c + 0.5, y: s.top[c]! - rng.range(0.6, 2.2), kind });
    }
    if (cfg.hostages) {
      for (let k = 0; k < 3; k++) {
        const c = Math.floor((s.len - 40) * ((k + 1) / 4)) + rng.int(-4, 4);
        if (safe(c)) s.hostages.push({ x: c + 0.5, y: s.top[c]!, saved: false });
      }
    }
    if (cfg.doors) {
      for (let k = 0; k < 6; k++) {
        const c = Math.floor((s.len - 40) * ((k + 0.7) / 6));
        if (safe(c)) s.doors.push({ x: c + 0.5, used: false });
      }
    }
  }

  function resetHero(s: ScrollerState, atX: number): void {
    const c = Math.max(1, Math.min(s.len - 2, Math.floor(atX)));
    const row = s.top[c]! >= 0 ? s.top[c]! : BASE;
    Object.assign(s.hero, newBody(c + 0.5, row), { alive: true, hp: cfg.health, invuln: 2, cd: 0, swing: 0 });
    s.hero.onGround = true;
    if (cfg.ammo) s.hero.ammo = Math.max(s.hero.ammo, Math.floor(cfg.ammo / 2));
    s.hero.energy = Math.max(s.hero.energy, 60);
  }

  function buildLevel(s: ScrollerState, rng: Rng): void {
    generate(s, rng);
    place(s, rng);
    s.shots = [];
    s.flag = false;
    s.checkpoint = 1;
    s.riseTimer = 2;
    s.time = 0;
    s.clock = 150 + Math.floor(s.len * 0.6);
    const maxHp = 10 + s.level * 3;
    s.boss = { x: s.len - 8, y: s.top[s.len - 8]!, hp: maxHp, maxHp, dir: -1, cd: 2, awake: false, dead: false, body: newBody(s.len - 8, s.top[s.len - 8]!) };
    s.boss.body.onGround = true;
    s.hero.ammo = cfg.ammo ?? 0;
    s.hero.energy = 100;
    resetHero(s, 1);
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): ScrollerState {
    const s: ScrollerState = {
      len: 0,
      top: [],
      ledges: [],
      spikes: [],
      hero: { ...newBody(1.5, BASE), alive: true, hp: cfg.health, invuln: 2, cd: 0, ammo: cfg.ammo ?? 0, energy: 100, swing: 0 },
      foes: [],
      shots: [],
      items: [],
      hostages: [],
      doors: [],
      boss: { x: 0, y: 0, hp: 1, maxHp: 1, dir: -1, cd: 2, awake: false, dead: false, body: newBody(0, 0) },
      flag: false,
      checkpoint: 1,
      riseTimer: 2,
      sparks: [],
      time: 0,
      clock: 240,
      respawn: 0,
      levelDelay: 0,
      nextLife: EXTRA_LIFE_EVERY,
      score: 0,
      hi: hiScore,
      lives: START_LIVES,
      level: 1,
      over: false,
    };
    buildLevel(s, rng);
    return s;
  }

  const px = (s: ScrollerState, x: number) => (x - Math.max(0, Math.min(s.len - VIEW, s.hero.x - 9))) * CELL;
  const py = (y: number) => 60 + y * CELL;

  function hurtHero(s: ScrollerState, rng: Rng, emit: UpdateContext['emit']): void {
    const hero = s.hero;
    if (!hero.alive || hero.invuln > 0) return;
    hero.hp -= 1;
    hero.invuln = 1.6;
    burst(s.sparks, rng, px(s, hero.x) , py(hero.y - 1), COLORS.coral, 10);
    emit('pickup');
    if (hero.hp <= 0) {
      hero.alive = false;
      s.lives -= 1;
      s.respawn = 1.6;
      emit('die');
      if (s.lives <= 0) s.over = true;
    }
  }

  function killHeroOutright(s: ScrollerState, rng: Rng, emit: UpdateContext['emit']): void {
    s.hero.invuln = 0;
    s.hero.hp = 1;
    hurtHero(s, rng, emit);
  }

  function update(s: ScrollerState, input: Input, dt: number, ctx: UpdateContext): void {
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
    const w = world(s);
    const hero = s.hero;
    s.time += dt;
    if (hero.alive) {
      s.clock -= dt;
      if (s.clock <= 0) {
        // Out of time: the stage is lost, but you get a minute to finish it.
        s.clock = 60;
        killHeroOutright(s, rng, emit);
        if (s.over) return;
      }
    }

    if (!hero.alive) {
      s.respawn -= dt;
      if (s.respawn <= 0) {
        resetHero(s, s.checkpoint);
        s.shots = s.shots.filter((sh) => sh.mine);
      }
    } else {
      hero.invuln = Math.max(0, hero.invuln - dt);
      hero.cd = Math.max(0, hero.cd - dt);
      hero.swing = Math.max(0, hero.swing - dt);
      stepBody(hero, w, { dir: (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), up: false, down: false, jump: input.pressed.b || input.pressed.up }, dt, heroCfg);
      hero.x = Math.min(s.len - 0.5, Math.max(0.5, hero.x));
      if (hero.y > ROWS + 2) killHeroOutright(s, rng, emit);
      if (s.spikes.includes(Math.floor(hero.x)) && Math.abs(hero.y - s.top[Math.floor(hero.x)]!) < 0.05) hurtHero(s, rng, emit);
      if (Math.floor(hero.x) >= s.checkpoint + CHECK_EVERY && s.top[Math.floor(hero.x)]! >= 0) s.checkpoint = Math.floor(hero.x);
      if (cfg.energy) {
        hero.energy -= 2.6 * dt;
        if (hero.energy <= 0) {
          hero.energy = 0;
          killHeroOutright(s, rng, emit);
        }
      }

      // Attack.
      const wp = cfg.weapon;
      if (input.pressed.a && hero.cd <= 0 && (!cfg.ammo || hero.ammo > 0 || wp.kind === 'melee')) {
        const near = s.foes.some((f) => !f.dead && f.awake && (f.x - hero.x) * hero.face > 0 && Math.abs(f.x - hero.x) < wp.reach && Math.abs(f.y - hero.y) < 1.4);
        const melee = wp.kind === 'melee' || (wp.kind === 'hybrid' && near);
        hero.cd = wp.cd;
        if (melee) {
          hero.swing = 0.18;
          emit('fire');
          const hits = (x: number, y: number) => (x - hero.x) * hero.face > -0.3 && Math.abs(x - hero.x) < wp.reach + 0.5 && Math.abs(y - hero.y) < 1.5;
          for (const f of s.foes) {
            if (f.dead || !f.awake || !hits(f.x, f.y)) continue;
            f.hp -= wp.kind === 'hybrid' ? 2 : wp.dmg;
            if (f.hp <= 0) killFoe(s, f, rng, emit);
          }
          if (!s.boss.dead && s.boss.awake && hits(s.boss.x, s.boss.y)) damageBoss(s, wp.kind === 'hybrid' ? 2 : wp.dmg, rng, emit);
        } else if (s.shots.filter((sh) => sh.mine).length < wp.max) {
          if (cfg.ammo) hero.ammo -= 1;
          s.shots.push({ x: hero.x + hero.face * 0.6, y: hero.y - 0.9, vx: hero.face * wp.speed, vy: wp.kind === 'arc' ? -8 : 0, life: wp.life, mine: true, dmg: wp.dmg });
          emit('fire');
        }
      }
      // Doors: stepping into one restocks the pistol.
      if (cfg.doors && input.pressed.up) {
        const d = s.doors.find((dd) => !dd.used && Math.abs(dd.x - hero.x) < 0.9);
        if (d) {
          d.used = true;
          hero.ammo = cfg.ammo ?? 0;
          s.score += 200;
          emit('wave');
          // A guard steps out as you leave.
          s.foes.push({ kind: 'walker', x: d.x + 1.2, y: Math.max(0, s.top[Math.floor(d.x + 1.2)] ?? BASE), vx: 0, vy: 0, hp: 1, cd: 1, t: 0, dir: -1, awake: true, dead: false, onGround: true });
        }
      }
    }

    // Wake foes as the hero approaches.
    for (const f of s.foes) if (!f.dead && !f.awake && Math.abs(f.x - hero.x) < 17) f.awake = true;

    // Rising zombies.
    if (cfg.rising && hero.alive) {
      s.riseTimer -= dt;
      if (s.riseTimer <= 0) {
        s.riseTimer = Math.max(1.1, 2.6 - s.level * 0.15);
        const c = Math.floor(hero.x + hero.face * rng.range(5, 10));
        if (c > 2 && c < s.len - 30 && s.top[c]! >= 0 && s.foes.filter((f) => f.kind === 'zombie' && !f.dead).length < 6) {
          s.foes.push({ kind: 'zombie', x: c + 0.5, y: s.top[c]!, vx: 0, vy: 0, hp: 1, cd: 99, t: 0, dir: -1, awake: true, dead: false, onGround: true });
        }
      }
    }

    // Foe behaviour.
    for (const f of s.foes) {
      if (f.dead || !f.awake) continue;
      f.t += dt;
      f.cd -= dt;
      const dx = hero.x - f.x;
      const body: Body = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, face: f.dir, onGround: f.onGround, climbing: false, drop: 0 };
      if (f.kind === 'flyer') {
        f.x += Math.sign(dx) * 2.4 * dt;
        f.y += Math.sin(f.t * 3) * 1.6 * dt;
      } else {
        let dir = f.kind === 'shooter' ? 0 : f.kind === 'walker' ? f.dir : Math.sign(dx) || 1;
        let jump = false;
        if (f.kind === 'walker') {
          const ahead = Math.floor(f.x + f.dir * 0.8);
          if (ahead < 0 || ahead >= s.len || s.top[ahead]! < 0 || s.top[ahead]! < Math.round(f.y) - 0 || (s.top[ahead] ?? 99) > Math.round(f.y) + 0.5) f.dir = 0 - f.dir;
          dir = f.dir;
        } else if (f.kind === 'hopper') jump = f.onGround && f.cd <= 0;
        if (jump) f.cd = 1.4;
        stepBody(body, w, { dir: dir * (f.kind === 'zombie' ? 0.8 : 1), up: false, down: false, jump }, dt, foeCfg);
        f.x = body.x;
        f.y = body.y;
        f.vx = body.vx;
        f.vy = body.vy;
        f.onGround = body.onGround;
        if (f.y > ROWS + 2) f.dead = true;
        if (f.kind === 'shooter' && f.cd <= 0 && Math.abs(dx) < 13 && hero.alive) {
          s.shots.push({ x: f.x, y: f.y - 0.9, vx: Math.sign(dx) * 6, vy: 0, life: 3, mine: false, dmg: 1 });
          f.cd = 2.2;
        }
      }
      if (hero.alive && Math.abs(f.x - hero.x) < 0.7 && Math.abs(f.y - hero.y + (f.kind === 'flyer' ? 0.3 : 0)) < 0.9) hurtHero(s, rng, emit);
    }
    s.foes = s.foes.filter((f) => !f.dead);

    // Boss.
    const boss = s.boss;
    if (!boss.dead) {
      if (!boss.awake && hero.x > s.len - 24) boss.awake = true;
      if (boss.awake) {
        boss.cd -= dt;
        const bb = boss.body;
        let dir = boss.dir;
        if (bb.x < s.len - 16) dir = 1;
        if (bb.x > s.len - 3) dir = -1;
        boss.dir = dir;
        const jump = bb.onGround && boss.cd < 0.2 && boss.cd > 0.1;
        stepBody(bb, w, { dir: dir * 0.9, up: false, down: false, jump }, dt, { ...foeCfg, jump: 13, walk: 2.4 });
        boss.x = bb.x;
        boss.y = bb.y;
        if (boss.cd <= 0) {
          boss.cd = Math.max(0.9, 2.2 - s.level * 0.15);
          const d = Math.sign(hero.x - boss.x) || -1;
          s.shots.push({ x: boss.x, y: boss.y - 1.6, vx: d * 6.5, vy: 0, life: 3, mine: false, dmg: 1 }, { x: boss.x, y: boss.y - 0.6, vx: d * 6.5, vy: 0, life: 3, mine: false, dmg: 1 });
        }
        if (hero.alive && Math.abs(boss.x - hero.x) < 1.2 && Math.abs(boss.y - hero.y) < 2) hurtHero(s, rng, emit);
      }
    }

    // Items, hostages.
    for (let i = s.items.length - 1; i >= 0; i--) {
      const it = s.items[i]!;
      if (hero.alive && Math.abs(it.x - hero.x) < 0.8 && Math.abs(it.y - (hero.y - 0.6)) < 1) {
        s.items.splice(i, 1);
        if (it.kind === 'fruit') hero.energy = Math.min(100, hero.energy + 22);
        else if (it.kind === 'ammo') hero.ammo = Math.min((cfg.ammo ?? 0), hero.ammo + 6);
        s.score += it.kind === 'coin' ? 100 : 200;
        emit('pickup');
      }
    }
    for (const h of s.hostages) {
      if (!h.saved && hero.alive && Math.abs(h.x - hero.x) < 0.9 && Math.abs(h.y - hero.y) < 1) {
        h.saved = true;
        s.score += 1000;
        emit('wave');
      }
    }

    // Shots.
    for (let i = s.shots.length - 1; i >= 0; i--) {
      const sh = s.shots[i]!;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      if (cfg.weapon.kind === 'arc' && sh.mine) sh.vy += 22 * dt;
      sh.life -= dt;
      const c = Math.floor(sh.x);
      const groundTop = c >= 0 && c < s.len ? s.top[c]! : -1;
      if (sh.life <= 0 || sh.x < 0 || sh.x > s.len || (groundTop >= 0 && sh.y > groundTop + 0.2)) {
        s.shots.splice(i, 1);
        continue;
      }
      if (sh.mine) {
        const f = s.foes.find((o) => !o.dead && o.awake && Math.abs(o.x - sh.x) < 0.75 && Math.abs(o.y - 0.7 - sh.y) < 0.9);
        if (f) {
          f.hp -= sh.dmg;
          s.shots.splice(i, 1);
          if (f.hp <= 0) killFoe(s, f, rng, emit);
          continue;
        }
        if (!boss.dead && boss.awake && Math.abs(boss.x - sh.x) < 1.1 && Math.abs(boss.y - 1.2 - sh.y) < 1.6) {
          s.shots.splice(i, 1);
          damageBoss(s, sh.dmg, rng, emit);
        }
      } else if (hero.alive && Math.abs(sh.x - hero.x) < 0.5 && Math.abs(sh.y - (hero.y - 0.9)) < 0.9) {
        s.shots.splice(i, 1);
        hurtHero(s, rng, emit);
        if (s.over) return;
      }
    }
    s.foes = s.foes.filter((f) => !f.dead);
    // Enemy fire stops when the boss falls (cleared after the loop so its indices stay valid).
    if (s.flag) s.shots = s.shots.filter((sh) => sh.mine);

    // The way out opens once the boss falls; reach the flag.
    if (s.flag && hero.alive && hero.x > s.len - 2.5) {
      const rescued = s.hostages.filter((h) => h.saved).length;
      s.score += 2000 + s.level * 500 + (s.hostages.length > 0 && rescued === s.hostages.length ? 3000 : 0) + Math.floor(s.clock) * 5;
      s.levelDelay = 1.8;
      emit('wave');
    }
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function killFoe(s: ScrollerState, f: Foe, rng: Rng, emit: UpdateContext['emit']): void {
    f.dead = true;
    s.score += POINTS[f.kind];
    burst(s.sparks, rng, px(s, f.x), py(f.y - 0.7), COLORS.gold, 8);
    if (rng.next() < 0.18 && !cfg.energy) s.items.push({ x: f.x, y: f.y - 1, kind: 'coin' });
    emit('explode');
  }

  function damageBoss(s: ScrollerState, dmg: number, rng: Rng, emit: UpdateContext['emit']): void {
    const b = s.boss;
    b.hp -= dmg;
    emit('pickup');
    if (b.hp <= 0) {
      b.dead = true;
      s.flag = true;
      s.score += 3000;
      burst(s.sparks, rng, px(s, b.x), py(b.y - 1.2), COLORS.gold, 30);
      emit('explode');
    }
  }

  function render(s: ScrollerState, g: CanvasRenderingContext2D, time: number): void {
    const cam = Math.max(0, Math.min(s.len - VIEW, s.hero.x - 9));
    const sxx = (x: number) => (x - cam) * CELL;
    clear(g);
    g.fillStyle = cfg.colors.sky;
    g.fillRect(0, 0, W, H);
    // Distant hills drift slower than the ground.
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let k = 0; k < 8; k++) {
      const x = ((k * 190 - cam * CELL * 0.35) % (W + 200) + W + 200) % (W + 200) - 100;
      g.beginPath();
      g.moveTo(x - 90, py(BASE));
      g.lineTo(x, py(BASE) - 90 - (k % 3) * 30);
      g.lineTo(x + 90, py(BASE));
      g.fill();
    }
    const c0 = Math.floor(cam);
    for (let c = c0; c < Math.min(s.len, c0 + VIEW + 2); c++) {
      const t = s.top[c]!;
      if (t < 0) continue;
      g.fillStyle = cfg.colors.ground;
      g.fillRect(sxx(c), py(t), CELL + 1, H - py(t));
      g.fillStyle = cfg.colors.top;
      g.fillRect(sxx(c), py(t), CELL + 1, 7);
      if (s.spikes.includes(c)) {
        g.fillStyle = COLORS.paper;
        g.beginPath();
        g.moveTo(sxx(c), py(t));
        g.lineTo(sxx(c) + CELL / 2, py(t) - 16);
        g.lineTo(sxx(c) + CELL, py(t));
        g.fill();
      }
    }
    for (const [row, a, b] of s.ledges) {
      g.fillStyle = cfg.colors.top;
      g.fillRect(sxx(a), py(row), (b - a + 1) * CELL, 8);
    }
    for (const d of s.doors) {
      g.fillStyle = d.used ? COLORS.muted : COLORS.gold;
      g.fillRect(sxx(d.x) - 10, py(s.top[Math.floor(d.x)] ?? BASE) - 36, 20, 36);
    }
    for (const h of s.hostages) {
      if (h.saved) continue;
      g.fillStyle = COLORS.paper;
      g.fillRect(sxx(h.x) - 6, py(h.y) - 24, 12, 24);
      g.fillStyle = COLORS.coral;
      g.fillRect(sxx(h.x) - 6, py(h.y) - 28, 12, 5);
    }
    for (const it of s.items) {
      g.fillStyle = it.kind === 'fruit' ? COLORS.coral : it.kind === 'ammo' ? COLORS.cyan : COLORS.gold;
      g.beginPath();
      g.arc(sxx(it.x), py(it.y), 7, 0, 6.3);
      g.fill();
    }
    for (const f of s.foes) {
      if (!f.awake && Math.abs(f.x - s.hero.x) > 18) continue;
      g.fillStyle = f.kind === 'walker' ? '#7BE495' : f.kind === 'hopper' ? COLORS.gold : f.kind === 'flyer' ? COLORS.purple : f.kind === 'zombie' ? '#6b8f71' : COLORS.coral;
      if (f.kind === 'flyer') {
        g.beginPath();
        g.ellipse(sxx(f.x), py(f.y), 13, 8, 0, 0, 6.3);
        g.fill();
      } else g.fillRect(sxx(f.x) - 10, py(f.y) - 24, 20, 24);
      g.fillStyle = COLORS.bg;
      g.fillRect(sxx(f.x) - 5, py(f.y) - 18, 4, 4);
      g.fillRect(sxx(f.x) + 2, py(f.y) - 18, 4, 4);
    }
    const b = s.boss;
    if (!b.dead && (b.awake || Math.abs(b.x - s.hero.x) < 22)) {
      g.fillStyle = cfg.colors.accent;
      g.fillRect(sxx(b.x) - 28, py(b.y) - 76, 56, 76);
      g.fillStyle = COLORS.bg;
      g.fillRect(sxx(b.x) - 14, py(b.y) - 58, 9, 9);
      g.fillRect(sxx(b.x) + 6, py(b.y) - 58, 9, 9);
      g.fillStyle = COLORS.gold;
      g.fillRect(sxx(b.x) - 28, py(b.y) - 84, (56 * b.hp) / b.maxHp, 5);
    }
    if (s.flag) {
      g.fillStyle = Math.floor(time * 5) % 2 ? COLORS.gold : COLORS.paper;
      g.fillRect(sxx(s.len - 2), py(s.top[s.len - 2]!) - 70, 8, 70);
    }
    for (const sh of s.shots) {
      g.fillStyle = sh.mine ? COLORS.gold : COLORS.coral;
      g.fillRect(sxx(sh.x) - 5, py(sh.y) - 3, 10, 6);
    }
    const h = s.hero;
    if (h.alive && (h.invuln <= 0 || Math.floor(time * 12) % 2 === 0)) {
      g.fillStyle = cfg.colors.accent;
      g.fillRect(sxx(h.x) - 9, py(h.y) - 28, 18, 28);
      g.fillStyle = COLORS.paper;
      g.fillRect(sxx(h.x) - 7, py(h.y) - 34, 14, 8);
      g.fillStyle = COLORS.bg;
      g.fillRect(sxx(h.x) - 2 + h.face * 4, py(h.y) - 31, 3, 3);
      if (h.swing > 0) {
        g.fillStyle = COLORS.gold;
        g.fillRect(sxx(h.x) + h.face * 14 - (h.face < 0 ? cfg.weapon.reach * CELL : 0), py(h.y) - 20, cfg.weapon.reach * CELL, 6);
      }
    }
    drawSparks(g, s.sparks);
    const extras = [cfg.health > 1 ? `HP ${'♥'.repeat(Math.max(0, h.hp))}` : '', cfg.ammo ? `AMMO ${h.ammo}` : '', cfg.energy ? `ENERGY ${Math.ceil(h.energy)}` : '', cfg.hostages ? `HOSTAGES ${s.hostages.filter((x) => x.saved).length}/${s.hostages.length}` : ''].filter(Boolean).join('  ');
    hud(g, s, `STAGE ${s.level}  TIME ${Math.ceil(s.clock)}  ${extras}`, s.lives);
    g.fillStyle = COLORS.muted;
    g.fillRect(W / 2 - 100, 36, 200, 5);
    g.fillStyle = COLORS.cyan;
    g.fillRect(W / 2 - 100, 36, (200 * Math.min(s.hero.x, s.len)) / s.len, 5);
    if (s.flag && s.levelDelay <= 0) banner(g, 'GO TO THE FLAG!', 100);
    if (s.levelDelay > 0) banner(g, 'STAGE CLEAR!', 270);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
