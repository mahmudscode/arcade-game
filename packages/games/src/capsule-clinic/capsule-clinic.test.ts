import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type Input } from '@arcade/engine';
import capsuleClinic from './index';

const script = (f: number): Input => ({
  held: { ...NO_INPUT.held, left: f % 200 < 80, right: f % 200 >= 100 && f % 200 < 180, down: f % 130 > 100 },
  pressed: { ...NO_INPUT.pressed, a: f % 12 === 0, b: f % 29 === 0, up: f % 37 === 0, right: f % 53 === 0, down: f % 61 === 0, left: f % 71 === 0 },
});

describe('capsule-clinic', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(capsuleClinic, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(capsuleClinic, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(capsuleClinic, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(capsuleClinic, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, no NaN in state', () => {
    const { state, status } = runHeadless(capsuleClinic, { seed: 7, frames: 10000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toContain('null');
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(capsuleClinic, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(capsuleClinic, { seed: 9, frames: 120000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });
});

import { TICK, createRng } from '@arcade/engine';
import type { ClinicState } from './index';

const COLS = 8;
const i = (x: number, y: number) => y * COLS + x;

function fresh(): { s: ClinicState; rng: ReturnType<typeof createRng> } {
  const rng = createRng(3);
  const s = capsuleClinic.init({ rng, hiScore: 0 });
  s.color.fill(0);
  s.kind.fill(0);
  s.mate.fill(-1);
  return { s, rng };
}
const put = (s: ClinicState, x: number, y: number, kind: 1 | 2, color: number, mate = -1) => {
  s.kind[i(x, y)] = kind;
  s.color[i(x, y)] = color;
  s.mate[i(x, y)] = mate;
};
/** Runs the clear/gravity phase until the next capsule spawns. */
function settle(s: ClinicState, rng: ReturnType<typeof createRng>) {
  s.phase = 'resolve';
  s.timer = 0;
  for (let n = 0; n < 600 && s.phase === 'resolve'; n++) capsuleClinic.update(s, NO_INPUT, TICK, { rng, emit: () => undefined });
}

describe('capsule-clinic rules', () => {
  it('clears four in a row (germ included) and clears the level when no germs remain', () => {
    const { s, rng } = fresh();
    put(s, 0, 15, 1, 1);
    for (const x of [1, 2, 3]) put(s, x, 15, 2, 1);
    settle(s, rng);
    expect(s.kind[i(1, 15)]).toBe(0); // the cleared cells are gone (a fresh level is then built)
    expect(s.level).toBe(2);
    expect(s.kind.filter((k) => k === 1).length).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(100 + 30 + 500);
  });

  it('three in a row is not enough', () => {
    const { s, rng } = fresh();
    put(s, 7, 15, 1, 3);
    for (const x of [0, 1, 2]) put(s, x, 15, 2, 1);
    settle(s, rng);
    expect(s.kind[i(0, 15)]).toBe(2);
    expect(s.score).toBe(0);
  });

  it('a floating capsule falls as one joined piece', () => {
    const { s, rng } = fresh();
    put(s, 7, 15, 1, 3);
    put(s, 0, 5, 2, 1, i(0, 6));
    put(s, 0, 6, 2, 2, i(0, 5));
    settle(s, rng);
    expect(s.kind[i(0, 15)]).toBe(2);
    expect(s.kind[i(0, 14)]).toBe(2);
    expect(s.mate[i(0, 15)]).toBe(i(0, 14));
    expect(s.mate[i(0, 14)]).toBe(i(0, 15));
  });

  it('a half whose partner was cleared becomes loose and drops', () => {
    const { s, rng } = fresh();
    put(s, 7, 15, 1, 3);
    // Vertical red run in column 0 (rows 11-14) clears; (0,14) was joined to a blue half at (1,14).
    for (const y of [11, 12, 13]) put(s, 0, y, 2, 1);
    put(s, 0, 14, 2, 1, i(1, 14));
    put(s, 1, 14, 2, 2, i(0, 14));
    put(s, 0, 15, 1, 2); // support so only the blue half is left to fall
    settle(s, rng);
    expect(s.kind[i(0, 14)]).toBe(0);
    expect(s.kind[i(1, 15)]).toBe(2);
    expect(s.mate[i(1, 15)]).toBe(-1);
  });
});
