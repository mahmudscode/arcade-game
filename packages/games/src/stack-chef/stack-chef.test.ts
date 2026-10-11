import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import stackChef, { type ChefState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 240 < 60, right: f % 240 >= 120 && f % 240 < 180, up: f % 240 >= 60 && f % 240 < 120, down: f % 240 >= 180 }, { a: f % 90 === 0 });

describe('stack-chef', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(stackChef, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(stackChef, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(stackChef, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(stackChef, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(stackChef, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(stackChef, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(stackChef, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = stackChef.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      stackChef.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) stackChef.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;

function kitchen() {
  const rng = createRng(5);
  const s: ChefState = stackChef.init({ rng, hiScore: 0 });
  s.foes = [];
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) stackChef.update(s, input, TICK, { rng, emit: () => undefined }); };
  const layer = (burger: number, k: number) => s.layers.find((l) => l.burger === burger && l.k === k)!;
  const foe = (x: number, y: number, kind = 0) => ({ b: { x, y, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 }, kind, stun: 0, dead: 0, think: 0, dir: 0, up: false, down: false });
  return { s, tick, layer, foe };
}

describe('stack-chef rules', () => {
  it('the chef walks, climbs, and cannot jump', () => {
    const { s, tick } = kitchen();
    tick(30, held({ left: true }));
    expect(s.me.x).toBeLessThan(12);
    tick(1, held({}, { a: false, b: true }));
    expect(s.me.y).toBe(15);
    Object.assign(s.me, { x: 7.5, y: 15 });
    tick(30, held({ up: true }));
    expect(s.me.climbing).toBe(true);
    expect(s.me.y).toBeLessThan(15);
  });

  it('walking over every segment of a layer drops it one floor, and the whole stack below drops in a chain', () => {
    const { s, tick, layer } = kitchen();
    Object.assign(s.me, { x: 2.5, y: 3, onGround: true });
    tick(60, held({ right: true }));
    tick(150); // four layers fall one after another
    expect(layer(0, 3).state).toBe('done'); // the bottom bun reached the tray
    expect(s.stack[0]).toBe(1);
    expect(layer(0, 2).slot).toBe(3);
    expect(layer(0, 1).slot).toBe(2);
    expect(layer(0, 0).slot).toBe(1);
    expect(['rest', 'fall']).toContain(layer(0, 0).state);
    expect(s.score).toBeGreaterThanOrEqual(40 + 100);
  });

  it('a partly trodden layer stays put, and its segments reset after landing', () => {
    const { s, tick, layer } = kitchen();
    Object.assign(s.me, { x: 2.5, y: 3, onGround: true });
    tick(25, held({ right: true })); // across about half the layer
    tick(5);
    expect(layer(0, 0).state).toBe('rest');
    expect(layer(0, 0).stepped.some(Boolean)).toBe(true);
    expect(layer(0, 0).stepped.every(Boolean)).toBe(false);
  });

  it('four layers on a tray complete the burger (1000); all four burgers clear the level', () => {
    const { s, tick } = kitchen();
    s.stack = [4, 4, 4, 3];
    for (const l of s.layers) if (l.burger < 3) l.state = 'done';
    const last = s.layers.find((l) => l.burger === 3 && l.k === 3)!;
    s.layers.filter((l) => l.burger === 3 && l.k < 3).forEach((l) => (l.state = 'done'));
    last.state = 'fall';
    last.slot = 3;
    last.y = 12;
    tick(60);
    expect(s.stack[3]).toBe(4);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(1000 + 2000);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.stack).toEqual([0, 0, 0, 0]);
  });

  it('a layer falling on a foe squashes it (500); the foe returns later', () => {
    const { s, tick, layer, foe } = kitchen();
    Object.assign(s.me, { x: 20.5, y: 15 });
    s.foes.push(foe(5.5, 6));
    layer(0, 0).stepped = [true, true, true, true];
    layer(0, 0).state = 'fall';
    tick(60);
    expect(s.foes[0]!.dead).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(500);
    tick(60 * 7);
    expect(s.foes[0]!.dead).toBeLessThanOrEqual(0);
    expect(s.foes[0]!.b.y).toBeLessThanOrEqual(6); // back in play near the top, already chasing
  });

  it('pepper stuns foes ahead on the same floor, harmless while stunned; five uses per life', () => {
    const { s, tick, foe } = kitchen();
    Object.assign(s.me, { x: 5.5, y: 15, face: 1 });
    s.foes.push(foe(7.5, 15), foe(7.5, 12), foe(2.5, 15));
    tick(1, held({}, { a: true }));
    expect(s.foes[0]!.stun).toBeGreaterThan(3);
    expect(s.foes[1]!.stun).toBe(0); // other floor
    expect(s.foes[2]!.stun).toBe(0); // behind
    expect(s.me.pepper).toBe(4);
    Object.assign(s.me, { x: 7.5 });
    tick(10);
    expect(s.lives).toBe(3); // standing on a stunned foe is safe
  });

  it('foes find the ladders and chase the chef across floors; touching one costs a life', () => {
    const { s, tick, foe } = kitchen();
    Object.assign(s.me, { x: 4.5, y: 15 });
    s.foes.push(foe(4.5, 12));
    tick(60 * 15);
    expect(s.lives).toBeLessThan(3);
  });

  it('no pepper left means nothing happens', () => {
    const { s, tick, foe } = kitchen();
    s.me.pepper = 0;
    Object.assign(s.me, { x: 5.5, y: 15, face: 1 });
    s.foes.push(foe(7.5, 15));
    tick(1, held({}, { a: true }));
    expect(s.foes[0]!.stun).toBe(0);
  });

  it('the level has four burgers of four layers, trays on the bottom floor and ladders between every pair of floors', () => {
    const { s } = kitchen();
    expect(s.layers).toHaveLength(16);
    for (const bx of [3, 9, 15, 21]) expect(s.layers.some((l) => l.state === 'rest' && l.k === 0)).toBe(true);
    for (const f of [3, 6, 9, 12, 15]) expect(s.grid.slice(f * COLS, f * COLS + COLS).filter((c) => c === 1).length).toBeGreaterThanOrEqual(20);
    for (const col of [1, 8, 14, 20, 26]) expect(s.grid[i(col, 4)]).toBe(2);
    // Burgers never sit over a ladder.
    for (const bx of [3, 9, 15, 21]) for (let x = bx; x < bx + 4; x++) expect(s.grid[i(x, 4)]).not.toBe(2);
  });
});
