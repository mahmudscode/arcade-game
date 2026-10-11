import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import sailorSlugger, { type SlugState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 150 }, { a: f % 30 === 0 });

describe('sailor-slugger', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(sailorSlugger, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(sailorSlugger, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(sailorSlugger, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(sailorSlugger, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(sailorSlugger, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(sailorSlugger, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(sailorSlugger, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = sailorSlugger.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      sailorSlugger.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) sailorSlugger.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;

function dock() {
  const rng = createRng(5);
  const s: SlugState = sailorSlugger.init({ rng, hiScore: 0 });
  s.hearts = [];
  s.heartTimer = 1e9;
  s.spinachTimer = 1e9;
  s.brute.gone = 99; // out of the way unless a test needs him
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) sailorSlugger.update(s, input, TICK, { rng, emit: () => undefined }); };
  const bring = (x: number, y: number) => {
    s.brute.gone = 0;
    s.brute.b.x = x;
    s.brute.b.y = y;
    s.brute.b.onGround = true;
    s.brute.think = 99;
  };
  return { s, tick, bring };
}
const punch = held({}, { a: true });

describe('sailor-slugger rules', () => {
  it('the sailor walks, climbs the stairs, and cannot jump', () => {
    const { s, tick } = dock();
    tick(1, held({}, { b: true, up: false }));
    expect(s.me.y).toBe(15);
    Object.assign(s.me, { x: 6.5, y: 15, onGround: true });
    tick(30, held({ up: true }));
    expect(s.me.climbing).toBe(true);
    expect(s.me.y).toBeLessThan(15);
    tick(100, held({ up: true }));
    expect(s.me.y).toBe(10);
  });

  it('hearts drift down; standing under one catches it (100 x round, up to 5x)', () => {
    const { s, tick } = dock();
    s.hearts.push({ x: 2.5, y: 12 });
    Object.assign(s.me, { x: 2.5, y: 15 });
    tick(60);
    expect(s.caught).toBe(1);
    expect(s.score).toBe(100);
    expect(s.hearts).toHaveLength(0);
  });

  it('hearts that reach the sea are lost; three lost costs a life and resets the count', () => {
    const { s, tick } = dock();
    Object.assign(s.me, { x: 26.5, y: 5 });
    for (let k = 0; k < 3; k++) s.hearts.push({ x: 10.5 + k * 3, y: 15.9 });
    tick(10);
    expect(s.lives).toBe(2);
    expect(s.lost).toBe(0);
    const t = dock();
    Object.assign(t.s.me, { x: 26.5, y: 5 });
    t.s.hearts.push({ x: 10.5, y: 15.9 });
    t.tick(10);
    expect(t.s.lost).toBe(1);
    expect(t.s.lives).toBe(3);
  });

  it('a punch stuns the bruiser for a moment and pushes him back, and a stunned bruiser is harmless', () => {
    const { s, tick, bring } = dock();
    Object.assign(s.me, { x: 5.5, y: 15, face: 1 });
    bring(6.5, 15);
    tick(1, punch);
    expect(s.brute.stun).toBeGreaterThan(1);
    expect(s.brute.b.x).toBeGreaterThan(6.5);
    tick(30);
    expect(s.lives).toBe(3);
    tick(60 * 3);
    expect(s.brute.stun).toBeLessThanOrEqual(0);
  });

  it('touching the bruiser costs a life', () => {
    const { s, tick, bring } = dock();
    Object.assign(s.me, { x: 5.5, y: 15 });
    bring(5.8, 15);
    tick(2);
    expect(s.lives).toBe(2);
  });

  it('spinach powers up the sailor; a powered punch (or touch) sends the bruiser into the sea for 1000, and he returns later', () => {
    const { s, tick, bring } = dock();
    s.spinach = { x: 3.5, y: 15, life: 5 };
    Object.assign(s.me, { x: 3.5, y: 15, face: 1 });
    tick(2);
    expect(s.me.power).toBeGreaterThan(5);
    bring(4.5, 15);
    tick(1, punch);
    expect(s.brute.gone).toBeGreaterThan(0);
    expect(s.score).toBe(1000);
    tick(60 * 9);
    expect(s.brute.gone).toBeLessThanOrEqual(0);
    expect(s.brute.b.y).toBe(5);
  });

  it('the bruiser climbs the stairs to reach a sailor on another floor', () => {
    const { s, tick, bring } = dock();
    Object.assign(s.me, { x: 14.5, y: 15 });
    bring(14.5, 5);
    s.brute.think = 0;
    let yAtKill = 99;
    for (let f = 0; f < 60 * 30 && s.lives === 3; f++) {
      tick(1);
      yAtKill = s.brute.b.y;
    }
    expect(s.lives).toBeLessThan(3);
    expect(yAtKill).toBeGreaterThanOrEqual(14.9);
  });

  it('catching enough hearts clears the round and starts a faster one', () => {
    const { s, tick } = dock();
    s.caught = 15;
    s.hearts.push({ x: 2.5, y: 13 });
    Object.assign(s.me, { x: 2.5, y: 15 });
    tick(60);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.caught).toBe(0);
  });

  it('never more hearts in flight than the round still needs, and lost hearts get replaced', () => {
    const { s, tick } = dock();
    s.heartTimer = 0.01;
    Object.assign(s.me, { x: 26.5, y: 5 });
    s.caught = 14;
    let sawFlight = 0;
    for (let f = 0; f < 60 * 12; f++) {
      tick(1);
      sawFlight = Math.max(sawFlight, s.hearts.length);
      expect(s.caught + s.hearts.length).toBeLessThanOrEqual(16);
    }
    expect(sawFlight).toBeGreaterThanOrEqual(1);
    expect(sawFlight).toBeLessThanOrEqual(2);
  });

  it('floors and stairs are laid out as designed', () => {
    const { s } = dock();
    for (const f of [5, 10, 15]) expect(s.grid[i(10, f)]).toBe(1);
    expect(s.grid[i(3, 5)]).toBe(2);
    expect(s.grid[i(22, 8)]).toBe(2);
    expect(s.grid[i(6, 10)]).toBe(2);
    expect(s.grid[i(24, 12)]).toBe(2);
  });
});
