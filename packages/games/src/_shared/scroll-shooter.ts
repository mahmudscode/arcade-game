import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * Scrolling-shooter archetype (SS). The simulation runs in canonical coordinates:
 * `f` is distance along the scroll axis (0 = player's back edge, F = far edge), `a` is across it.
 * Vertical games map f to the screen's y (inverted), horizontal games map f to x.
 */
export type EnemyKind = 'wave' | 'chaser' | 'heavy' | 'turret' | 'fuel';

export interface ShooterConfig {
  id: string;
  vertical: boolean;
  speed: number;
  fireInterval: number;
  /** Spawn weights per enemy kind. */
  mix: Partial<Record<EnemyKind, number>>;
  /** Scrolling ground you can crash into (horizontal only); turrets and fuel tanks sit on it. */
  terrain?: boolean;
  /** Fuel drains; shoot fuel tanks to refill. */
  fuel?: boolean;
  /** Hold fire to charge a piercing beam. */
  charge?: boolean;
  /** Pickups add trailing options that also fire. */
  options?: boolean;
  accent: string;
}

const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 20000;
const COL = 20;
const RADIUS: Record<EnemyKind, number> = { wave: 16, chaser: 16, heavy: 28, turret: 16, fuel: 18 };
const HP: Record<EnemyKind, number> = { wave: 1, chaser: 1, heavy: 5, turret: 2, fuel: 1 };
const POINTS: Record<EnemyKind, number> = { wave: 100, chaser: 150, heavy: 500, turret: 200, fuel: 150 };

interface Bullet { f: number; a: number; vf: number; va: number; dmg: number; pierce: boolean; r: number }
interface Enemy { f: number; a: number; a0: number; kind: EnemyKind; hp: number; t: number; shoot: number }
interface Pickup { f: number; a: number }
interface Pos { f: number; a: number }

export interface ShooterState {
  player: { f: number; a: number; alive: boolean; invuln: number; cool: number; power: number; options: number; charge: number };
  trail: Pos[];
  bullets: Bullet[];
  enemyBullets: { f: number; a: number; vf: number; va: number }[];
  enemies: Enemy[];
  pickups: Pickup[];
  /** Ground height (px) per COL-wide column; only used with terrain. */
  ground: number[];
  groundShift: number;
  stars: { f: number; a: number; s: number }[];
  sparks: Spark[];
  spawnTimer: number;
  dist: number;
  fuel: number;
  respawn: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
  nextLife: number;
}

export function createScrollShooter(cfg: ShooterConfig): GameDefinition<ShooterState> {
  const F = cfg.vertical ? H : W;
  const A = cfg.vertical ? W : H;
  const MAXF = F * 0.55;
  const cols = Math.ceil(F / COL) + 2;
  const toX = (f: number, a: number) => (cfg.vertical ? a : f);
  const toY = (f: number, a: number) => (cfg.vertical ? H - f : a);
  const level = (dist: number) => 1 + Math.floor(dist / 3500);
  const scrollSpeed = (lv: number) => 80 + lv * 8;

  function nextGround(rng: Rng, prev: number): number {
    return Math.min(190, Math.max(30, prev + rng.range(-16, 16)));
  }

  function resetPlayer(s: ShooterState): void {
    s.player = { f: 90, a: A / 2, alive: true, invuln: 2.2, cool: 0, power: 0, options: 0, charge: 0 };
    s.trail = [];
    s.fuel = 1000;
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): ShooterState {
    const ground: number[] = [];
    let h = 70;
    for (let i = 0; i < cols; i++) ground.push(cfg.terrain ? (h = nextGround(rng, h)) : 0);
    const s: ShooterState = {
      player: { f: 0, a: 0, alive: true, invuln: 0, cool: 0, power: 0, options: 0, charge: 0 },
      trail: [],
      bullets: [],
      enemyBullets: [],
      enemies: [],
      pickups: [],
      ground,
      groundShift: 0,
      stars: Array.from({ length: 60 }, () => ({ f: rng.range(0, F), a: rng.range(0, A), s: rng.pick([1, 1, 2]) })),
      sparks: [],
      spawnTimer: 1,
      dist: 0,
      fuel: 1000,
      respawn: 0,
      score: 0,
      hi: hiScore,
      lives: START_LIVES,
      level: 1,
      over: false,
      nextLife: EXTRA_LIFE_EVERY,
    };
    resetPlayer(s);
    return s;
  }

  const groundAtF = (s: ShooterState, f: number) => s.ground[Math.min(s.ground.length - 1, Math.max(0, Math.floor((f + s.groundShift) / COL)))] ?? 0;

  function spawn(s: ShooterState, rng: Rng): void {
    const entries = Object.entries(cfg.mix) as [EnemyKind, number][];
    const total = entries.reduce((n, [, w]) => n + w, 0);
    let roll = rng.range(0, total);
    let kind: EnemyKind = entries[0]![0];
    for (const [k, w] of entries) {
      if (roll < w) {
        kind = k;
        break;
      }
      roll -= w;
    }
    const ground = kind === 'turret' || kind === 'fuel';
    const a0 = ground ? 0 : rng.range(60, A - 60);
    const count = kind === 'wave' ? rng.int(2, 4) : 1;
    for (let i = 0; i < count; i++) {
      const f = F + 30 + i * 52;
      const a = ground ? A - groundAtF(s, f) - 12 : a0;
      s.enemies.push({ f, a, a0: a, kind, hp: HP[kind], t: 0, shoot: rng.range(0.8, 2) });
    }
  }

  function fire(s: ShooterState, f: number, a: number, power: number, dmg = 1): void {
    const v = 640;
    const add = (da: number, va: number) => s.bullets.push({ f, a: a + da, vf: v, va, dmg, pierce: false, r: 5 });
    if (power === 1) {
      add(-9, 0);
      add(9, 0);
    } else {
      add(0, 0);
      if (power >= 2) {
        add(0, -130);
        add(0, 130);
      }
    }
  }

  function killPlayer(s: ShooterState, rng: Rng, emit: UpdateContext['emit']): void {
    const p = s.player;
    p.alive = false;
    s.lives -= 1;
    s.respawn = 1.3;
    burst(s.sparks, rng, toX(p.f, p.a), toY(p.f, p.a), COLORS.cyan, 26);
    emit('die');
    if (s.lives <= 0) s.over = true;
  }

  function update(s: ShooterState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    if (s.over) {
      if (input.pressed.a || input.pressed.start) {
        Object.assign(s, init({ rng, hiScore: Math.max(s.hi, s.score) }));
        emit('start');
      }
      stepSparks(s.sparks, dt);
      return;
    }

    s.level = level(s.dist);
    const scroll = scrollSpeed(s.level);
    s.dist += scroll * dt;

    for (const st of s.stars) {
      st.f -= scroll * 0.4 * st.s * dt;
      if (st.f < 0) {
        st.f += F;
        st.a = rng.range(0, A);
      }
    }
    if (cfg.terrain) {
      s.groundShift += scroll * dt;
      while (s.groundShift >= COL) {
        s.groundShift -= COL;
        s.ground.shift();
        s.ground.push(nextGround(rng, s.ground[s.ground.length - 1]!));
      }
    }

    const p = s.player;
    // On screen, "up/down/left/right" map to (f, a) differently per orientation.
    const dF = (cfg.vertical ? (input.held.up ? 1 : 0) - (input.held.down ? 1 : 0) : (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0)) * cfg.speed * dt;
    const dA = (cfg.vertical ? (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0) : (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0)) * cfg.speed * dt;
    if (p.alive) {
      p.f = Math.min(MAXF, Math.max(30, p.f + dF));
      p.a = Math.min(A - 20, Math.max(20, p.a + dA));
      p.invuln = Math.max(0, p.invuln - dt);
      p.cool -= dt;
      s.trail.unshift({ f: p.f, a: p.a });
      if (s.trail.length > 40) s.trail.pop();

      const shoot = () => {
        fire(s, p.f + 18, p.a, p.power);
        if (cfg.options) {
          for (let i = 0; i < p.options; i++) {
            const o = s.trail[(i + 1) * 12];
            if (o) fire(s, o.f + 12, o.a, 0);
          }
        }
        emit('fire');
      };
      if (cfg.charge) {
        if (input.pressed.a && p.cool <= 0) {
          p.cool = cfg.fireInterval;
          shoot();
        }
        if (input.held.a) p.charge = Math.min(1.4, p.charge + dt);
        else {
          if (p.charge >= 0.9) {
            s.bullets.push({ f: p.f + 20, a: p.a, vf: 820, va: 0, dmg: 6, pierce: true, r: 14 });
            emit('wave');
          }
          p.charge = 0;
        }
      } else if (input.held.a && p.cool <= 0) {
        p.cool = cfg.fireInterval;
        shoot();
      }
      if (cfg.fuel) {
        s.fuel -= 38 * dt;
        if (s.fuel <= 0) killPlayer(s, rng, emit);
      }
      if (cfg.terrain && p.alive && p.a + 10 > A - groundAtF(s, p.f)) killPlayer(s, rng, emit);
    } else if (s.lives > 0) {
      s.respawn -= dt;
      if (s.respawn <= 0) resetPlayer(s);
    }

    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = Math.max(0.4, 1.5 - s.level * 0.1) * rng.range(0.7, 1.3);
      spawn(s, rng);
    }

    for (const b of s.bullets) {
      b.f += b.vf * dt;
      b.a += b.va * dt;
    }
    s.bullets = s.bullets.filter((b) => b.f < F + 20 && b.a > -20 && b.a < A + 20);
    for (const b of s.enemyBullets) {
      b.f += b.vf * dt;
      b.a += b.va * dt;
    }
    s.enemyBullets = s.enemyBullets.filter((b) => b.f > -20 && b.f < F + 40 && b.a > -20 && b.a < A + 20);

    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i]!;
      e.t += dt;
      if (e.kind === 'wave') {
        e.f -= 130 * dt;
        e.a = e.a0 + Math.sin(e.t * 2.4 + e.f * 0.01) * 80;
      } else if (e.kind === 'chaser') {
        e.f -= 150 * dt;
        e.a += Math.sign(p.a - e.a) * Math.min(80 * dt, Math.abs(p.a - e.a));
      } else if (e.kind === 'heavy') {
        e.f -= 55 * dt;
      } else e.f -= scroll * dt;
      if (e.kind === 'turret' || e.kind === 'fuel') e.a = A - groundAtF(s, e.f) - 12;

      if ((e.kind === 'heavy' || e.kind === 'turret') && p.alive) {
        e.shoot -= dt;
        if (e.shoot <= 0 && e.f < F - 40 && e.f > p.f + 40) {
          e.shoot = rng.range(1.4, 2.4);
          const d = Math.hypot(p.f - e.f, p.a - e.a) || 1;
          s.enemyBullets.push({ f: e.f, a: e.a, vf: ((p.f - e.f) / d) * 210, va: ((p.a - e.a) / d) * 210 });
        }
      }
      if (e.f < -40) {
        s.enemies.splice(i, 1);
        continue;
      }

      // Player bullets.
      for (let k = s.bullets.length - 1; k >= 0 && e.hp > 0; k--) {
        const b = s.bullets[k]!;
        if (Math.hypot(b.f - e.f, b.a - e.a) < RADIUS[e.kind] + b.r) {
          e.hp -= b.dmg;
          if (!b.pierce) s.bullets.splice(k, 1);
          if (e.hp > 0) emit('fire');
        }
      }
      if (e.hp <= 0) {
        s.score += POINTS[e.kind];
        burst(s.sparks, rng, toX(e.f, e.a), toY(e.f, e.a), cfg.accent, 12);
        emit('explode');
        if (e.kind === 'fuel') s.fuel = Math.min(1000, s.fuel + 400);
        if (e.kind === 'heavy' || (e.kind === 'wave' && rng.next() < 0.05)) s.pickups.push({ f: e.f, a: e.a });
        s.enemies.splice(i, 1);
        continue;
      }
      if (p.alive && p.invuln <= 0 && e.kind !== 'fuel' && Math.hypot(p.f - e.f, p.a - e.a) < RADIUS[e.kind] + 10) killPlayer(s, rng, emit);
    }

    if (p.alive && p.invuln <= 0) {
      for (let i = s.enemyBullets.length - 1; i >= 0; i--) {
        const b = s.enemyBullets[i]!;
        if (Math.hypot(b.f - p.f, b.a - p.a) < 14) {
          s.enemyBullets.splice(i, 1);
          killPlayer(s, rng, emit);
          break;
        }
      }
    }
    for (let i = s.pickups.length - 1; i >= 0; i--) {
      const pk = s.pickups[i]!;
      pk.f -= 70 * dt;
      if (p.alive && Math.hypot(p.f - pk.f, p.a - pk.a) < 26) {
        s.score += 250;
        if (cfg.options && p.power >= 2 && p.options < 2) p.options += 1;
        else p.power = Math.min(2, p.power + 1);
        emit('pickup');
        s.pickups.splice(i, 1);
      } else if (pk.f < -20) s.pickups.splice(i, 1);
    }

    stepSparks(s.sparks, dt);
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function ship(g: CanvasRenderingContext2D, f: number, a: number, size: number, color: string, facing: 'fwd' | 'back'): void {
    g.save();
    g.translate(toX(f, a), toY(f, a));
    // Rotate so that +f (forward) points along the screen's forward direction.
    const fwd = cfg.vertical ? -Math.PI / 2 : 0;
    g.rotate(fwd + (facing === 'back' ? Math.PI : 0));
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(size, 0);
    g.lineTo(-size * 0.8, size * 0.7);
    g.lineTo(-size * 0.4, 0);
    g.lineTo(-size * 0.8, -size * 0.7);
    g.closePath();
    g.fill();
    g.restore();
  }

  function render(s: ShooterState, g: CanvasRenderingContext2D): void {
    clear(g);
    g.fillStyle = COLORS.paper;
    g.globalAlpha = 0.5;
    for (const st of s.stars) g.fillRect(toX(st.f, st.a), toY(st.f, st.a), st.s, st.s);
    g.globalAlpha = 1;

    if (cfg.terrain) {
      g.fillStyle = COLORS.purple;
      g.beginPath();
      g.moveTo(0, H);
      s.ground.forEach((h, i) => g.lineTo(i * COL - s.groundShift, A - h));
      g.lineTo(W + COL, H);
      g.closePath();
      g.fill();
    }

    for (const e of s.enemies) {
      if (e.kind === 'fuel') {
        g.fillStyle = COLORS.gold;
        g.fillRect(toX(e.f, e.a) - 12, toY(e.f, e.a) - 14, 24, 24);
        g.fillStyle = COLORS.bg;
        g.font = '10px "Press Start 2P", monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('F', toX(e.f, e.a), toY(e.f, e.a) - 2);
      } else if (e.kind === 'turret') {
        g.fillStyle = COLORS.coral;
        g.fillRect(toX(e.f, e.a) - 12, toY(e.f, e.a) - 8, 24, 16);
      } else {
        ship(g, e.f, e.a, RADIUS[e.kind], e.kind === 'heavy' ? COLORS.purple : e.kind === 'chaser' ? COLORS.gold : COLORS.coral, 'back');
      }
    }
    g.fillStyle = COLORS.gold;
    for (const pk of s.pickups) g.fillRect(toX(pk.f, pk.a) - 9, toY(pk.f, pk.a) - 9, 18, 18);
    g.fillStyle = COLORS.coral;
    for (const b of s.enemyBullets) g.fillRect(toX(b.f, b.a) - 3, toY(b.f, b.a) - 3, 7, 7);
    g.fillStyle = COLORS.paper;
    for (const b of s.bullets) {
      const r = b.r;
      g.fillRect(toX(b.f, b.a) - r, toY(b.f, b.a) - r / 2, r * 2, r);
    }

    const p = s.player;
    if (p.alive && (p.invuln <= 0 || Math.floor(p.invuln * 10) % 2 === 0)) {
      ship(g, p.f, p.a, 15, COLORS.cyan, 'fwd');
      for (let i = 0; i < p.options; i++) {
        const o = s.trail[(i + 1) * 12];
        if (o) {
          g.fillStyle = COLORS.gold;
          g.beginPath();
          g.arc(toX(o.f, o.a), toY(o.f, o.a), 6, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (p.charge > 0.2) {
        g.strokeStyle = COLORS.gold;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(toX(p.f, p.a), toY(p.f, p.a), 10 + p.charge * 14, 0, Math.PI * 2);
        g.stroke();
      }
    }
    drawSparks(g, s.sparks);

    hud(g, s, `LEVEL ${s.level}`, s.lives);
    if (cfg.fuel) {
      g.fillStyle = COLORS.muted;
      g.fillRect(W / 2 - 100, H - 26, 200, 10);
      g.fillStyle = s.fuel < 250 ? COLORS.coral : COLORS.gold;
      g.fillRect(W / 2 - 100, H - 26, Math.max(0, s.fuel / 5), 10);
    }
    if (!s.player.alive && !s.over) banner(g, 'READY?', 260);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
