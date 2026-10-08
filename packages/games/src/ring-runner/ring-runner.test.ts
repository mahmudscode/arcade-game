import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import ringRunner from './index';

const held = (over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: NO_INPUT.pressed });

const script = (frame: number): Input => held({ left: frame % 240 < 100, right: frame % 240 >= 120 && frame % 240 < 220, a: true });

describe('ring-runner', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(ringRunner, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(ringRunner, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(ringRunner, { seed: 1, frames: 1800, inputAt: script });
    const b = runHeadless(ringRunner, { seed: 2, frames: 1800, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('scores points when shooting', () => {
    const { status } = runHeadless(ringRunner, { seed: 3, frames: 3600, inputAt: script });
    expect(status.score).toBeGreaterThan(0);
  });

  it('ends the game if the player never fights back', () => {
    const { status } = runHeadless(ringRunner, { seed: 4, frames: 40000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('keeps invariants: integer non-negative score, finite positions, angle in range', () => {
    const { state, status } = runHeadless(ringRunner, {
      seed: 7,
      frames: 10000,
      inputAt: (f) => held({ left: (f * 7) % 5 === 0, right: (f * 3) % 7 === 0, a: f % 2 === 0 }),
    });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(state.player.a).toBeGreaterThanOrEqual(0);
    expect(state.player.a).toBeLessThan(Math.PI * 2);
    expect(state.foes.every((f) => Number.isFinite(f.r + f.a + f.x + f.y))).toBe(true);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(ringRunner, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
