import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import vineClimber, { type VineState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 50 && f % 200 < 100 }, { a: f % 37 === 0 });

describe('vine-climber', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(vineClimber, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(vineClimber, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(vineClimber, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(vineClimber, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(vineClimber, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(vineClimber, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(vineClimber, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = vineClimber.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      vineClimber.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) vineClimber.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function vines() {
  const rng = createRng(5);
  const s: VineState = vineClimber.init({ rng, hiScore: 0 });
  s.foes = [];
  s.fruit = [];
  s.spawnTimer = 1e9;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) vineClimber.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}

describe('vine-climber rules', () => {
  it('climbs a vine with Up / Down and stands on its top', () => {
    const { s, tick } = vines();
    Object.assign(s.me, { x: 2.5, y: 16, onGround: true });
    tick(20, held({ up: true }));
    expect(s.me.climbing).toBe(true);
    expect(s.me.y).toBeLessThan(16);
    tick(220, held({ up: true }));
    expect(s.me.y).toBe(3);
    expect(s.me.onGround).toBe(true);
  });

  it('can jump from one vine to the next (they are three tiles apart)', () => {
    const { s, tick } = vines();
    Object.assign(s.me, { x: 2.5, y: 8.5, onGround: false, climbing: true });
    tick(1, held({ up: true }));
    // Jump toward the next vine, then grab it.
    tick(1, held({ right: true }, { a: true }));
    let grabbed = false;
    for (let f = 0; f < 60 && !grabbed; f++) {
      tick(1, held({ right: s.me.x < 5.4, up: true }));
      grabbed = s.me.climbing && Math.abs(s.me.x - 5.5) < 0.01;
    }
    expect(grabbed).toBe(true);
  });

  it('touching hanging fruit shakes it loose (100); loose fruit flattens a snapjaw below (400)', () => {
    const { s, tick } = vines();
    s.fruit.push({ x: 5.5, y: 9.5, vy: 0, state: 'hang' });
    s.foes.push({ x: 5.5, y: 13, vine: true, dir: 0 });
    Object.assign(s.me, { x: 5.5, y: 10, onGround: false, climbing: true });
    tick(2);
    expect(s.fruit[0]!.state).toBe('fall');
    expect(s.score).toBe(100);
    tick(60);
    expect(s.foes).toHaveLength(0);
    expect(s.score).toBe(500);
  });

  it('a snapjaw on your vine costs a life; they climb up and down their vine', () => {
    const a = vines();
    a.s.foes.push({ x: 2.5, y: 9, vine: true, dir: 1 });
    Object.assign(a.s.me, { x: 2.5, y: 9.3, onGround: false, climbing: true });
    a.tick(2);
    expect(a.s.lives).toBe(2);

    const b = vines();
    Object.assign(b.s.me, { x: 26.5, y: 16 });
    b.s.foes.push({ x: 8.5, y: 5, vine: true, dir: 1 });
    b.tick(60 * 4);
    expect(b.s.foes[0]!.y).toBeGreaterThan(10);
    b.tick(60 * 10);
    expect(b.s.foes[0]!.y).toBeLessThanOrEqual(16);
    expect(b.s.foes[0]!.y).toBeGreaterThanOrEqual(4);
  });

  it('island snapjaws patrol their platform', () => {
    const { s, tick } = vines();
    Object.assign(s.me, { x: 1.5, y: 16 });
    s.foes.push({ x: 20.5, y: 3, vine: false, dir: 1 });
    tick(60 * 15);
    expect(s.foes[0]!.x).toBeGreaterThanOrEqual(16.5);
    expect(s.foes[0]!.x).toBeLessThanOrEqual(27.5);
    expect(s.foes[0]!.y).toBe(3);
  });

  it('snapjaws drop in from the top over time', () => {
    const { s, tick } = vines();
    Object.assign(s.me, { x: 1.5, y: 16 });
    s.spawnTimer = 0.1;
    tick(30);
    expect(s.foes.length).toBe(1);
  });

  it('reaching the key banks the bonus and starts the next level; running the bonus out costs a life', () => {
    const a = vines();
    a.s.bonus = 2000;
    Object.assign(a.s.me, { x: 25.5, y: 3, onGround: true });
    a.tick(2);
    expect(a.s.score).toBe(2000 + 1000);
    a.tick(150);
    expect(a.s.level).toBe(2);

    const b = vines();
    b.s.bonus = 150;
    b.tick(60 * 3);
    expect(b.s.lives).toBe(2);
  });

  it('every level hangs four fruit on four different vines', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = vineClimber.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.fruit).toHaveLength(4);
      expect(new Set(s.fruit.map((f) => f.x)).size).toBe(4);
      for (const f of s.fruit) expect([2.5, 5.5, 8.5, 11.5, 14.5, 17.5, 20.5, 23.5]).toContain(f.x);
    }
  });
});
