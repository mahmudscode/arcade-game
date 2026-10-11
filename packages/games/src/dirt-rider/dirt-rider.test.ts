import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import dirtRider, { type RiderState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ a: true, up: f % 90 === 40, down: f % 90 === 70 }, { up: f % 97 === 0, down: f % 131 === 0 });

describe('dirt-rider', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(dirtRider, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(dirtRider, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(dirtRider, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(dirtRider, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(dirtRider, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(dirtRider, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(dirtRider, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = dirtRider.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      dirtRider.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) dirtRider.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function dirt() {
  const rng = createRng(5);
  const s: RiderState = dirtRider.init({ rng, hiScore: 0 });
  s.ramps = [];
  s.hurdles = [];
  s.mud = [];
  s.strips = [];
  s.rivals = [];
  s.limit = 1000;
  s.length = 5000;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) dirtRider.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}
const gas = held({ a: true });
const turbo = held({ b: true });

describe('dirt-rider rules', () => {
  it('the throttle builds speed up to a limit; coasting slows you down', () => {
    const { s, tick } = dirt();
    tick(180, gas);
    expect(s.bike.v).toBeGreaterThan(55);
    expect(s.bike.v).toBeLessThanOrEqual(62);
    const v = s.bike.v;
    tick(60);
    expect(s.bike.v).toBeLessThan(v - 10);
    expect(s.bike.x).toBeGreaterThan(100);
  });

  it('turbo is faster but heats the engine quickly; an overheated engine cuts out until it cools', () => {
    const { s, tick } = dirt();
    tick(120, turbo);
    expect(s.bike.v).toBeGreaterThan(70);
    for (let f = 0; f < 60 * 5 && s.bike.stalled <= 0; f++) tick(1, turbo);
    expect(s.bike.stalled).toBeGreaterThan(0);
    expect(s.bike.heat).toBe(100);
    tick(60, turbo);
    expect(s.bike.v).toBeLessThan(80); // the throttle does nothing while stalled
    tick(60 * 3);
    expect(s.bike.stalled).toBeLessThanOrEqual(0);
    expect(s.bike.heat).toBeLessThanOrEqual(30);
  });

  it('plain throttle heats the engine slowly and coasting cools it', () => {
    const { s, tick } = dirt();
    tick(60 * 6, gas);
    expect(s.bike.heat).toBeGreaterThan(30);
    expect(s.bike.heat).toBeLessThan(80);
    const h = s.bike.heat;
    tick(60 * 3);
    expect(s.bike.heat).toBeLessThan(h - 20);
  });

  it('Up and Down change lane on the ground (three lanes, no more)', () => {
    const { s, tick } = dirt();
    tick(1, held({}, { up: true }));
    tick(1, held({}, { up: true }));
    expect(s.bike.lane).toBe(0);
    tick(1, held({}, { down: true }));
    tick(1, held({}, { down: true }));
    tick(1, held({}, { down: true }));
    expect(s.bike.lane).toBe(2);
    tick(30);
    expect(s.bike.laneY).toBe(2);
  });

  it('a ramp launches you; a level landing is clean (50), nose-up or nose-down crashes, and a big jump needs correcting', () => {
    const jump = (h: 1 | 2, v: number, pitchFor: (airTime: number) => Partial<Input['held']>) => {
      const { s, tick } = dirt();
      s.ramps.push({ x: 200, h });
      s.bike.x = 150;
      s.bike.v = v;
      let air = 0;
      let airborne = false;
      let crashed = false;
      for (let f = 0; f < 300; f++) {
        tick(1, held({ a: true, ...(airborne ? pitchFor(air) : {}) }));
        if (s.bike.z > 0) {
          airborne = true;
          air += TICK;
        }
        if (s.bike.crash > 0) crashed = true;
      }
      return { s, airborne, crashed };
    };
    const small = jump(1, 55, () => ({}));
    expect(small.airborne).toBe(true);
    expect(small.crashed).toBe(false);
    expect(small.s.score).toBeGreaterThanOrEqual(50);
    expect(jump(1, 55, () => ({ up: true })).crashed).toBe(true); // nose up
    expect(jump(1, 55, () => ({ down: true })).crashed).toBe(true); // nose down
    // A big jump left alone ends nose-high; a brief tap of Down fixes it.
    expect(jump(2, 60, () => ({})).crashed).toBe(true);
    expect(jump(2, 60, (t) => ({ down: t < 0.33 })).crashed).toBe(false);
  });

  it('you cannot change lanes in mid-air', () => {
    const { s, tick } = dirt();
    s.bike.z = 3;
    s.bike.vz = 5;
    tick(1, held({}, { up: true }));
    expect(s.bike.lane).toBe(1);
  });

  it('hurdles crash you in their lane (not in the next), and a crash costs a moment and your speed', () => {
    const a = dirt();
    a.s.hurdles.push({ x: 120, lane: 1 });
    a.s.bike.x = 100;
    a.s.bike.v = 50;
    a.tick(60, gas);
    expect(a.s.bike.crash).toBeGreaterThan(0);
    expect(a.s.bike.v).toBe(0);
    a.tick(60 * 2);
    expect(a.s.bike.crash).toBeLessThanOrEqual(0);
    a.tick(60, gas);
    expect(a.s.bike.v).toBeGreaterThan(10);

    const b = dirt();
    b.s.hurdles.push({ x: 120, lane: 0 });
    b.s.bike.x = 100;
    b.s.bike.v = 50;
    b.tick(60, gas);
    expect(b.s.bike.crash).toBe(0);
  });

  it('mud slows you in its lane; speed strips boost (25), cooling strips cool (25)', () => {
    const mud = dirt();
    mud.s.mud.push({ x0: 100, x1: 200, lane: 1 });
    mud.s.bike.x = 90;
    mud.s.bike.v = 55;
    mud.tick(30, gas);
    expect(mud.s.bike.v).toBeLessThanOrEqual(22.5);

    const boost = dirt();
    boost.s.strips.push({ x: 110, lane: 1, kind: 'speed' });
    boost.s.bike.x = 100;
    boost.s.bike.v = 40;
    boost.tick(60, gas);
    expect(boost.s.bike.v).toBeGreaterThan(55);
    expect(boost.s.score).toBeGreaterThanOrEqual(25);

    const cool = dirt();
    cool.s.strips.push({ x: 110, lane: 1, kind: 'cool' });
    cool.s.bike.x = 100;
    cool.s.bike.v = 40;
    cool.s.bike.heat = 70;
    cool.tick(30, gas);
    expect(cool.s.bike.heat).toBeLessThan(50);
  });

  it('running into the back of a rival in your lane knocks your speed back', () => {
    const { s, tick } = dirt();
    s.rivals.push({ x: 140, lane: 1, v: 30 });
    s.bike.x = 100;
    s.bike.v = 60;
    tick(120, gas);
    expect(s.bike.v).toBeLessThan(55);
  });

  it('crossing the finish line before time runs out banks a time bonus and starts a longer race', () => {
    const { s, tick } = dirt();
    s.length = 300;
    s.bike.x = 280;
    s.bike.v = 60;
    s.time = 5;
    s.limit = 40;
    tick(60, gas);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThan(2000);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.length).toBeGreaterThan(3000);
  });

  it('running out of time costs a life', () => {
    const { s, tick } = dirt();
    s.limit = 5;
    tick(60 * 6, gas);
    expect(s.lives).toBe(2);
  });

  it('every track has ramps, hurdles, mud and strips, rivals, and a time limit that is possible to beat', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = dirtRider.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.ramps.length).toBeGreaterThan(2);
      expect(s.hurdles.length + s.mud.length + s.strips.length).toBeGreaterThan(8);
      expect(s.rivals.length).toBeGreaterThanOrEqual(3);
      expect(s.limit * MAX).toBeGreaterThan(s.length * 1.4);
    }
  });
});
const MAX = 62;
