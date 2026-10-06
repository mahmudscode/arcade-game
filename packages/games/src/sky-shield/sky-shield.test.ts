import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import skyShield from './index';

const held = (over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: NO_INPUT.pressed });
const script = (f: number): Input => ({
  held: { ...NO_INPUT.held, left: f % 200 < 80, right: f % 200 >= 100 && f % 200 < 180, up: f % 90 < 20 },
  pressed: { ...NO_INPUT.pressed, a: f % 12 === 0 },
});

describe('sky-shield', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(skyShield, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(skyShield, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(skyShield, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(skyShield, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite positions', () => {
    const { state, status } = runHeadless(skyShield, {
      seed: 7,
      frames: 10000,
      inputAt: (f) => ({ held: held({ left: (f * 7) % 5 === 0, right: (f * 3) % 7 === 0, up: f % 3 === 0 }).held, pressed: { ...NO_INPUT.pressed, a: f % 4 === 0 } }),
    });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(state.cursor.x)).toBe(true);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(skyShield, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(skyShield, { seed: 9, frames: 60000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });
});
