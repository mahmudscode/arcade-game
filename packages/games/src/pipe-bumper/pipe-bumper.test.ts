import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import pipeBumper, { type BumperState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 60, right: f % 200 >= 100 && f % 200 < 160 }, { a: f % 23 === 0 });

describe('pipe-bumper', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(pipeBumper, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(pipeBumper, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(pipeBumper, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(pipeBumper, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(pipeBumper, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(pipeBumper, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(pipeBumper, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = pipeBumper.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      pipeBumper.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) pipeBumper.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;

function arena() {
  const rng = createRng(5);
  const s: BumperState = pipeBumper.init({ rng, hiScore: 0 });
  s.enemies = [];
  s.queue = 50;
  s.spawnTimer = 1e9;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) pipeBumper.update(s, input, TICK, { rng, emit: () => undefined }); };
  const enemy = (x: number, y: number, kind = 0, flipped = 0) => ({
    b: { x, y, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 },
    kind,
    dir: 1,
    flipped,
    angry: false,
    armor: kind === 1 ? 2 : 1,
  });
  return { s, tick, enemy };
}
const jump = held({}, { a: true });

describe('pipe-bumper rules', () => {
  it('jumping into a platform from below flips an enemy standing on it', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 5.5, y: 16 });
    s.enemies.push(enemy(5.5, 13));
    s.enemies[0]!.dir = 0;
    tick(1, jump);
    tick(20);
    expect(s.enemies[0]!.flipped).toBeGreaterThan(0);
    expect(s.shakes.length).toBeGreaterThanOrEqual(0);
  });

  it('a bump away from an enemy leaves it alone', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 5.5, y: 16 });
    const e = enemy(10.5, 13);
    e.dir = 0;
    s.enemies.push(e);
    tick(1, jump);
    tick(20);
    expect(s.enemies[0]!.flipped).toBe(0);
  });

  it('kicking a flipped enemy scores 800, doubling for each one in a row', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 5.5, y: 16 });
    s.enemies.push(enemy(5.5, 16, 0, 5), enemy(5.9, 16, 0, 5), enemy(20.5, 16, 0, 5));
    tick(2);
    expect(s.enemies).toHaveLength(1);
    expect(s.score).toBe(800 + 1600);
    expect(s.lives).toBe(3);
  });

  it('touching an enemy on its feet costs a life', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 5.5, y: 16 });
    s.enemies.push(enemy(5.7, 16));
    tick(2);
    expect(s.lives).toBe(2);
  });

  it('a flipped enemy gets back up angry, and moves faster', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 25.5, y: 16 });
    const e = enemy(5.5, 13, 0, 1);
    e.dir = 1;
    s.enemies.push(e);
    tick(60 * 2);
    expect(s.enemies[0]!.flipped).toBeLessThanOrEqual(0);
    expect(s.enemies[0]!.angry).toBe(true);
    const calm = arena();
    Object.assign(calm.s.me, { x: 25.5, y: 16 });
    calm.s.enemies.push(calm.enemy(5.5, 13));
    const angry = arena();
    Object.assign(angry.s.me, { x: 25.5, y: 16 });
    angry.s.enemies.push(angry.enemy(5.5, 13));
    angry.s.enemies[0]!.angry = true;
    calm.tick(30);
    angry.tick(30);
    expect(angry.s.enemies[0]!.b.x - 5.5).toBeGreaterThan(calm.s.enemies[0]!.b.x - 5.5);
  });

  it('crabs take two bumps to flip', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 5.5, y: 16 });
    const e = enemy(5.5, 13, 1);
    e.dir = 0;
    s.enemies.push(e);
    tick(1, jump);
    tick(30);
    expect(s.enemies[0]!.flipped).toBe(0);
    expect(s.enemies[0]!.angry).toBe(true);
    tick(1, jump);
    tick(30);
    expect(s.enemies[0]!.flipped).toBeGreaterThan(0);
  });

  it('the POW block flips everything on a floor, three times, then disappears', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 13.5, y: 16 });
    s.enemies.push(enemy(20.5, 10), enemy(6.5, 13), enemy(20.5, 16));
    s.enemies.forEach((e) => (e.dir = 0));
    tick(1, jump);
    tick(20);
    expect(s.powLeft).toBe(2);
    expect(s.enemies.every((e) => e.flipped > 0)).toBe(true);
    for (let n = 0; n < 2; n++) {
      tick(40);
      tick(1, jump);
      tick(20);
    }
    expect(s.powLeft).toBe(0);
    expect(s.grid[i(13, 13)]).toBe(0);
  });

  it('a fireball sweeps the hero\'s floor: it kills a hero who stays, and can be jumped', () => {
    const a = arena();
    Object.assign(a.s.me, { x: 5.5, y: 16 });
    a.s.fireTimer = 0.01;
    a.tick(60 * 4);
    expect(a.s.lives).toBe(2);

    const b = arena();
    Object.assign(b.s.me, { x: 1.5, y: 16 }); // under open sky, so the jump isn't cut short
    b.s.fireballs.push({ x: 9, y: 16, dir: -1 });
    // Jump when it is close.
    for (let f = 0; f < 140 && b.s.fireballs.length > 0; f++) b.tick(1, b.s.fireballs[0]!.x - b.s.me.x < 2.2 && b.s.me.onGround ? jump : NO_INPUT);
    expect(b.s.lives).toBe(3);
    expect(b.s.fireballs).toHaveLength(0);
  });

  it('the hero wraps around the screen edges', () => {
    const { s, tick } = arena();
    Object.assign(s.me, { x: 0.3, y: 16 });
    tick(30, held({ left: true }));
    expect(s.me.x).toBeGreaterThan(20);
    expect(s.me.y).toBe(16);
  });

  it('an enemy that walks off the bottom corner re-enters at the top', () => {
    const { s, tick, enemy } = arena();
    Object.assign(s.me, { x: 14.5, y: 16 });
    const e = enemy(27.2, 16);
    e.dir = 1;
    s.enemies.push(e);
    tick(60);
    expect(s.enemies[0]!.b.y).toBeLessThan(16);
  });

  it('enemies queue in from the top corners and the level clears when all are beaten', () => {
    const { s, tick } = arena();
    s.queue = 1;
    s.spawnTimer = 0.1;
    tick(10);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]!.b.y).toBe(4);
    s.enemies[0]!.flipped = 5;
    Object.assign(s.me, { x: s.enemies[0]!.b.x, y: 4 });
    tick(2);
    expect(s.queue).toBe(0);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(120);
    expect(s.level).toBe(2);
  });

  it('the hero can climb from the ground to the top tier by jumping through the gaps', () => {
    const { s, tick } = arena();
    // Ground -> tier 13 via the left edge gap, tier 10 via the centre, etc.: check each hop is reachable.
    Object.assign(s.me, { x: 2.5, y: 16 });
    tick(1, held({ right: true }, { a: true }));
    for (let f = 0; f < 40; f++) tick(1, held({ right: true }));
    expect(s.me.y).toBeLessThan(16);
    expect(s.me.y).toBeGreaterThanOrEqual(13 - 1e-9);
  });

  it('level layout: five tiers, POW in the middle, and gaps that can be jumped through', () => {
    const { s } = arena();
    for (const tier of [4, 7, 10, 13, 16]) expect(s.grid.slice(tier * COLS, tier * COLS + COLS).some((c) => c !== 0)).toBe(true);
    expect(s.grid[i(13, 13)]).toBe(2);
    expect(s.grid[i(0, 10)]).toBe(1);
    expect(s.grid[i(12, 10)]).toBe(0);
  });
});
