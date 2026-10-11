import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import vaultDelver, { type DelverState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 160 < 40, right: f % 160 >= 80 && f % 160 < 120, up: f % 160 >= 40 && f % 160 < 80, down: f % 160 >= 120, a: f % 7 < 4 }, { b: f % 600 === 599 });

describe('vault-delver', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(vaultDelver, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(vaultDelver, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(vaultDelver, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(vaultDelver, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(vaultDelver, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(vaultDelver, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(vaultDelver, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = vaultDelver.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      vaultDelver.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) vaultDelver.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 21;
const i = (x: number, y: number) => y * COLS + x;

/** An open room (border walls only), hero at (3.5, 3.5), nothing else. */
function room() {
  const rng = createRng(5);
  const s: DelverState = vaultDelver.init({ rng, hiScore: 0 });
  s.grid = s.grid.map((_, k) => {
    const x = k % COLS;
    const y = Math.floor(k / COLS);
    return x === 0 || y === 0 || x === COLS - 1 || y === 14 ? 1 : 0;
  });
  s.mobs = [];
  s.gens = [];
  s.items = [];
  s.arrows = [];
  s.keys = 0;
  s.hero = { x: 3.5, y: 3.5, fx: 1, fy: 0, cd: 0 };
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) vaultDelver.update(s, input, TICK, { rng, emit: () => undefined }); };
  const mob = (kind: 0 | 1 | 2, x: number, y: number, cd = 0) => ({ kind, x, y, hp: kind === 0 ? 1 : 2, cd });
  return { s, tick, mob };
}

describe('vault-delver rules', () => {
  it('the hero walks, is stopped by walls, and slides along them', () => {
    const { s, tick } = room();
    tick(240, held({ right: true }));
    expect(s.hero.x).toBeGreaterThan(18);
    expect(s.hero.x).toBeLessThan(20);
    const before = s.hero.y;
    tick(60, held({ right: true, down: true }));
    expect(s.hero.y).toBeGreaterThan(before); // slid down the wall
  });

  it('arrows kill a ghost (10), take two hits for a grunt (20), and stop at walls', () => {
    const a = room();
    a.s.mobs.push(a.mob(0, 9.5, 3.5, 99));
    a.tick(30, held({ a: true }));
    expect(a.s.mobs).toHaveLength(0);
    expect(a.s.score).toBe(10);

    const b = room();
    b.s.mobs.push(b.mob(1, 9.5, 3.5, 99));
    b.tick(70, held({ a: true }));
    expect(b.s.mobs).toHaveLength(0);
    expect(b.s.score).toBe(20);

    const c = room();
    c.s.grid[i(6, 3)] = 1;
    c.s.mobs.push(c.mob(0, 9.5, 3.5, 99));
    c.tick(60, held({ a: true }));
    expect(c.s.score).toBe(0);
  });

  it('a generator takes three arrows (100 plus 10 per hit) and stops spawning', () => {
    const { s, tick } = room();
    s.gens.push({ x: 9.5, y: 3.5, hp: 3, timer: 99 });
    tick(100, held({ a: true }));
    expect(s.gens).toHaveLength(0);
    expect(s.score).toBe(100 + 30);
  });

  it('generators keep spawning monsters while the hero is near, up to a cap', () => {
    const { s, tick } = room();
    s.gens.push({ x: 10.5, y: 7.5, hp: 3, timer: 0.1 });
    tick(60 * 40);
    expect(s.mobs.length).toBeGreaterThan(3);
    expect(s.mobs.length).toBeLessThanOrEqual(15);
  });

  it('touching a monster drains health at a steady rate', () => {
    const { s, tick, mob } = room();
    s.mobs.push(mob(1, 3.6, 3.5));
    tick(60);
    expect(s.health).toBeLessThan(800 - 15);
    expect(s.health).toBeGreaterThan(800 - 40);
  });

  it('health ticks down by itself; running out ends the run', () => {
    const { s, tick } = room();
    tick(120);
    expect(s.health).toBe(798);
    s.health = 2;
    tick(180);
    expect(s.over).toBe(true);
  });

  it('a door needs a key; one key opens one door', () => {
    const a = room();
    a.s.grid[i(6, 3)] = 2;
    a.tick(120, held({ right: true }));
    expect(a.s.grid[i(6, 3)]).toBe(2);
    expect(a.s.hero.x).toBeLessThan(6);

    const b = room();
    b.s.grid[i(6, 3)] = 2;
    b.s.keys = 1;
    b.tick(120, held({ right: true }));
    expect(b.s.grid[i(6, 3)]).toBe(0);
    expect(b.s.keys).toBe(0);
    expect(b.s.hero.x).toBeGreaterThan(6);
  });

  it('picks up food (+150 health), treasure (+100), potions and keys', () => {
    const { s, tick } = room();
    s.health = 500;
    s.items.push({ x: 4.5, y: 3.5, kind: 0 }, { x: 5.5, y: 3.5, kind: 1 }, { x: 6.5, y: 3.5, kind: 2 }, { x: 7.5, y: 3.5, kind: 3 });
    tick(120, held({ right: true }));
    expect(s.health).toBeGreaterThan(640);
    expect(s.score).toBe(100);
    expect(s.potions).toBe(2);
    expect(s.keys).toBe(1);
    expect(s.items).toHaveLength(0);
  });

  it('a potion clears nearby monsters and hurts generators, but not far ones', () => {
    const { s, tick, mob } = room();
    s.mobs.push(mob(0, 6.5, 3.5, 99), mob(1, 5.5, 5.5, 99), mob(0, 19.5, 12.5, 99));
    s.gens.push({ x: 7.5, y: 3.5, hp: 3, timer: 99 });
    tick(1, held({}, { b: true }));
    expect(s.mobs).toHaveLength(1);
    expect(s.gens[0]!.hp).toBe(2);
    expect(s.potions).toBe(0);
    tick(1, held({}, { b: true }));
    expect(s.mobs).toHaveLength(1); // no potion left
  });

  it('monsters find their way around walls', () => {
    const { s, tick, mob } = room();
    for (let y = 1; y <= 12; y++) s.grid[i(8, y)] = 1; // a wall with a gap at the bottom
    s.hero = { x: 12.5, y: 3.5, fx: 1, fy: 0, cd: 0 };
    s.mobs.push(mob(0, 4.5, 3.5, 99));
    tick(60 * 8);
    expect(s.mobs[0]!.x).toBeGreaterThan(9);
  });

  it('a demon shoots from a distance, and its shot hurts (25)', () => {
    const { s, tick, mob } = room();
    s.mobs.push(mob(2, 10.5, 3.5, 0));
    const before = s.health;
    tick(120);
    expect(s.arrows.some((a) => !a.mine) || s.health < before - 20).toBe(true);
  });

  it('reaching the exit starts the next level with a fresh vault', () => {
    const { s, tick } = room();
    s.grid[i(5, 3)] = 3;
    tick(120, held({ right: true }));
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(120);
    expect(s.level).toBe(2);
    expect(s.gens.length).toBeGreaterThanOrEqual(2);
  });

  it('every generated level has a door-guarded exit, a key, and a path to both', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = vaultDelver.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.grid[i(19, 13)]).toBe(3);
      expect(s.grid[i(18, 13)]).toBe(2);
      expect(s.items.filter((it) => it.kind === 3)).toHaveLength(1);
      const seen = new Set([i(1, 1)]);
      const q = [i(1, 1)];
      for (let h = 0; h < q.length; h++) for (const n of [q[h]! - 1, q[h]! + 1, q[h]! - COLS, q[h]! + COLS]) if (s.grid[n] === 0 && !seen.has(n)) (seen.add(n), q.push(n));
      expect(seen.has(i(17, 13))).toBe(true);
      for (const it of s.items) expect(seen.has(i(Math.floor(it.x), Math.floor(it.y)))).toBe(true);
    }
  });
});
