import { type BoxerState } from '../_shared/boxer';
import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import gloveRush from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 240 < 60, right: f % 240 >= 120 && f % 240 < 180, down: f % 300 < 30 }, { a: f % 13 === 0, b: f % 19 === 0 });

describe('glove-rush', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(gloveRush, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(gloveRush, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(gloveRush, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(gloveRush, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(gloveRush, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(gloveRush, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(gloveRush, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = gloveRush.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      gloveRush.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) gloveRush.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});
const GAME = gloveRush;

function ring() {
  const rng = createRng(5);
  const s: BoxerState = GAME.init({ rng, hiScore: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  tick(100);
  return { s, tick };
}

describe('boxer rules', () => {
  it('leaning away from the incoming glove dodges it and leaves the opponent open', () => {
    const { s, tick } = ring();
    s.foe.phase = 'wind'; s.foe.side = 1; s.foe.t = 0; s.foe.dur = 0.1; s.foe.chain = 0;
    const hp = s.hp;
    tick(8, held({ left: true }));
    expect(s.hp).toBe(hp);
    expect(s.foe.phase).toBe('open');
  });

  it('leaning the wrong way (or not at all) takes the hit', () => {
    const { s, tick } = ring();
    s.foe.phase = 'wind'; s.foe.side = 1; s.foe.t = 0; s.foe.dur = 0.1; s.foe.chain = 0;
    const hp = s.hp;
    tick(8, held({ right: true }));
    expect(s.hp).toBeLessThan(hp);
  });

  it('blocking reduces the damage', () => {
    const a = ring(); const b = ring();
    for (const r of [a, b]) { r.s.foe.phase = 'wind'; r.s.foe.side = 1; r.s.foe.t = 0; r.s.foe.dur = 0.1; r.s.foe.chain = 0; }
    a.tick(8);
    b.tick(8, held({ down: true }));
    expect(b.s.hp).toBeGreaterThan(a.s.hp);
  });

  it('punches hurt much more when he is open, and the first one earns a star', () => {
    const open = ring(); const ready = ring();
    open.s.foe.phase = 'open'; open.s.foe.t = 0; open.s.foe.dur = 1; open.s.foe.starred = false;
    ready.s.foe.guard = 'none'; ready.s.foe.t = 0; ready.s.foe.dur = 9;
    open.tick(1, held({}, { a: true }));
    ready.tick(1, held({}, { a: true }));
    expect(open.s.foe.hp).toBeLessThan(ready.s.foe.hp);
    expect(open.s.stars).toBe(1);
  });

  it('a punch at the guarded height does nothing', () => {
    const { s, tick } = ring();
    s.foe.phase = 'idle'; s.foe.guard = 'head'; s.foe.t = 0; s.foe.dur = 9;
    const hp = s.foe.hp;
    tick(1, held({}, { a: true }));
    expect(s.foe.hp).toBe(hp);
    expect(s.hurt).toBeGreaterThan(0);
  });

  it('a star buys an uppercut', () => {
    const { s, tick } = ring();
    s.stars = 1;
    s.foe.phase = 'idle'; s.foe.guard = 'head'; s.foe.t = 0; s.foe.dur = 9;
    const hp = s.foe.hp;
    tick(1, held({ up: true }, { a: true }));
    expect(s.foe.hp).toBeLessThan(hp - 15);
    expect(s.stars).toBe(0);
  });

  it('being knocked down starts a count; mashing gets you up', () => {
    const { s, tick } = ring();
    s.hp = 1;
    s.foe.phase = 'wind'; s.foe.side = 1; s.foe.t = 0; s.foe.dur = 0.05; s.foe.chain = 0;
    tick(6);
    expect(s.hp).toBe(0);
    expect(s.count).toBeGreaterThan(0);
    for (let k = 0; k < 10; k++) { tick(1, held({}, { a: true })); tick(1); }
    expect(s.hp).toBeGreaterThan(0);
  });

  it('not getting up loses the bout and costs a life', () => {
    const { s, tick } = ring();
    s.hp = 0; s.count = 0.02; s.presses = 0;
    tick(3);
    expect(s.phase).toBe('result');
    tick(200);
    expect(s.lives).toBe(2);
  });
});
