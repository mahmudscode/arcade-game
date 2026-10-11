import { onTrack, type CircuitState } from '../_shared/circuit';
import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import sprintCircuit from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 130, a: f % 4 !== 0 });

describe('sprint-circuit', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(sprintCircuit, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(sprintCircuit, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(sprintCircuit, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(sprintCircuit, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(sprintCircuit, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(sprintCircuit, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(sprintCircuit, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = sprintCircuit.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      sprintCircuit.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) sprintCircuit.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});
const GAME = sprintCircuit;
function race() {
  const rng = createRng(5);
  const s: CircuitState = GAME.init({ rng, hiScore: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}

describe('circuit rules', () => {
  it('cars cannot move during the countdown, then accelerate', () => {
    const { s, tick } = race();
    tick(60, held({ a: true }));
    expect(Math.hypot(s.cars[0]!.vx, s.cars[0]!.vy)).toBe(0);
    tick(240, held({ a: true }));
    expect(Math.hypot(s.cars[0]!.vx, s.cars[0]!.vy)).toBeGreaterThan(50);
  });

  it('the track is a closed loop wide enough for the start grid', () => {
    const { s } = race();
    expect(s.track).toHaveLength(48);
    for (const c of s.cars) expect(onTrack(s.track, c)).toBe(true);
  });

  it('driving off the track slows you down', () => {
    const { s, tick } = race();
    tick(200);
    const me = s.cars[0]!;
    Object.assign(me, { x: 6, y: 560, vx: 0, vy: 0, a: 0 });
    tick(120, held({ a: true }));
    expect(Math.hypot(me.vx, me.vy)).toBeLessThan(120);
  });

  it('a wrench raises your upgrade level', () => {
    const { s, tick } = race();
    tick(200);
    s.wrenches[0] = { x: s.cars[0]!.x, y: s.cars[0]!.y, taken: false };
    tick(1);
    expect(s.upgrades).toBe(1);
  });

  it('finishing outside the qualifying places costs a life', () => {
    const { s, tick } = race();
    tick(200);
    for (let i = 1; i < s.cars.length; i++) s.cars[i]!.fin = i;
    s.cars[0]!.fin = 4;
    tick(2);
    expect(s.qualified).toBe(false);
    tick(200);
    expect(s.lives).toBe(2);
  });

  it('finishing in the top places advances to the next race', () => {
    const { s, tick } = race();
    tick(200);
    s.cars[0]!.fin = 1;
    tick(2);
    expect(s.qualified).toBe(true);
    tick(200);
    expect(s.level).toBe(2);
  });
});
