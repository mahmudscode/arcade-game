import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * Top-down run-and-gun archetype (RG). The screen scrolls up as you advance through a jungle or desert
 * field; move and shoot in eight directions, lob grenades over cover, free prisoners and storm a fortress.
 * Games pick the vehicle, the starting grenades and the enemy mix.
 */
export type GunnerKind = 'soldier' | 'runner' | 'grenadier' | 'bunker' | 'boss';

export interface GunnerConfig {
  id: string;
  /** Hit points on foot. */
  hp: number;
  grenades: number;
  /** Tanks to commandeer: one hit costs the tank, not you. */
  vehicle: boolean;
  mix: Partial<Record<Exclude<GunnerKind, 'boss'>, number>>;
  colors: { ground: string; cover: string; hero: string; accent: string };
}

export const STAGE_LEN = 4200;
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 30000;
const SPEED = 150;
const TANK_SPEED = 110;
const BULLET = 520;
const FOE_BULLET = 230;
const FLIGHT = 0.6;
const BLAST_R = 72;
const HERO_R = 10;

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  mine: boolean;
  dmg: number;
}
interface Grenade {
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  mine: boolean;
}
interface Blast {
  x: number;
  y: number;
  t: number;
  mine: boolean;
  hit: boolean;
}
export interface Gunman {
  kind: GunnerKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cd: number;
  wind: number;
  aim: number;
  speed: number;
  /** Strafe direction for soldiers. */
  side: number;
}
interface Item {
  x: number;
  y: number;
  kind: 'grenade' | 'power' | 'pow' | 'tank';
}

export interface GunnerState {
  hero: {
    x: number;
    y: number;
    fx: number;
    fy: number;
    hp: number;
    invuln: number;
    power: number;
    grenades: number;
    tank: number;
    cd: number;
    dead: boolean;
  };
  camY: number;
  obstacles: Obstacle[];
  foes: Gunman[];
  /** Foes still waiting beyond the top of the screen, sorted by y descending. */
  pending: Gunman[];
  bullets: Bullet[];
  grenades: Grenade[];
  blasts: Blast[];
  items: Item[];
  clock: number;
  respawn: number;
  levelDelay: number;
  sparks: Spark[];
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

const KIND: Record<GunnerKind, { hp: number; speed: number; points: number }> = {
  soldier: { hp: 2, speed: 62, points: 100 },
  runner: { hp: 1, speed: 135, points: 150 },
  grenadier: { hp: 3, speed: 50, points: 250 },
  bunker: { hp: 8, speed: 0, points: 400 },
  boss: { hp: 70, speed: 40, points: 6000 },
};

export function createGunner(cfg: GunnerConfig): GameDefinition<GunnerState> {
  const clockFor = (level: number) => 140 + Math.min(level, 6) * 12;

  function blocked(s: GunnerState, x: number, y: number, r: number): boolean {
    for (const o of s.obstacles) if (x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h) return true;
    return false;
  }

  function buildStage(s: GunnerState, rng: Rng): void {
    s.obstacles = [];
    s.foes = [];
    s.pending = [];
    s.bullets = [];
    s.grenades = [];
    s.blasts = [];
    s.items = [];
    s.camY = -(H - 120);
    s.clock = clockFor(s.level);
    Object.assign(s.hero, { x: W / 2, y: 0, fx: 0, fy: -1, invuln: 1.5, cd: 0, dead: false, hp: cfg.hp });
    const pool = Object.entries(cfg.mix).flatMap(([k, w]) => Array.from({ length: w ?? 0 }, () => k as Exclude<GunnerKind, 'boss'>));
    const kinds = pool.length > 0 ? pool : (['soldier'] as const);
    for (let y = -220; y > -STAGE_LEN + 300; y -= rng.range(46, 70)) {
      const w = rng.range(36, 90);
      const x = rng.range(20, W - 20 - w);
      s.obstacles.push({ x, y, w, h: rng.range(24, 40) });
    }
    const count = 22 + s.level * 5;
    for (let k = 0; k < count; k++) {
      const y = -300 - ((STAGE_LEN - 800) * (k + rng.next())) / count;
      const kind = rng.pick(kinds as readonly Exclude<GunnerKind, 'boss'>[]);
      s.pending.push(mkFoe(s, kind, rng.range(40, W - 40), y));
    }
    for (let k = 0; k < 4; k++) s.items.push({ x: rng.range(60, W - 60), y: -500 - k * 900 - rng.range(0, 300), kind: k % 2 === 0 ? 'grenade' : 'power' });
    for (let k = 0; k < 3; k++) s.items.push({ x: rng.range(80, W - 80), y: -700 - k * 1100 - rng.range(0, 300), kind: 'pow' });
    if (cfg.vehicle) for (let k = 0; k < 2; k++) s.items.push({ x: rng.range(120, W - 120), y: -900 - k * 1500, kind: 'tank' });
    // Clear the obstacles from where items and the start sit.
    s.obstacles = s.obstacles.filter((o) => !s.items.some((i) => i.x > o.x - 16 && i.x < o.x + o.w + 16 && i.y > o.y - 16 && i.y < o.y + o.h + 16) && !(o.y > -160));
    s.pending.push(mkFoe(s, 'boss', W / 2, -STAGE_LEN + 120));
    s.pending.sort((a, b) => b.y - a.y);
  }

  function mkFoe(s: GunnerState, kind: GunnerKind, x: number, y: number): Gunman {
    const k = KIND[kind];
    const hp = Math.round(k.hp * (1 + (s.level - 1) * (kind === 'boss' ? 0.3 : 0.15)));
    return { kind, x, y, hp, maxHp: hp, cd: 1 + ((x | 0) % 7) * 0.2, wind: 0, aim: 0, speed: k.speed + Math.min(s.level, 6) * 3, side: x > W / 2 ? -1 : 1 };
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): GunnerState {
    const s: GunnerState = {
      hero: { x: W / 2, y: 0, fx: 0, fy: -1, hp: cfg.hp, invuln: 1.5, power: 0, grenades: cfg.grenades, tank: 0, cd: 0, dead: false },
      camY: 0,
      obstacles: [],
      foes: [],
      pending: [],
      bullets: [],
      grenades: [],
      blasts: [],
      items: [],
      clock: 0,
      respawn: 0,
      levelDelay: 0,
      sparks: [],
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

  function killHero(s: GunnerState, rng: Rng, emit: UpdateContext['emit']): void {
    const h = s.hero;
    h.dead = true;
    h.tank = 0;
    s.lives -= 1;
    s.respawn = 1.5;
    burst(s.sparks, rng, h.x, h.y - s.camY, COLORS.coral, 14);
    emit('die');
    if (s.lives <= 0) s.over = true;
  }

  function hurtHero(s: GunnerState, rng: Rng, emit: UpdateContext['emit']): void {
    const h = s.hero;
    if (h.dead || h.invuln > 0) return;
    h.invuln = 1;
    if (h.tank > 0) {
      h.tank -= 1;
      burst(s.sparks, rng, h.x, h.y - s.camY, COLORS.gold, 8);
      emit('pickup');
      if (h.tank <= 0) {
        s.blasts.push({ x: h.x, y: h.y, t: 0, mine: true, hit: false });
        emit('explode');
      }
      return;
    }
    h.hp -= 1;
    if (h.hp <= 0) killHero(s, rng, emit);
    else {
      burst(s.sparks, rng, h.x, h.y - s.camY, COLORS.coral, 6);
      emit('pickup');
    }
  }

  function damage(s: GunnerState, f: Gunman, dmg: number, rng: Rng, emit: UpdateContext['emit']): void {
    f.hp -= dmg;
    burst(s.sparks, rng, f.x, f.y - s.camY, COLORS.gold, 3);
    if (f.hp <= 0) {
      s.score += KIND[f.kind].points;
      emit('explode');
      burst(s.sparks, rng, f.x, f.y - s.camY, COLORS.coral, f.kind === 'boss' ? 30 : 8);
      if (f.kind !== 'boss' && f.kind !== 'bunker' && f.maxHp >= 2 && (Math.floor(f.x) + Math.floor(f.y)) % 9 === 0) s.items.push({ x: f.x, y: f.y, kind: 'grenade' });
    }
  }

  function update(s: GunnerState, input: Input, dt: number, ctx: UpdateContext): void {
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
    h.invuln = Math.max(0, h.invuln - dt);
    h.cd = Math.max(0, h.cd - dt);

    // ---- stage clock: stalling is punished
    s.clock -= dt;
    if (s.clock <= 0 && !h.dead) {
      s.clock = 60;
      killHero(s, rng, emit);
    }

    // ---- hero
    if (h.dead) {
      s.respawn -= dt;
      if (s.respawn <= 0 && !s.over) {
        h.dead = false;
        h.hp = cfg.hp;
        h.invuln = 2.5;
        h.power = 0;
        h.x = W / 2;
        h.y = s.camY + H - 120;
        s.bullets = s.bullets.filter((b) => b.mine);
        s.grenades = s.grenades.filter((g) => g.mine);
        for (const f of s.foes) if (Math.hypot(f.x - h.x, f.y - h.y) < 120) f.y -= 140;
      }
    } else {
      const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const n = Math.hypot(dx, dy);
        h.fx = dx / n;
        h.fy = dy / n;
        const sp = (h.tank > 0 ? TANK_SPEED : SPEED) * dt;
        const nx = h.x + (dx / n) * sp;
        if (!blocked(s, nx, h.y, HERO_R)) h.x = Math.min(W - 14, Math.max(14, nx));
        const ny = h.y + (dy / n) * sp;
        if (!blocked(s, h.x, ny, HERO_R)) h.y = Math.min(s.camY + H - 14, ny);
      }
      if (input.held.a && h.cd <= 0) {
        h.cd = h.tank > 0 ? 0.16 : h.power > 0 ? 0.12 : 0.2;
        const spreads = h.power > 0 ? [-0.2, 0, 0.2] : [0];
        const base = Math.atan2(h.fy, h.fx);
        for (const sp of spreads) s.bullets.push({ x: h.x + h.fx * 14, y: h.y + h.fy * 14, vx: Math.cos(base + sp) * BULLET, vy: Math.sin(base + sp) * BULLET, life: 0.9, mine: true, dmg: h.tank > 0 ? 2 : 1 });
        emit('fire');
      }
      if (input.pressed.b && h.grenades > 0) {
        h.grenades -= 1;
        s.grenades.push({ x: h.x, y: h.y, sx: h.x, sy: h.y, tx: Math.min(W - 10, Math.max(10, h.x + h.fx * 200)), ty: h.y + h.fy * 200, t: 0, mine: true });
        emit('fire');
      }
      for (let i = s.items.length - 1; i >= 0; i--) {
        const it = s.items[i]!;
        if (Math.hypot(it.x - h.x, it.y - h.y) < 24) {
          if (it.kind === 'grenade') h.grenades = Math.min(9, h.grenades + 3);
          else if (it.kind === 'power') h.power = 1;
          else if (it.kind === 'tank') h.tank = 4;
          else s.score += 1000;
          s.items.splice(i, 1);
          s.score += 50;
          emit('pickup');
        }
      }
    }

    // ---- camera and spawning
    if (!h.dead) s.camY = Math.min(s.camY, h.y - (H - 190));
    while (s.pending.length > 0 && s.pending[0]!.y > s.camY - 80) {
      const f = s.pending.shift()!;
      s.foes.push(f);
    }

    // ---- foes
    let shooters = s.foes.filter((f) => f.wind > 0).length;
    for (const f of s.foes) {
      if (f.hp <= 0) continue;
      f.cd = Math.max(0, f.cd - dt);
      if (h.dead) continue;
      const dx = h.x - f.x;
      const dy = h.y - f.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (f.wind > 0) {
        f.wind -= dt;
        if (f.wind <= 0) {
          f.wind = 0;
          if (f.kind === 'grenadier') s.grenades.push({ x: f.x, y: f.y, sx: f.x, sy: f.y, tx: h.x, ty: h.y, t: 0, mine: false });
          else if (f.kind === 'boss') {
            for (let k = -2; k <= 2; k++) s.bullets.push({ x: f.x, y: f.y + 20, vx: Math.sin(k * 0.3) * FOE_BULLET, vy: Math.cos(k * 0.3) * FOE_BULLET, life: 3, mine: false, dmg: 1 });
          } else s.bullets.push({ x: f.x, y: f.y, vx: (Math.cos(f.aim) * FOE_BULLET), vy: Math.sin(f.aim) * FOE_BULLET, life: 3, mine: false, dmg: 1 });
          f.cd = f.kind === 'boss' ? 1.6 : f.kind === 'grenadier' ? 3 : 1.9;
        }
        continue;
      }
      if (f.kind === 'runner') {
        const nx = f.x + (dx / dist) * f.speed * dt;
        const ny = f.y + (dy / dist) * f.speed * dt;
        if (!blocked(s, nx, f.y, 8)) f.x = nx;
        if (!blocked(s, f.x, ny, 8)) f.y = ny;
        if (dist < 16) hurtHero(s, rng, emit);
        continue;
      }
      if (f.kind === 'soldier') {
        if (dist > 230) {
          const nx = f.x + (dx / dist) * f.speed * dt;
          const ny = f.y + (dy / dist) * f.speed * dt;
          if (!blocked(s, nx, f.y, 8)) f.x = nx;
          if (!blocked(s, f.x, ny, 8)) f.y = ny;
        } else {
          const nx = f.x + f.side * f.speed * 0.6 * dt;
          if (nx < 30 || nx > W - 30 || blocked(s, nx, f.y, 8)) f.side = -f.side;
          else f.x = nx;
        }
      } else if (f.kind === 'grenadier' && dist < 260) {
        const ny = f.y - (dy / dist) * f.speed * dt;
        if (!blocked(s, f.x, ny, 8)) f.y = ny;
      } else if (f.kind === 'grenadier') {
        f.y += (dy / dist) * f.speed * dt;
      } else if (f.kind === 'boss') {
        f.x += Math.sign(h.x - f.x) * Math.min(Math.abs(h.x - f.x), f.speed * dt);
      }
      if (f.cd <= 0 && dist < 420 && shooters < 3 && f.y > s.camY && f.y < s.camY + H) {
        f.aim = Math.atan2(dy, dx);
        f.wind = f.kind === 'boss' ? 0.6 : f.kind === 'grenadier' ? 0.7 : 0.4;
        shooters += 1;
      }
    }

    // ---- bullets
    for (const b of s.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life > 0 && blocked(s, b.x, b.y, 1)) b.life = 0;
      if (b.life <= 0) continue;
      if (b.mine) {
        for (const f of s.foes) {
          if (f.hp <= 0) continue;
          const r = f.kind === 'boss' ? 36 : f.kind === 'bunker' ? 20 : 12;
          if (Math.abs(b.x - f.x) < r && Math.abs(b.y - f.y) < r) {
            damage(s, f, b.dmg, rng, emit);
            b.life = 0;
            break;
          }
        }
      } else if (!h.dead && Math.hypot(b.x - h.x, b.y - h.y) < HERO_R + 3) {
        b.life = 0;
        hurtHero(s, rng, emit);
      }
    }
    s.bullets = s.bullets.filter((b) => b.life > 0 && b.y > s.camY - 40 && b.y < s.camY + H + 40 && b.x > -20 && b.x < W + 20);

    // ---- grenades and blasts
    for (const g of s.grenades) {
      g.t += dt;
      const k = Math.min(1, g.t / FLIGHT);
      g.x = g.sx + (g.tx - g.sx) * k;
      g.y = g.sy + (g.ty - g.sy) * k;
      if (g.t >= FLIGHT) {
        s.blasts.push({ x: g.tx, y: g.ty, t: 0, mine: g.mine, hit: false });
        emit('explode');
      }
    }
    s.grenades = s.grenades.filter((g) => g.t < FLIGHT);
    for (const b of s.blasts) {
      b.t += dt;
      if (!b.hit) {
        b.hit = true;
        if (b.mine) {
          for (const f of s.foes) if (f.hp > 0 && Math.hypot(f.x - b.x, f.y - b.y) < BLAST_R) damage(s, f, f.kind === 'boss' ? 4 : 8, rng, emit);
        } else if (!h.dead && Math.hypot(h.x - b.x, h.y - b.y) < 44) hurtHero(s, rng, emit);
      }
    }
    s.blasts = s.blasts.filter((b) => b.t < 0.35);
    s.foes = s.foes.filter((f) => f.hp > 0 && f.y < s.camY + H + 120);

    // ---- stage end: the boss is gone and nothing is pending
    const bossAlive = s.foes.some((f) => f.kind === 'boss') || s.pending.some((f) => f.kind === 'boss');
    if (!bossAlive && !h.dead) {
      s.score += 3000 + s.level * 500 + Math.floor(s.clock) * 10;
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

  function render(s: GunnerState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    const sy = (y: number) => y - s.camY;
    g.fillStyle = cfg.colors.ground;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let k = 0; k < 14; k++) {
      const y = (((k * 97 - s.camY * 0.6) % (H + 100)) + H + 100) % (H + 100) - 50;
      g.fillRect((k * 173) % W, y, 4, 22);
    }
    g.fillStyle = cfg.colors.cover;
    for (const o of s.obstacles) if (sy(o.y) > -50 && sy(o.y) < H + 50) g.fillRect(o.x, sy(o.y), o.w, o.h);
    for (const it of s.items) {
      g.fillStyle = it.kind === 'grenade' ? COLORS.gold : it.kind === 'power' ? COLORS.purple : it.kind === 'tank' ? COLORS.cyan : COLORS.paper;
      g.fillRect(it.x - 9, sy(it.y) - 9, 18, 18);
    }
    for (const f of s.foes) {
      const x = f.x;
      const y = sy(f.y);
      const flash = f.wind > 0 && Math.floor(time * 20) % 2 === 0;
      g.fillStyle = flash ? COLORS.paper : f.kind === 'boss' ? COLORS.coral : f.kind === 'bunker' ? '#6b6b6b' : f.kind === 'runner' ? COLORS.gold : f.kind === 'grenadier' ? COLORS.purple : '#c06a4a';
      if (f.kind === 'boss') g.fillRect(x - 40, y - 28, 80, 56);
      else if (f.kind === 'bunker') g.fillRect(x - 20, y - 16, 40, 32);
      else g.fillRect(x - 8, y - 10, 16, 20);
    }
    const h = s.hero;
    if (!h.dead && (h.invuln <= 0 || Math.floor(time * 12) % 2 === 0)) {
      const y = sy(h.y);
      g.fillStyle = h.tank > 0 ? COLORS.cyan : cfg.colors.hero;
      if (h.tank > 0) g.fillRect(h.x - 16, y - 14, 32, 28);
      else g.fillRect(h.x - 8, y - 10, 16, 20);
      g.fillStyle = COLORS.paper;
      g.fillRect(h.x + h.fx * 12 - 3, y + h.fy * 12 - 3, 6, 6);
    }
    for (const b of s.bullets) {
      g.fillStyle = b.mine ? COLORS.gold : COLORS.coral;
      g.fillRect(b.x - 2, sy(b.y) - 2, 4, 4);
    }
    for (const gr of s.grenades) {
      g.fillStyle = COLORS.paper;
      g.fillRect(gr.x - 4, sy(gr.y) - 4, 8, 8);
    }
    for (const b of s.blasts) {
      g.fillStyle = 'rgba(255,200,60,0.5)';
      g.beginPath();
      g.arc(b.x, sy(b.y), BLAST_R * Math.min(1, b.t * 5), 0, 6.3);
      g.fill();
    }
    drawSparks(g, s.sparks);
    hud(g, s, `STAGE ${s.level}  GRENADES ${h.grenades}${h.tank > 0 ? `  TANK ${h.tank}` : ''}  TIME ${Math.max(0, Math.ceil(s.clock))}`, s.lives);
    if (s.levelDelay > 0) banner(g, 'STAGE CLEAR!', 270);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
