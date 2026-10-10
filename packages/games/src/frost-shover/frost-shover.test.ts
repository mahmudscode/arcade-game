import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import frostShover, { type ShoverState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 50 && f % 200 < 100, down: f % 200 >= 150 }, { a: f % 10 === 0 });

describe('frost-shover', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(frostShover, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(frostShover, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(frostShover, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(frostShover, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(frostShover, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(frostShover, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(frostShover, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = frostShover.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      frostShover.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) frostShover.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 15;
const i = (x: number, y: number) => y * COLS + x;

function arena() {
  const rng = createRng(5);
  const s: ShoverState = frostShover.init({ rng, hiScore: 0 });
  s.grid = s.grid.map((_, k) => {
    const x = k % COLS;
    const y = Math.floor(k / COLS);
    return x === 0 || y === 0 || x === COLS - 1 || y === 12 ? 3 : 0;
  });
  s.enemies = [];
  s.sliders = [];
  s.waiting = 5;
  s.spawnTimer = 1e9;
  Object.assign(s.me, { tx: 7, ty: 6, dx: 0, dy: 0, p: 0, invuln: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) frostShover.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}
const enemy = (x: number, y: number, stun = 0) => ({ tx: x, ty: y, dx: 0, dy: 0, p: 0, stun, chew: 0, cx: 0, cy: 0 });

describe('frost-shover rules', () => {
  it('pushing an ice block slides it until something stops it', () => {
    const { s, tick } = arena();
    s.grid[i(8, 6)] = 1;
    tick(30, held({ right: true }));
    expect(s.grid[i(8, 6)]).toBe(0);
    expect(s.grid[i(13, 6)]).toBe(1);
  });

  it('a sliding block crushes enemies in its path (400)', () => {
    const { s, tick } = arena();
    s.grid[i(8, 6)] = 1;
    s.enemies.push(enemy(11, 6, 99));
    tick(30, held({ right: true }));
    expect(s.enemies).toHaveLength(0);
    expect(s.score).toBe(400);
  });

  it('one block crushing two enemies pays more for the second', () => {
    const { s, tick } = arena();
    s.grid[i(8, 6)] = 1;
    s.enemies.push(enemy(10, 6, 99), enemy(12, 6, 99));
    tick(30, held({ right: true }));
    expect(s.score).toBe(400 + 800);
  });

  it('a blocked ice block crumbles (30); a gem block does not', () => {
    const a = arena();
    a.s.grid[i(8, 6)] = 1;
    a.s.grid[i(9, 6)] = 1;
    a.tick(10, held({ right: true }));
    expect(a.s.grid[i(8, 6)]).toBe(0);
    expect(a.s.score).toBe(30);

    const b = arena();
    b.s.grid[i(8, 6)] = 2;
    b.s.grid[i(9, 6)] = 1;
    b.tick(10, held({ right: true }));
    expect(b.s.grid[i(8, 6)]).toBe(2);
    expect(b.s.score).toBe(0);
  });

  it('lining up the three gem blocks pays 5000 and stuns the enemies', () => {
    const { s, tick } = arena();
    s.grid[i(3, 3)] = 2;
    s.grid[i(4, 3)] = 2;
    s.sliders.push({ x: 9, y: 3, dx: -1, dy: 0, p: 0, gem: true, hits: 0 });
    s.enemies.push(enemy(10, 10));
    tick(40);
    expect(s.grid[i(5, 3)]).toBe(2);
    expect(s.score).toBe(5000);
    expect(s.enemies[0]!.stun).toBeGreaterThan(0);
  });

  it('touching an enemy costs a life, but touching a stunned one defeats it (100)', () => {
    const a = arena();
    a.s.enemies.push(enemy(7, 6));
    a.tick(2);
    expect(a.s.lives).toBe(2);

    const b = arena();
    b.s.enemies.push(enemy(7, 6, 5));
    b.tick(2);
    expect(b.s.lives).toBe(3);
    expect(b.s.score).toBe(100);
    expect(b.s.enemies).toHaveLength(0);
  });

  it('an enemy boxed in by ice chews its way out', () => {
    const { s, tick } = arena();
    for (const [x, y] of [[3, 2], [3, 4], [2, 3], [4, 3]] as const) s.grid[i(x, y)] = 1;
    s.enemies.push(enemy(3, 3));
    tick(300);
    expect([[3, 2], [3, 4], [2, 3], [4, 3]].some(([x, y]) => s.grid[i(x!, y!)] === 0)).toBe(true);
  });

  it('clearing every enemy advances the level', () => {
    const { s, tick } = arena();
    s.waiting = 0;
    tick(200);
    expect(s.level).toBe(2);
    expect(s.waiting).toBeGreaterThan(0);
  });

  it('the player cannot walk through ice or the border', () => {
    const { s, tick } = arena();
    s.grid[i(8, 6)] = 2; // an immovable gem next to a wall of ice
    s.grid[i(9, 6)] = 1;
    tick(60, held({ right: true }));
    expect(s.me.tx).toBe(7);
    tick(400, held({ up: true }));
    expect(s.me.ty).toBeGreaterThanOrEqual(1);
  });
});
