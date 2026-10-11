import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import graveKnight, { CONFIG } from './index';
import type { Foe, ScrollerState } from '../_shared/side-scroller';

const GAME = graveKnight;

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ right: f % 400 < 300, left: f % 400 >= 330, a: f % 12 < 6 }, { b: f % 55 === 0, up: f % 97 === 0 });

describe('grave-knight', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(graveKnight, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(graveKnight, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(graveKnight, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(graveKnight, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(graveKnight, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(graveKnight, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(graveKnight, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect|ellipse)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = graveKnight.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      graveKnight.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) graveKnight.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const BASE = 14;
const wp = CONFIG.weapon;

/** A long flat road with nothing on it; each test adds what it needs. */
function road() {
  const rng = createRng(5);
  const s: ScrollerState = GAME.init({ rng, hiScore: 0 });
  s.len = 140;
  s.top = Array.from({ length: 140 }, () => BASE);
  s.ledges = [];
  s.spikes = [];
  s.foes = [];
  s.items = [];
  s.hostages = [];
  s.doors = [];
  s.shots = [];
  s.flag = false;
  s.riseTimer = 1e9;
  s.boss = { x: 132, y: BASE, hp: 10, maxHp: 10, dir: -1, cd: 99, awake: false, dead: false, body: { x: 132, y: BASE, vx: 0, vy: 0, face: -1, onGround: true, climbing: false, drop: 0 } };
  Object.assign(s.hero, { x: 10.5, y: BASE, vx: 0, vy: 0, onGround: true, alive: true, hp: CONFIG.health, invuln: 0, cd: 0, swing: 0, energy: 100, ammo: CONFIG.ammo ?? 0, face: 1 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  const foe = (kind: Foe['kind'], x: number, y = BASE, awake = true): Foe => ({ kind, x, y, vx: 0, vy: 0, hp: kind === 'shooter' ? 2 : 1, cd: 99, t: 0, dir: -1, awake, dead: false, onGround: kind !== 'flyer' });
  return { s, tick, foe };
}
const attack = held({ a: true }, { a: true });
const jumpKey = held({}, { b: true });

describe(`${CONFIG.id} rules`, () => {
  it('generated levels start on flat ground, end on a flat arena, keep steps to one row, and put a flat landing after every pit', () => {
    for (let level = 1; level <= 4; level++) {
      for (const seed of [1, 2, 3, 4]) {
        const s = GAME.init({ rng: createRng(seed), hiScore: 0 });
        s.level = level;
        const t = GAME.init({ rng: createRng(seed * 13 + level), hiScore: 0 });
        for (const lv of [s, t]) {
          expect(lv.top).toHaveLength(lv.len);
          expect(lv.top.slice(0, 12).every((v) => v === 14)).toBe(true);
          expect(new Set(lv.top.slice(lv.len - 30)).size).toBe(1);
          for (let c = 1; c < lv.len; c++) {
            if (lv.top[c]! >= 0 && lv.top[c - 1]! >= 0) expect(Math.abs(lv.top[c]! - lv.top[c - 1]!)).toBeLessThanOrEqual(1);
            if (lv.top[c]! === -1 && lv.top[c - 1]! >= 0) {
              let e = c;
              while (lv.top[e] === -1) e++;
              expect(e - c).toBeLessThanOrEqual(3);
              expect(lv.top.slice(e, e + 3).every((v) => v >= 0)).toBe(true);
            }
          }
          for (const f of lv.foes) {
            const col = Math.floor(f.x);
            expect(lv.top[col]).toBeGreaterThanOrEqual(0);
            expect(lv.spikes).not.toContain(col);
          }
        }
      }
    }
  });

  it('the stage clock runs down; running out costs a life but gives another minute', () => {
    const { s, tick } = road();
    s.clock = 1;
    tick(90);
    expect(s.lives).toBe(2);
    expect(s.clock).toBeGreaterThan(50);
  });

  it('levels get longer as you progress', () => {
    const a = GAME.init({ rng: createRng(1), hiScore: 0 });
    const b = GAME.init({ rng: createRng(1), hiScore: 0 });
    b.level = 3;
    const rng = createRng(1);
    const c = GAME.init({ rng, hiScore: 0 });
    c.level = 3;
    c.top = [];
    // Rebuilding via a stage clear produces the longer level.
    c.flag = true;
    c.hero.x = c.len - 1;
    GAME.update(c, NO_INPUT, TICK, { rng, emit: () => undefined });
    for (let k = 0; k < 150; k++) GAME.update(c, NO_INPUT, TICK, { rng, emit: () => undefined });
    expect(c.level).toBe(4);
    expect(c.len).toBeGreaterThan(a.len);
    void b;
  });

  it('the hero walks at a steady pace, stops at the world edge, and jumps about as high as designed', () => {
    const { s, tick } = road();
    tick(30, held({ right: true }));
    expect(s.hero.x).toBeCloseTo(10.5 + CONFIG.walk * 0.5, 1);
    s.hero.x = 1;
    tick(120, held({ left: true }));
    expect(s.hero.x).toBeGreaterThanOrEqual(0.5);
    let top = BASE;
    tick(1, jumpKey);
    for (let f = 0; f < 80; f++) {
      tick(1);
      top = Math.min(top, s.hero.y);
    }
    const apex = (CONFIG.jump * CONFIG.jump) / (2 * 38);
    expect(BASE - top).toBeGreaterThan(apex * 0.88);
    expect(BASE - top).toBeLessThan(apex * 1.05);
    expect(s.hero.y).toBe(BASE);
  });

  it('a one-row step blocks the way until you jump it', () => {
    const { s, tick } = road();
    for (let c = 16; c < 140; c++) s.top[c] = BASE - 1;
    tick(120, held({ right: true }));
    expect(s.hero.x).toBeLessThan(16);
    s.hero.x = 14.5;
    s.hero.y = BASE;
    let cleared = false;
    for (let f = 0; f < 120 && !cleared; f++) {
      tick(1, held({ right: true }, { b: f === 0 }));
      cleared = s.hero.x > 17;
    }
    expect(cleared).toBe(true);
  });

  it('falling into a pit loses a life and you come back at the last checkpoint', () => {
    const { s, tick } = road();
    for (let c = 20; c < 24; c++) s.top[c] = -1;
    s.checkpoint = 3;
    Object.assign(s.hero, { x: 19.5 });
    tick(120, held({ right: true }));
    expect(s.lives).toBe(2);
    tick(150);
    expect(s.hero.alive).toBe(true);
    expect(s.hero.x).toBeLessThan(5);
  });

  it('spikes hurt', () => {
    const { s, tick } = road();
    s.spikes.push(14);
    Object.assign(s.hero, { x: 13.2 });
    tick(30, held({ right: true }));
    expect(CONFIG.health > 1 ? s.hero.hp : s.lives).toBeLessThan(CONFIG.health > 1 ? CONFIG.health : 3);
  });

  it.runIf(wp.kind === 'melee')('the melee swing hits foes in front within reach, not behind and not out of reach', () => {
    const { s, tick, foe } = road();
    s.foes.push(foe('walker', 10.5 + wp.reach - 0.4), foe('walker', 10.5 - 1.2), foe('walker', 10.5 + wp.reach + 2.5));
    s.foes.forEach((f) => (f.dir = 0));
    tick(1, attack);
    expect(s.foes.filter((f) => !f.dead)).toHaveLength(2);
    expect(s.score).toBe(100);
    expect(s.hero.swing).toBeGreaterThan(0);
    tick(1, attack);
    expect(s.score).toBe(100); // still cooling down
  });

  it.runIf(wp.kind === 'throw' || wp.kind === 'arc')('shots travel, hit what they meet, and only a few can be in flight', () => {
    const { s, tick, foe } = road();
    s.foes.push(foe('walker', 10.5 + (wp.kind === 'arc' ? 4.5 : 6)));
    s.foes[0]!.dir = 0;
    tick(1, attack);
    expect(s.shots.filter((x) => x.mine)).toHaveLength(1);
    for (let k = 0; k < wp.max + 2; k++) {
      s.hero.cd = 0;
      tick(1, attack);
    }
    expect(s.shots.filter((x) => x.mine).length).toBeLessThanOrEqual(wp.max);
    tick(80);
    expect(s.shots.filter((x) => x.mine)).toHaveLength(0);
    expect(s.score).toBe(100);
  });

  it.runIf(wp.kind === 'arc')('arcing shots rise then drop, and are stopped by the ground', () => {
    const { s, tick } = road();
    tick(1, attack);
    const y0 = s.shots[0]!.y;
    tick(8);
    expect(s.shots[0]!.y).toBeLessThan(y0);
    tick(120);
    expect(s.shots.filter((x) => x.mine)).toHaveLength(0);
  });

  it.runIf(wp.kind === 'hybrid')('up close the attack is a sword (double damage), far off it throws a star', () => {
    const near = road();
    near.s.foes.push(near.foe('shooter', 10.5 + 1.2));
    near.tick(1, attack);
    expect(near.s.foes.filter((f) => !f.dead)).toHaveLength(0);
    expect(near.s.shots).toHaveLength(0);
    const far = road();
    far.tick(1, attack);
    expect(far.s.shots.filter((x) => x.mine)).toHaveLength(1);
  });

  it('enemies sleep until you are within range, then wake', () => {
    const { s, tick, foe } = road();
    s.foes.push(foe('walker', 50.5, BASE, false));
    tick(5);
    expect(s.foes[0]!.awake).toBe(false);
    s.hero.x = 40;
    tick(2);
    expect(s.foes[0]!.awake).toBe(true);
  });

  it('walkers patrol and turn back at a pit; hoppers jump at you; flyers close in; shooters fire from a distance', () => {
    const w = road();
    for (let c = 24; c < 27; c++) w.s.top[c] = -1;
    w.s.hero.x = 8;
    w.s.foes.push(w.foe('walker', 22.5));
    w.s.foes[0]!.dir = 1;
    w.tick(60 * 6);
    expect(w.s.foes[0]!.x).toBeLessThan(24);
    expect(w.s.foes[0]!.y).toBe(BASE);

    const h = road();
    h.s.foes.push(h.foe('hopper', 20.5));
    h.s.foes[0]!.cd = 0;
    let airborne = false;
    for (let f = 0; f < 90; f++) {
      h.tick(1);
      if (h.s.foes[0]!.y < BASE - 0.5) airborne = true;
    }
    expect(airborne).toBe(true);
    expect(h.s.foes[0]!.x).toBeLessThan(20.5);

    const fl = road();
    fl.s.foes.push(fl.foe('flyer', 20.5, 11));
    const d0 = 20.5 - 10.5;
    fl.tick(90);
    expect(Math.abs(fl.s.foes[0]!.x - fl.s.hero.x)).toBeLessThan(d0 - 1);

    const sh = road();
    const shooter = sh.foe('shooter', 20.5);
    shooter.cd = 0;
    sh.s.foes.push(shooter);
    sh.tick(2);
    expect(sh.s.shots.filter((x) => !x.mine)).toHaveLength(1);
    expect(sh.s.shots.find((x) => !x.mine)!.vx).toBeLessThan(0);
  });

  it('touching an enemy hurts: with more than one hit point you survive and are briefly invulnerable, otherwise a life is lost', () => {
    const { s, tick, foe } = road();
    s.foes.push(foe('walker', 10.7));
    s.foes[0]!.dir = 0;
    tick(2);
    if (CONFIG.health > 1) {
      expect(s.hero.hp).toBe(CONFIG.health - 1);
      expect(s.hero.alive).toBe(true);
      expect(s.hero.invuln).toBeGreaterThan(1);
      tick(30);
      expect(s.hero.hp).toBe(CONFIG.health - 1);
    } else {
      expect(s.hero.alive).toBe(false);
      expect(s.lives).toBe(2);
    }
  });

  it('running out of hit points costs a life and respawns at the checkpoint', () => {
    const { s, tick, foe } = road();
    s.checkpoint = 6;
    for (let k = 0; k < CONFIG.health; k++) {
      s.hero.invuln = 0;
      s.foes.push(foe('walker', s.hero.x));
      s.foes[s.foes.length - 1]!.dir = 0;
      tick(2);
    }
    expect(s.hero.alive).toBe(false);
    expect(s.lives).toBe(2);
    tick(150);
    expect(s.hero.alive).toBe(true);
    expect(s.hero.x).toBeCloseTo(6.5, 0);
    expect(s.hero.hp).toBe(CONFIG.health);
  });

  it('coins score 100 each', () => {
    if (CONFIG.energy) return;
    const { s, tick } = road();
    s.items.push({ x: 11.5, y: BASE - 0.8, kind: 'coin' });
    tick(30, held({ right: true }));
    expect(s.score).toBe(100);
  });

  it('the boss wakes near the end, takes damage, and dropping it opens the flag; reaching the flag clears the stage', () => {
    const { s, tick } = road();
    s.boss.x = 130;
    s.boss.body.x = 130;
    Object.assign(s.hero, { x: s.len - 20 });
    tick(3);
    expect(s.boss.awake).toBe(true);
    s.boss.hp = 1;
    s.boss.cd = 99;
    s.boss.body.x = s.hero.x + 4;
    s.boss.x = s.hero.x + 4;
    s.shots.push({ x: s.boss.x - 0.5, y: s.boss.y - 1.2, vx: 1, vy: 0, life: 1, mine: true, dmg: 2 });
    tick(2);
    expect(s.boss.dead).toBe(true);
    expect(s.flag).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(3000);
    Object.assign(s.hero, { x: s.len - 2 });
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(150);
    expect(s.level).toBe(2);
  });

  it('killing the boss with a shot while many enemy shots are in flight does not crash, and clears the enemy fire', () => {
    const { s, tick } = road();
    Object.assign(s.hero, { x: s.len - 20, invuln: 99 });
    s.boss.awake = true;
    s.boss.hp = 1;
    s.boss.cd = 99;
    s.boss.body.x = s.hero.x + 4;
    s.boss.x = s.hero.x + 4;
    for (let k = 0; k < 6; k++) s.shots.push({ x: s.hero.x + 8 + k, y: BASE - 5, vx: 0, vy: 0, life: 5, mine: false, dmg: 1 });
    s.shots.push({ x: s.boss.x - 0.5, y: s.boss.y - 1.2, vx: 1, vy: 0, life: 1, mine: true, dmg: 2 });
    for (let k = 0; k < 6; k++) s.shots.push({ x: s.hero.x + 15 + k, y: BASE - 5, vx: 0, vy: 0, life: 5, mine: false, dmg: 1 });
    tick(2);
    expect(s.boss.dead).toBe(true);
    expect(s.shots.every((x) => x.mine)).toBe(true);
  });

  it('the flag does nothing before the boss is beaten', () => {
    const { s, tick } = road();
    Object.assign(s.hero, { x: s.len - 2 });
    tick(10);
    expect(s.levelDelay).toBe(0);
  });

  it.runIf(!!CONFIG.energy)('energy drains and fruit refills it; an empty meter costs a life', () => {
    const { s, tick } = road();
    tick(60 * 5);
    expect(s.hero.energy).toBeLessThan(90);
    s.items.push({ x: 11.5, y: BASE - 0.8, kind: 'fruit' });
    s.hero.energy = 40;
    s.hero.x = 10.8;
    tick(2);
    expect(s.hero.energy).toBeGreaterThan(55);
    s.hero.energy = 0.05;
    tick(10);
    expect(s.lives).toBe(2);
  });

  it.runIf(!!CONFIG.ammo)('the pistol runs out of ammunition; a door restocks it once', () => {
    const { s, tick } = road();
    s.hero.ammo = 1;
    tick(1, attack);
    expect(s.hero.ammo).toBe(0);
    s.hero.cd = 0;
    const before = s.shots.length;
    tick(1, attack);
    expect(s.shots.length).toBe(before);
    s.shots = [];
    s.doors.push({ x: 10.5, used: false });
    tick(1, held({}, { up: true }));
    expect(s.hero.ammo).toBe(CONFIG.ammo);
    expect(s.foes.length).toBeGreaterThan(0); // a guard steps out
    s.hero.ammo = 2;
    tick(1, held({}, { up: true }));
    expect(s.hero.ammo).toBe(2); // the door is used up
  });

  it.runIf(!!CONFIG.rising)('zombies rise from the ground ahead of you over time, but not too many', () => {
    const { s, tick } = road();
    s.riseTimer = 0.1;
    for (let f = 0; f < 60 * 30; f++) {
      s.hero.invuln = 99;
      tick(1);
    }
    const zombies = s.foes.filter((f) => f.kind === 'zombie');
    expect(zombies.length).toBeGreaterThan(0);
    expect(zombies.length).toBeLessThanOrEqual(6);
  });

  it.runIf(!!CONFIG.hostages)('rescuing a hostage scores 1000, and rescuing all three adds a big bonus at the end', () => {
    const { s, tick } = road();
    s.hostages.push({ x: 11.5, y: BASE, saved: false }, { x: 40.5, y: BASE, saved: true }, { x: 60.5, y: BASE, saved: true });
    tick(30, held({ right: true }));
    expect(s.score).toBe(1000);
    s.boss.dead = true;
    s.flag = true;
    Object.assign(s.hero, { x: s.len - 2 });
    const before = s.score;
    tick(2);
    expect(s.score - before).toBeGreaterThanOrEqual(2000 + 3000);
  });
});
