import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import tiltTrack, { heightAt, onTrack, type TiltState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 50 && f % 200 < 100, down: f % 200 >= 150 });

describe('tilt-track', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(tiltTrack, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(tiltTrack, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(tiltTrack, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(tiltTrack, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(tiltTrack, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(tiltTrack, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect|ellipse)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = tiltTrack.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      tiltTrack.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) tiltTrack.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const N = 28;
const VOID = -999;

/** A flat 12x12 plate of track at height 5 (tiles 4..15), a one-cell path, marble in the middle. */
function plate() {
  const rng = createRng(5);
  const s: TiltState = tiltTrack.init({ rng, hiScore: 0 });
  s.h = s.h.map((_, k) => {
    const x = k % N;
    const y = Math.floor(k / N);
    return x >= 4 && x < 16 && y >= 4 && y < 16 ? 5 : VOID;
  });
  s.path = Array.from({ length: 30 }, (_, k) => ({ x: 4, y: 4 + (k % 12) })); // dummy; only used for checkpoints/progress
  s.marble = { x: 10, y: 10, vx: 0, vy: 0, fall: 0 };
  s.progress = 0;
  s.steelies = [];
  s.spawnTimer = 1e9;
  s.time = 100;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) tiltTrack.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}

describe('tilt-track rules', () => {
  it('a marble on a flat plate stays put', () => {
    const { s, tick } = plate();
    tick(120);
    expect(Math.hypot(s.marble.x - 10, s.marble.y - 10)).toBeLessThan(0.01);
  });

  it('gravity rolls it downhill, in the direction the surface falls', () => {
    const { s, tick } = plate();
    s.h = s.h.map((v, k) => (v === VOID ? v : 10 - 0.3 * (k % N)));
    tick(30);
    expect(s.marble.vx).toBeGreaterThan(1);
    expect(Math.abs(s.marble.vy)).toBeLessThan(0.05);
    expect(s.marble.x).toBeGreaterThan(10);
  });

  it('it speeds up the longer it rolls, within a speed limit', () => {
    const { s, tick } = plate();
    s.h = s.h.map((v, k) => (v === VOID ? v : 10 - 0.3 * (k % N)));
    s.marble.x = 5;
    tick(20);
    const early = Math.hypot(s.marble.vx, s.marble.vy);
    tick(30);
    const later = Math.hypot(s.marble.vx, s.marble.vy);
    expect(later).toBeGreaterThan(early);
    expect(later).toBeLessThanOrEqual(8.01);
  });

  it('the arrow keys push along the isometric screen directions', () => {
    const down = plate();
    down.tick(30, held({ down: true }));
    expect(down.s.marble.vx).toBeGreaterThan(1);
    expect(down.s.marble.vy).toBeGreaterThan(1);
    const right = plate();
    right.tick(30, held({ right: true }));
    expect(right.s.marble.vx).toBeGreaterThan(1);
    expect(right.s.marble.vy).toBeLessThan(-1);
    const up = plate();
    up.tick(30, held({ up: true }));
    expect(up.s.marble.vx).toBeLessThan(-1);
    expect(up.s.marble.vy).toBeLessThan(-1);
  });

  it('rolling off the edge costs 3 seconds and puts the marble back at the checkpoint', () => {
    const { s, tick } = plate();
    s.path[0] = { x: 6, y: 6 };
    for (let k = 0; k < 600 && s.marble.fall === 0; k++) tick(1, held({ up: true })); // push toward the plate's edge
    expect(s.marble.fall).toBeGreaterThan(0);
    const timeAtFall = s.time;
    tick(70); // no input: it falls for 0.9 s, then resets
    expect(s.marble.fall).toBe(0);
    expect(s.marble.x).toBe(6.5);
    expect(s.marble.y).toBe(6.5);
    expect(s.time).toBeLessThan(timeAtFall - 3 + 0.01);
    expect(s.time).toBeGreaterThan(timeAtFall - 3 - 1.3);
  });

  it('falls are timed, and the checkpoint advances as the marble progresses', () => {
    const { s, tick } = plate();
    s.path = Array.from({ length: 60 }, (_, k) => ({ x: 4 + (k % 10), y: 4 + Math.floor(k / 10) }));
    s.progress = 25;
    s.marble.fall = 0.5;
    s.marble.vx = 3;
    tick(40); // finishes falling, respawns
    expect(s.marble.fall).toBe(0);
    expect(s.marble.vx).toBe(0);
    expect(s.marble.x).toBe(s.path[20]!.x + 0.5);
    expect(s.marble.y).toBe(s.path[20]!.y + 0.5);
  });

  it('crossing new ground scores 10 per path cell', () => {
    const { s, tick } = plate();
    s.path = Array.from({ length: 60 }, (_, k) => ({ x: 4 + (k % 10), y: 4 + Math.floor(k / 10) }));
    s.marble.x = s.path[7]!.x + 0.5;
    s.marble.y = s.path[7]!.y + 0.5;
    tick(2);
    expect(s.progress).toBe(7);
    expect(s.score).toBe(70);
  });

  it('reaching the finish scores the time bonus and starts a longer race', () => {
    const { s, tick } = plate();
    s.path = Array.from({ length: 12 }, (_, k) => ({ x: 4 + k, y: 8 }));
    s.marble.x = 14.5;
    s.marble.y = 8.5;
    s.time = 30;
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(2900);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.time).toBeGreaterThan(20);
  });

  it('running out of time ends the race', () => {
    const { s, tick } = plate();
    s.time = 1;
    tick(90);
    expect(s.over).toBe(true);
  });

  it('a steel marble rolls in ahead, chases, and shoves the player away', () => {
    const { s, tick } = plate();
    s.path = Array.from({ length: 60 }, (_, k) => ({ x: 4 + (k % 12), y: 4 }));
    s.spawnTimer = 0.01;
    tick(3);
    expect(s.steelies).toHaveLength(1);
    s.steelies[0] = { x: 10.3, y: 10, vx: 0, vy: 0, fall: 0 };
    tick(1);
    expect(s.marble.vx).toBeLessThan(-2); // knocked away from a steelie on its right
  });

  it('a steel marble that rolls off the edge near the player pays 500', () => {
    const { s, tick } = plate();
    s.marble = { x: 5.5, y: 5.5, vx: 0, vy: 0, fall: 0 };
    s.steelies.push({ x: 3.9, y: 5.5, vx: 0, vy: 0, fall: 0.85 });
    tick(2);
    expect(s.steelies).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(500);
    expect(s.score).toBeLessThan(560); // 500 plus a little path progress
  });

  it('generated tracks are continuous, in bounds, downhill and long enough', () => {
    for (let level = 1; level <= 8; level++) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const s = tiltTrack.init({ rng: createRng(seed), hiScore: 0 });
        s.level = level;
        const t = tiltTrack.init({ rng: createRng(seed * 7 + level), hiScore: 0 });
        for (const track of [s, t]) {
          expect(track.path.length).toBeGreaterThanOrEqual(25);
          for (let k = 1; k < track.path.length; k++) {
            const a = track.path[k - 1]!;
            const b = track.path[k]!;
            expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
            expect(track.h[b.y * N + b.x]!).toBeLessThanOrEqual(track.h[a.y * N + a.x]! + 1e-9);
          }
          for (const c of track.path) {
            expect(c.x).toBeGreaterThanOrEqual(2);
            expect(c.y).toBeGreaterThanOrEqual(2);
            expect(c.x).toBeLessThan(N - 2);
            expect(c.y).toBeLessThan(N - 2);
            expect(track.h[c.y * N + c.x]).toBeGreaterThan(VOID / 2);
          }
          expect(track.time).toBeGreaterThan(track.path.length * 0.5);
        }
      }
    }
  });

  it('the surface height is continuous across tile boundaries and void off the track', () => {
    const s = tiltTrack.init({ rng: createRng(3), hiScore: 0 });
    const c = s.path[10]!;
    for (let k = 0; k < 40; k++) {
      const x = c.x + 0.5 + k * 0.05;
      const a = heightAt(s, x, c.y + 0.5);
      const b = heightAt(s, x + 0.01, c.y + 0.5);
      if (a > VOID / 2 && b > VOID / 2) expect(Math.abs(a - b)).toBeLessThan(0.05);
    }
    expect(heightAt(s, 0.5, 27.5)).toBe(VOID);
    expect(onTrack(s, c.x + 0.5, c.y + 0.5)).toBe(true);
    expect(onTrack(s, -1, 3)).toBe(false);
  });

  it('an idle marble eventually falls off a corner and the race ends', () => {
    const { status } = runHeadless(tiltTrack, { seed: 4, frames: 20000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });
});
