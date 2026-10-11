import type { GameDefinition, Input, Rng, UpdateContext } from '@arcade/engine';
import { COLORS, H, TAU, W, banner, burst, clear, drawSparks, gameOver, hud, makeStatus, stepSparks, type Spark } from './ui';

/**
 * Defender archetype (DF): a long wrapping planet, a radar strip, humanoids on the ground that
 * landers abduct, and a ship that can catch a falling humanoid and set it down.
 */
export interface DefenderConfig {
  id: string;
  /** Bombers lay mines as they drift (Stargate). */
  bombers: boolean;
  /** Pods burst into swarmers when shot (Stargate). */
  pods: boolean;
  accent: string;
}

export const WORLD = 3200;
const TOP = 78;
const SEA = 500;
const START_LIVES = 3;
const START_BOMBS = 3;
const HUMANS = 10;
const EXTRA_LIFE_EVERY = 10000;
const COLS = WORLD / 20;

export type FoeKind = 'lander' | 'mutant' | 'bomber' | 'pod' | 'swarmer' | 'baiter';
const POINTS: Record<FoeKind, number> = { lander: 150, mutant: 150, bomber: 250, pod: 1000, swarmer: 150, baiter: 200 };
const RADIUS: Record<FoeKind, number> = { lander: 16, mutant: 15, bomber: 16, pod: 18, swarmer: 10, baiter: 14 };

interface Foe {
  kind: FoeKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Index of the humanoid being hunted or carried, or -1. */
  human: number;
  carrying: boolean;
  cd: number;
  t: number;
}
interface Human {
  x: number;
  y: number;
  vy: number;
  /** walk on the ground, carried by a lander, falling, held by the ship, or dead. */
  state: 'walk' | 'carried' | 'fall' | 'held' | 'dead';
  dir: number;
  fromY: number;
}
interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  mine: boolean;
}
interface Mine {
  x: number;
  y: number;
  life: number;
}

export interface DefenderState {
  ship: { x: number; y: number; vx: number; vy: number; face: number; alive: boolean; invuln: number; cd: number; bombs: number; thrusting: boolean };
  ground: number[];
  planet: boolean;
  humans: Human[];
  foes: Foe[];
  shots: Shot[];
  mines: Mine[];
  sparks: Spark[];
  stars: { x: number; y: number; s: number }[];
  /** Foes still to arrive this wave, and the delay until the next arrival. */
  queue: number;
  arrive: number;
  waveTime: number;
  baiters: number;
  flash: number;
  respawn: number;
  levelDelay: number;
  nextLife: number;
  score: number;
  hi: number;
  lives: number;
  level: number;
  over: boolean;
}

/** Shortest signed horizontal distance a -> b on the wrapping world. */
export const wrapDx = (a: number, b: number) => ((((b - a + WORLD / 2) % WORLD) + WORLD) % WORLD) - WORLD / 2;
const wrapX = (x: number) => ((x % WORLD) + WORLD) % WORLD;
export const groundAt = (s: DefenderState, x: number) => s.ground[Math.floor(wrapX(x) / 20) % COLS]!;

function makeGround(rng: Rng): number[] {
  const out: number[] = [];
  let h = 540;
  let v = 0;
  for (let i = 0; i < COLS; i++) {
    v += rng.range(-3, 3);
    v = Math.max(-6, Math.min(6, v));
    h = Math.max(505, Math.min(555, h + v));
    out.push(h);
  }
  // Blend the seam so the world wraps smoothly.
  for (let i = 0; i < 12; i++) out[COLS - 1 - i] = out[COLS - 1 - i]! + ((out[0]! - out[COLS - 1 - i]!) * (12 - i)) / 14;
  return out;
}

export function createDefender(cfg: DefenderConfig): GameDefinition<DefenderState> {
  function foe(kind: FoeKind, x: number, y: number): Foe {
    return { kind, x: wrapX(x), y, vx: 0, vy: 0, human: -1, carrying: false, cd: 1.5, t: 0 };
  }

  function newWave(s: DefenderState, rng: Rng): void {
    s.planet = true;
    s.humans = Array.from({ length: HUMANS }, (_, i) => {
      const x = (i + 0.5) * (WORLD / HUMANS) + rng.range(-60, 60);
      return { x: wrapX(x), y: groundAt(s, x) - 8, vy: 0, state: 'walk', dir: rng.pick([-1, 1]), fromY: 0 };
    });
    s.foes = [];
    s.shots = [];
    s.mines = [];
    s.queue = Math.min(6 + s.level * 2, 22);
    s.arrive = 1;
    s.waveTime = 0;
    s.baiters = 0;
    // A few arrive at once so the wave starts with action.
    for (let k = 0; k < 4; k++) arrive(s, rng);
  }

  function arrive(s: DefenderState, rng: Rng): void {
    if (s.queue <= 0) return;
    s.queue -= 1;
    const x = s.ship.x + rng.range(500, WORLD - 500);
    const roll = rng.next();
    if (cfg.bombers && s.level >= 2 && roll < 0.2) s.foes.push(foe('bomber', x, rng.range(120, 380)));
    else if (cfg.pods && s.level >= 3 && roll < 0.35) s.foes.push(foe('pod', x, rng.range(120, 380)));
    else s.foes.push(foe('lander', x, TOP + rng.range(0, 30)));
  }

  function init({ rng, hiScore }: { rng: Rng; hiScore: number }): DefenderState {
    const s: DefenderState = {
      ship: { x: 400, y: 280, vx: 0, vy: 0, face: 1, alive: true, invuln: 1.5, cd: 0, bombs: START_BOMBS, thrusting: false },
      ground: makeGround(rng),
      planet: true,
      humans: [],
      foes: [],
      shots: [],
      mines: [],
      sparks: [],
      stars: Array.from({ length: 80 }, () => ({ x: rng.range(0, W), y: rng.range(TOP, 480), s: rng.pick([1, 1, 2]) })),
      queue: 0,
      arrive: 1,
      waveTime: 0,
      baiters: 0,
      flash: 0,
      respawn: 0,
      levelDelay: 0,
      nextLife: EXTRA_LIFE_EVERY,
      score: 0,
      hi: hiScore,
      lives: START_LIVES,
      level: 1,
      over: false,
    };
    newWave(s, rng);
    return s;
  }

  function killShip(s: DefenderState, rng: Rng, emit: UpdateContext['emit']): void {
    burst(s.sparks, rng, s.ship.x, s.ship.y, COLORS.cyan, 26);
    s.ship.alive = false;
    s.lives -= 1;
    s.respawn = 1.8;
    // A held humanoid is dropped.
    for (const h of s.humans) if (h.state === 'held') Object.assign(h, { state: 'fall', vy: 0, fromY: h.y });
    emit('die');
    if (s.lives <= 0) s.over = true;
  }

  function destroyFoe(s: DefenderState, i: number, byBomb: boolean, rng: Rng, emit: UpdateContext['emit']): void {
    const f = s.foes[i]!;
    s.foes.splice(i, 1);
    s.score += POINTS[f.kind];
    burst(s.sparks, rng, f.x, f.y, f.kind === 'pod' ? COLORS.gold : COLORS.coral, 10);
    emit('explode');
    // A lander that was carrying someone lets go.
    if (f.carrying && f.human >= 0) {
      const h = s.humans[f.human]!;
      if (h.state === 'carried') Object.assign(h, { state: 'fall', vy: 0, fromY: h.y });
    }
    if (f.kind === 'pod' && !byBomb) {
      for (let k = 0; k < 4; k++) {
        const sw = foe('swarmer', f.x + rng.range(-10, 10), f.y + rng.range(-10, 10));
        sw.vx = rng.range(-90, 90);
        sw.vy = rng.range(-90, 90);
        s.foes.push(sw);
      }
    }
  }

  function update(s: DefenderState, input: Input, dt: number, ctx: UpdateContext): void {
    const { rng, emit } = ctx;
    stepSparks(s.sparks, dt);
    s.flash = Math.max(0, s.flash - dt);
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
        newWave(s, rng);
        emit('wave');
      }
      return;
    }
    const ship = s.ship;
    s.waveTime += dt;

    if (!ship.alive) {
      s.respawn -= dt;
      if (s.respawn <= 0) Object.assign(ship, { x: ship.x, y: 280, vx: 0, vy: 0, alive: true, invuln: 2.5, cd: 0 });
    } else {
      ship.invuln = Math.max(0, ship.invuln - dt);
      ship.cd = Math.max(0, ship.cd - dt);
      const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      if (dir !== 0) ship.face = dir;
      ship.thrusting = dir !== 0;
      ship.vx += dir * 620 * dt;
      ship.vx *= 1 - 0.9 * dt;
      ship.vx = Math.max(-520, Math.min(520, ship.vx));
      ship.vy = ((input.held.down ? 1 : 0) - (input.held.up ? 1 : 0)) * 230;
      ship.x = wrapX(ship.x + ship.vx * dt);
      ship.y += ship.vy * dt;
      const floor = s.planet ? groundAt(s, ship.x) - 18 : 560;
      ship.y = Math.max(TOP + 8, ship.y);
      if (ship.y > floor) ship.y = floor;

      if (input.held.a && ship.cd <= 0) {
        ship.cd = 0.13;
        s.shots.push({ x: ship.x + ship.face * 26, y: ship.y, vx: ship.face * 1000 + ship.vx * 0.3, vy: 0, life: 0.45, mine: true });
        emit('fire');
      }
      if (input.pressed.b && ship.bombs > 0) {
        ship.bombs -= 1;
        s.flash = 0.25;
        for (let i = s.foes.length - 1; i >= 0; i--) {
          if (Math.abs(wrapDx(ship.x, s.foes[i]!.x)) < 420 && s.foes[i]!.y > TOP - 20) destroyFoe(s, i, true, rng, emit);
        }
        emit('wave');
      }
    }

    // Humanoids: wander, fall, get caught or set down.
    for (const h of s.humans) {
      const gy = groundAt(s, h.x) - 8;
      if (h.state === 'walk') {
        h.x = wrapX(h.x + h.dir * 12 * dt);
        h.y = gy;
        if (rng.next() < dt * 0.2) h.dir = 0 - h.dir;
      } else if (h.state === 'fall') {
        h.vy += 140 * dt;
        h.y += h.vy * dt;
        if (ship.alive && Math.abs(wrapDx(ship.x, h.x)) < 26 && Math.abs(h.y - ship.y) < 26) {
          h.state = 'held';
          h.vy = 0;
          s.score += 500;
          emit('pickup');
        } else if (h.y >= gy) {
          h.y = gy;
          if (h.y - h.fromY > 240) {
            h.state = 'dead';
            burst(s.sparks, rng, h.x, h.y, COLORS.paper, 8);
          } else {
            h.state = 'walk';
            s.score += 250;
          }
          h.vy = 0;
        }
      } else if (h.state === 'held') {
        h.x = ship.x;
        h.y = ship.y + 22;
        if (ship.y > gy - 40) {
          h.y = gy;
          h.state = 'walk';
          s.score += 500;
          emit('pickup');
        }
      }
    }

    // Foes.
    s.arrive -= dt;
    if (s.arrive <= 0 && s.queue > 0) {
      s.arrive = Math.max(1.2, 3.2 - s.level * 0.15);
      arrive(s, rng);
    }
    if (s.waveTime > 45 + s.baiters * 12 && s.baiters < 3 && s.foes.length > 0) {
      s.baiters += 1;
      s.foes.push(foe('baiter', ship.x + (rng.next() < 0.5 ? -700 : 700), rng.range(150, 380)));
    }
    const humansLeft = s.humans.filter((h) => h.state !== 'dead').length;
    if (s.planet && humansLeft === 0) {
      // The planet explodes: the ground is gone and every lander turns mutant.
      s.planet = false;
      s.flash = 0.8;
      for (const f of s.foes) if (f.kind === 'lander') Object.assign(f, { kind: 'mutant', carrying: false, human: -1 });
      emit('explode');
    }
    for (let i = s.foes.length - 1; i >= 0; i--) {
      const f = s.foes[i]!;
      f.t += dt;
      const toShipX = wrapDx(f.x, ship.x);
      const toShipY = ship.y - f.y;
      if (f.kind === 'lander') {
        const h = f.human >= 0 ? s.humans[f.human] : undefined;
        if (!f.carrying) {
          // Pick a walking humanoid and go for it.
          if (!h || h.state !== 'walk') {
            let best = -1;
            let bestD = Infinity;
            s.humans.forEach((hh, k) => {
              if (hh.state === 'walk' && !s.foes.some((o) => o !== f && o.human === k)) {
                const d = Math.abs(wrapDx(f.x, hh.x));
                if (d < bestD) {
                  bestD = d;
                  best = k;
                }
              }
            });
            f.human = best;
          }
          const target = f.human >= 0 ? s.humans[f.human] : undefined;
          if (target) {
            const dx = wrapDx(f.x, target.x);
            f.x = wrapX(f.x + Math.sign(dx) * Math.min(Math.abs(dx), 90) * dt);
            f.y += Math.min(60, Math.max(-30, target.y - 20 - f.y)) * dt;
            if (Math.abs(dx) < 10 && target.y - f.y < 28) {
              f.carrying = true;
              target.state = 'carried';
            }
          } else f.x = wrapX(f.x + 60 * dt * (i % 2 ? 1 : -1));
        } else {
          const target = s.humans[f.human]!;
          f.y -= 55 * dt;
          target.x = f.x;
          target.y = f.y + 22;
          if (f.y <= TOP) {
            target.state = 'dead';
            Object.assign(f, { kind: 'mutant', carrying: false, human: -1 });
            emit('wave');
          }
        }
      } else if (f.kind === 'mutant' || f.kind === 'baiter' || f.kind === 'swarmer') {
        const speed = f.kind === 'baiter' ? 300 : f.kind === 'swarmer' ? 135 : 150 + s.level * 6;
        const wob = Math.sin(f.t * 5 + i) * 70;
        const len = Math.hypot(toShipX, toShipY + wob * 0.2) || 1;
        f.x = wrapX(f.x + (toShipX / len) * speed * dt);
        f.y += ((toShipY + wob) / len) * speed * dt * 0.8;
        f.y = Math.max(TOP + 6, Math.min(s.planet ? groundAt(s, f.x) - 14 : 560, f.y));
        f.cd -= dt;
        if (f.cd <= 0 && f.kind !== 'swarmer' && ship.alive && Math.abs(toShipX) < 520) {
          const len2 = Math.hypot(toShipX, toShipY) || 1;
          s.shots.push({ x: f.x, y: f.y, vx: (toShipX / len2) * 330, vy: (toShipY / len2) * 330, life: 2.2, mine: false });
          f.cd = f.kind === 'baiter' ? 0.9 : rng.range(1.4, 2.8);
        }
      } else if (f.kind === 'bomber') {
        f.x = wrapX(f.x + 70 * dt);
        f.y = 220 + Math.sin(f.t * 1.4 + i) * 110;
        f.cd -= dt;
        if (f.cd <= 0) {
          s.mines.push({ x: f.x, y: f.y, life: 9 });
          f.cd = 1.4;
        }
      } else if (f.kind === 'pod') {
        f.x = wrapX(f.x + 55 * dt * (i % 2 ? 1 : -1));
        f.y = 240 + Math.sin(f.t + i) * 130;
      }
      // Ship vs foe.
      if (ship.alive && ship.invuln <= 0 && Math.abs(wrapDx(ship.x, f.x)) < RADIUS[f.kind] + 14 && Math.abs(f.y - ship.y) < RADIUS[f.kind] + 8) {
        killShip(s, rng, emit);
        if (s.over) return;
      }
    }

    // Shots.
    for (let i = s.shots.length - 1; i >= 0; i--) {
      const sh = s.shots[i]!;
      sh.x = wrapX(sh.x + sh.vx * dt);
      sh.y += sh.vy * dt;
      sh.life -= dt;
      if (sh.life <= 0 || sh.y < TOP || sh.y > SEA + 60) {
        s.shots.splice(i, 1);
        continue;
      }
      if (sh.mine) {
        const mi = s.mines.findIndex((m) => Math.abs(wrapDx(sh.x, m.x)) < 14 && Math.abs(m.y - sh.y) < 10);
        if (mi >= 0) {
          s.mines.splice(mi, 1);
          s.shots.splice(i, 1);
          s.score += 25;
          emit('pickup');
          continue;
        }
        const fi = s.foes.findIndex((f) => Math.abs(wrapDx(sh.x, f.x)) < RADIUS[f.kind] + 8 && Math.abs(f.y - sh.y) < RADIUS[f.kind] + 5);
        if (fi >= 0) {
          destroyFoe(s, fi, false, rng, emit);
          s.shots.splice(i, 1);
        }
      } else if (ship.alive && ship.invuln <= 0 && Math.abs(wrapDx(sh.x, ship.x)) < 16 && Math.abs(sh.y - ship.y) < 12) {
        s.shots.splice(i, 1);
        killShip(s, rng, emit);
        if (s.over) return;
      }
    }
    for (let i = s.mines.length - 1; i >= 0; i--) {
      const m = s.mines[i]!;
      m.life -= dt;
      if (m.life <= 0) {
        s.mines.splice(i, 1);
        continue;
      }
      if (ship.alive && ship.invuln <= 0 && Math.abs(wrapDx(ship.x, m.x)) < 18 && Math.abs(m.y - ship.y) < 14) {
        s.mines.splice(i, 1);
        killShip(s, rng, emit);
        if (s.over) return;
      }
    }

    // Wave over when nothing hostile is left.
    if (s.foes.length === 0 && s.queue === 0 && ship.alive && s.levelDelay <= 0) {
      s.score += humansLeft * 100 * Math.min(s.level, 5);
      s.levelDelay = 2;
      emit('wave');
    }
    if (s.score >= s.nextLife) {
      s.lives += 1;
      s.ship.bombs += 1;
      s.nextLife += EXTRA_LIFE_EVERY;
      emit('pickup');
    }
    if (s.score > s.hi) s.hi = s.score;
  }

  function render(s: DefenderState, g: CanvasRenderingContext2D, time: number): void {
    clear(g);
    const cam = s.ship.x - W / 2 + s.ship.face * 80;
    const sx = (x: number) => W / 2 + wrapDx(cam + W / 2, x);
    const onScreen = (x: number, m = 40) => Math.abs(wrapDx(cam + W / 2, x)) < W / 2 + m;
    if (s.flash > 0) {
      g.fillStyle = `rgba(246,239,255,${Math.min(0.5, s.flash * 2)})`;
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = COLORS.paper;
    for (const st of s.stars) {
      g.globalAlpha = 0.5;
      g.fillRect(((st.x - cam * 0.2) % W + W) % W, st.y, st.s, st.s);
    }
    g.globalAlpha = 1;
    // Radar strip.
    const rw = 280;
    const rx = (W - rw) / 2;
    g.fillStyle = 'rgba(79,227,214,0.12)';
    g.fillRect(rx, 8, rw, 56);
    g.strokeStyle = COLORS.cyan;
    g.lineWidth = 1;
    g.strokeRect(rx + 0.5, 8.5, rw, 56);
    const rmap = (x: number) => rx + ((wrapDx(s.ship.x, x) + WORLD / 2) / WORLD) * rw;
    const rmapY = (y: number) => 10 + ((y - TOP) / (SEA - TOP)) * 50;
    // Terrain.
    if (s.planet) {
      g.strokeStyle = '#a06a3c';
      g.lineWidth = 3;
      g.beginPath();
      for (let sxp = 0; sxp <= W; sxp += 20) {
        const wx = cam + sxp;
        const y = groundAt(s, wx);
        if (sxp === 0) g.moveTo(sxp, y);
        else g.lineTo(sxp, y);
      }
      g.stroke();
      g.fillStyle = '#3a2410';
      g.beginPath();
      g.moveTo(0, H);
      for (let sxp = 0; sxp <= W; sxp += 20) g.lineTo(sxp, groundAt(s, cam + sxp));
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    }
    for (const h of s.humans) {
      if (h.state === 'dead') continue;
      if (onScreen(h.x)) {
        g.fillStyle = COLORS.gold;
        g.fillRect(sx(h.x) - 3, h.y - 14, 6, 14);
        g.fillStyle = COLORS.paper;
        g.fillRect(sx(h.x) - 3, h.y - 18, 6, 5);
      }
      g.fillStyle = COLORS.gold;
      g.fillRect(rmap(h.x), 56, 2, 3);
    }
    for (const m of s.mines) {
      if (!onScreen(m.x)) continue;
      g.strokeStyle = COLORS.coral;
      g.lineWidth = 2;
      g.strokeRect(sx(m.x) - 6, m.y - 6, 12, 12);
    }
    for (const f of s.foes) {
      const color = f.kind === 'lander' ? '#7BE495' : f.kind === 'mutant' ? COLORS.coral : f.kind === 'baiter' ? COLORS.paper : f.kind === 'bomber' ? COLORS.purple : f.kind === 'pod' ? COLORS.gold : COLORS.cyan;
      g.fillStyle = color;
      g.fillRect(rmap(f.x), rmapY(f.y), 2, 2);
      if (!onScreen(f.x)) continue;
      const x = sx(f.x);
      const r = RADIUS[f.kind];
      g.beginPath();
      if (f.kind === 'lander' || f.kind === 'mutant') {
        g.arc(x, f.y, r, Math.PI, 0);
        g.lineTo(x + r, f.y + r * 0.7);
        g.lineTo(x - r, f.y + r * 0.7);
      } else if (f.kind === 'pod') g.arc(x, f.y, r, 0, TAU);
      else g.rect(x - r, f.y - r * 0.6, r * 2, r * 1.2);
      g.fill();
      g.fillStyle = COLORS.bg;
      g.fillRect(x - 4, f.y - 3, 3, 3);
      g.fillRect(x + 2, f.y - 3, 3, 3);
    }
    g.fillStyle = COLORS.coral;
    for (const sh of s.shots) if (!sh.mine && onScreen(sh.x)) g.fillRect(sx(sh.x) - 3, sh.y - 3, 6, 6);
    g.fillStyle = COLORS.gold;
    for (const sh of s.shots) if (sh.mine && onScreen(sh.x)) g.fillRect(sx(sh.x) - 10, sh.y - 1, 20, 3);
    if (s.ship.alive && (s.ship.invuln <= 0 || Math.floor(time * 10) % 2 === 0)) {
      const x = sx(s.ship.x);
      g.fillStyle = cfg.accent;
      g.beginPath();
      g.moveTo(x + s.ship.face * 18, s.ship.y);
      g.lineTo(x - s.ship.face * 14, s.ship.y - 9);
      g.lineTo(x - s.ship.face * 8, s.ship.y);
      g.lineTo(x - s.ship.face * 14, s.ship.y + 9);
      g.closePath();
      g.fill();
      if (s.ship.thrusting) {
        g.fillStyle = COLORS.gold;
        g.fillRect(x - s.ship.face * 22, s.ship.y - 2, 8, 4);
      }
    }
    g.fillStyle = COLORS.paper;
    g.fillRect(rmap(s.ship.x) - 1, rmapY(s.ship.y) - 1, 4, 3);
    drawSparks(g, s.sparks.map((p) => ({ ...p, x: sx(p.x) })));
    hud(g, s, `WAVE ${s.level}  BOMBS ${s.ship.bombs}`, s.lives);
    if (!s.planet && !s.over) banner(g, 'PLANET LOST!', 100);
    if (s.levelDelay > 0) banner(g, 'WAVE COMPLETE!', 270);
    gameOver(g, s.over);
  }

  return { id: cfg.id, size: { width: W, height: H }, init, update, render, status: (s) => makeStatus(s, s.lives, s.level) };
}
