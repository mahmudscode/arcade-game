import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import saucerSwarm from './index';

const held = (over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: NO_INPUT.pressed });

const script = (frame: number): Input => held({ left: frame % 200 < 80, right: frame % 200 >= 100 && frame % 200 < 180, a: frame % 10 < 5 });

describe('saucer-swarm', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(saucerSwarm, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(saucerSwarm, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(saucerSwarm, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(saucerSwarm, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('scores points when shooting', () => {
    const { status } = runHeadless(saucerSwarm, { seed: 3, frames: 1800, inputAt: script });
    expect(status.score).toBeGreaterThan(0);
  });

  it('ends the game if the player never fights back', () => {
    const { status } = runHeadless(saucerSwarm, { seed: 4, frames: 30000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('keeps invariants: integer non-negative score, finite positions', () => {
    const { state, status } = runHeadless(saucerSwarm, {
      seed: 7,
      frames: 10000,
      inputAt: (f) => held({ left: (f * 7) % 5 === 0, right: (f * 3) % 7 === 0, a: f % 2 === 0 }),
    });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(state.player.x + state.swarmX + state.swarmY)).toBe(true);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(saucerSwarm, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
