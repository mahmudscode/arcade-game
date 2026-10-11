import { roadCentre, type VRoadState } from '../_shared/vroad';
import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import bounceBuggy from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 300 < 60, right: f % 300 >= 150 && f % 300 < 210, up: f % 5 === 0, a: f % 3 === 0 }, { b: f % 150 === 0, a: f % 40 === 0 });

describe('bounce-buggy', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(bounceBuggy, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(bounceBuggy, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(bounceBuggy, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(bounceBuggy, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(bounceBuggy, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(bounceBuggy, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(bounceBuggy, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = bounceBuggy.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      bounceBuggy.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) bounceBuggy.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});
const GAME = bounceBuggy;
const CFG_MODE: string = 'bump';
function drive() {
  const rng = createRng(5);
  const s: VRoadState = GAME.init({ rng, hiScore: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}
const rival = (kind: string, d: number, off = 0, v = 0) => ({ kind, d, off, v, hp: kind === 'lord' ? 99 : 1, shoved: 99 }) as never;

describe('vertical road rules', () => {
  it('the car advances and scores distance', () => {
    const { s, tick } = drive();
    s.invuln = 99;
    tick(120);
    expect(s.dist).toBeGreaterThan(300);
    expect(s.score).toBeGreaterThan(0);
  });

  it('leaving the road wrecks the car and costs a life', () => {
    const { s, tick } = drive();
    s.invuln = 0;
    s.z = 0;
    s.x = 20;
    tick(80);
    expect(s.lives).toBe(2);
    expect(s.crash + s.invuln).toBeGreaterThan(0);
  });

  it('the car respawns on the road with brief protection', () => {
    const { s, tick } = drive();
    s.invuln = 0;
    s.x = 20;
    tick(80);
    tick(100);
    expect(s.crash).toBe(0);
    expect(s.invuln).toBeGreaterThan(0);
    expect(s.lives).toBe(2);
  });

  // Keep a rival at a fixed distance ahead, lined up with the car (bullets fly straight up the screen).
  const hold = (s: VRoadState, r: { d: number; off: number }, ahead: number) => {
    r.d = s.dist + ahead;
    r.off = s.x - roadCentre(s, r.d);
  };

  it.runIf(CFG_MODE === 'spy')('the machine gun destroys a hostile car ahead; a road lord shrugs it off', () => {
    const blade = drive();
    blade.s.invuln = 99;
    blade.s.nextSpawn = 99;
    blade.s.rivals = [rival('blade', 0, 0)];
    for (let k = 0; k < 40; k++) {
      hold(blade.s, blade.s.rivals[0] ?? { d: 0, off: 0 }, 200);
      blade.tick(1, held({ a: true }));
    }
    expect(blade.s.rivals.some((r) => r.kind === 'blade')).toBe(false);
    const lord = drive();
    lord.s.invuln = 99;
    lord.s.nextSpawn = 99;
    lord.s.rivals = [rival('lord', 0, 0)];
    for (let k = 0; k < 40; k++) {
      hold(lord.s, lord.s.rivals[0]!, 200);
      lord.tick(1, held({ a: true }));
    }
    expect(lord.s.rivals.some((r) => r.kind === 'lord')).toBe(true);
  });

  it.runIf(CFG_MODE === 'spy')('a missile destroys a road lord', () => {
    const { s, tick } = drive();
    s.invuln = 99;
    s.nextSpawn = 99;
    s.missiles = 2;
    s.rivals = [rival('lord', 0, 0)];
    for (let k = 0; k < 40 && s.rivals.length > 0; k++) {
      hold(s, s.rivals[0]!, 250);
      tick(1, held({}, { b: k === 0 }));
    }
    expect(s.missiles).toBe(1);
    expect(s.rivals.some((r) => r.kind === 'lord')).toBe(false);
  });

  it.runIf(CFG_MODE === 'spy')('shooting a civilian jams the guns and costs points', () => {
    const { s, tick } = drive();
    s.invuln = 99;
    s.nextSpawn = 99;
    s.score = 1000;
    s.rivals = [rival('civilian', 0, 0)];
    for (let k = 0; k < 40 && s.jam === 0; k++) {
      hold(s, s.rivals[0]!, 150);
      tick(1, held({ a: true }));
    }
    expect(s.jam).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(1000);
  });

  it.runIf(CFG_MODE === 'spy')('a weapon van gives missiles', () => {
    const { s, tick } = drive();
    s.invuln = 99;
    s.nextSpawn = 99;
    s.rivals = [rival('van', s.dist + 5, 0)];
    s.x = roadCentre(s, s.dist);
    s.rivals[0]!.off = 0;
    tick(1);
    expect(s.missiles).toBeGreaterThan(0);
  });

  it.runIf(CFG_MODE === 'bump')('the buggy bounces by itself and jumps much higher when you press', () => {
    const { s, tick } = drive();
    s.invuln = 99;
    s.nextGap = 1e9;
    let low = 0;
    for (let k = 0; k < 90; k++) { tick(1); s.x = roadCentre(s, s.dist); low = Math.max(low, s.z); }
    expect(low).toBeGreaterThan(10);
    let big = 0;
    for (let k = 0; k < 90; k++) { tick(1, held({}, { a: k === 0 })); s.x = roadCentre(s, s.dist); big = Math.max(big, s.z); }
    expect(big).toBeGreaterThan(low + 40);
  });

  it.runIf(CFG_MODE === 'bump')('a grounded car over water is wrecked; a high jump clears it', () => {
    const a = drive();
    a.s.invuln = 0;
    a.s.nextGap = 1e9;
    a.s.gaps = [{ d: a.s.dist - 50, len: 200 }];
    a.s.x = roadCentre(a.s, a.s.dist);
    // Touching down in the water.
    a.s.z = 1;
    a.s.vz = -300;
    a.tick(1);
    expect(a.s.lives).toBe(2);
    const b = drive();
    b.s.invuln = 0;
    b.s.nextGap = 1e9;
    b.s.gaps = [{ d: b.s.dist + 80, len: 100 }];
    let wrecked = false;
    for (let k = 0; k < 120; k++) {
      b.s.x = roadCentre(b.s, b.s.dist);
      b.tick(1, held({}, { a: k < 3 }));
      if (b.s.crash > 0) wrecked = true;
    }
    expect(wrecked).toBe(false);
  });

  it.runIf(CFG_MODE === 'bump')('landing on a rival squashes it for points', () => {
    const { s, tick } = drive();
    s.invuln = 99;
    s.nextSpawn = 99;
    s.nextGap = 1e9;
    s.x = roadCentre(s, s.dist);
    s.z = 60;
    s.vz = -200;
    s.rivals = [rival('buggy', s.dist + 5, 0)];
    const before = s.score;
    tick(1);
    expect(s.rivals).toHaveLength(0);
    expect(s.score).toBeGreaterThan(before + 100);
  });

  it.runIf(CFG_MODE === 'bump')('shoving a rival off the road destroys it', () => {
    const { s, tick } = drive();
    s.invuln = 99;
    s.nextSpawn = 99;
    s.nextGap = 1e9;
    s.rivals = [rival('buggy', s.dist + 5, 170)];
    s.rivals[0]!.shoved = 0;
    tick(1);
    expect(s.rivals).toHaveLength(0);
  });
});
