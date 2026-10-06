import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import cometCrusher from './index';

const held = (over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: NO_INPUT.pressed });

// A scripted "player": spin, thrust and fire in a repeating pattern.
const script = (frame: number): Input =>
  held({ left: frame % 120 < 40, right: frame % 120 >= 80, up: frame % 90 < 30, a: frame % 6 < 3 });

describe('comet-crusher', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(cometCrusher, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(cometCrusher, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(cometCrusher, { seed: 1, frames: 600, inputAt: script });
    const b = runHeadless(cometCrusher, { seed: 2, frames: 600, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants under random-ish input: no NaN, non-negative integer score', () => {
    const { state, status } = runHeadless(cometCrusher, {
      seed: 7,
      frames: 10000,
      inputAt: (f) => held({ left: (f * 7) % 5 === 0, right: (f * 3) % 7 === 0, up: f % 3 === 0, a: f % 2 === 0 }),
    });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(state.ship.x) && Number.isFinite(state.ship.y)).toBe(true);
    for (const rock of state.rocks) expect(Number.isFinite(rock.x + rock.y)).toBe(true);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(cometCrusher, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
