import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import game from './index';

const held = (over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: NO_INPUT.pressed });
const press = (f: number, over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: { ...NO_INPUT.pressed, ...over } });

const script = (f: number): Input => press(f, { left: f % 240 < 40, right: f % 240 >= 120 && f % 240 < 160, a: true });

describe('night-lane', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(game, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(game, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(game, { seed: 1, frames: 1800, inputAt: script });
    const b = runHeadless(game, { seed: 2, frames: 1800, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('scores points when played', () => {
    const { status } = runHeadless(game, { seed: 3, frames: 3600, inputAt: script });
    expect(status.score).toBeGreaterThan(0);
  });

  it('ends the game if the player never fights back', () => {
    const { status } = runHeadless(game, { seed: 4, frames: 60000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('keeps invariants: integer non-negative score, sane status', () => {
    const { status } = runHeadless(game, {
      seed: 7,
      frames: 10000,
      inputAt: (f) => press(f, { left: (f * 7) % 5 === 0, right: (f * 3) % 7 === 0, up: (f * 5) % 11 === 0, down: (f * 5) % 13 === 0, a: f % 2 === 0, b: f % 97 === 0 }),
    });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(status.level).toBeGreaterThanOrEqual(1);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(game, { seed: 5, frames: 600, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
