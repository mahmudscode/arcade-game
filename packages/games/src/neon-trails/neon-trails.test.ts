import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import neonTrails from './index';

const script = (f: number): Input => ({
  held: { ...NO_INPUT.held, left: f % 200 < 80, right: f % 200 >= 100 && f % 200 < 180, up: f % 90 < 20, down: f % 130 > 100 },
  pressed: { ...NO_INPUT.pressed, a: f % 12 === 0, up: f % 37 === 0, right: f % 53 === 0, down: f % 61 === 0, left: f % 71 === 0 },
});

describe('neon-trails', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(neonTrails, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(neonTrails, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(neonTrails, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(neonTrails, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, no NaN in state', () => {
    const { state, status } = runHeadless(neonTrails, { seed: 7, frames: 10000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toContain('null');
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(neonTrails, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(neonTrails, { seed: 9, frames: 120000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });
});
