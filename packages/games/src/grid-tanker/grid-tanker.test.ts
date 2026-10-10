import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import gridTanker, { type TankerState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": turn, drive and fire in a repeating pattern.
const script = (f: number): Input =>
  held({ left: f % 240 < 50, right: f % 240 >= 120 && f % 240 < 170, up: f % 90 < 60 }, { a: f % 45 === 0 });

describe('grid-tanker', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(gridTanker, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(gridTanker, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(gridTanker, { seed: 1, frames: 600, inputAt: script });
    const b = runHeadless(gridTanker, { seed: 2, frames: 600, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: finite positions, integer non-negative score, inside the arena', () => {
    const { state, status } = runHeadless(gridTanker, { seed: 7, frames: 12000, inputAt: (f) => held({ left: (f * 7) % 5 === 0, right: (f * 3) % 7 === 0, up: f % 3 !== 0, down: f % 11 === 0 }, { a: f % 20 === 0 }) });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(state.me.x + state.me.z + state.me.a)).toBe(true);
    expect(Math.abs(state.me.x)).toBeLessThanOrEqual(900);
    expect(Math.abs(state.me.z)).toBeLessThanOrEqual(900);
    for (const e of state.enemies) expect(Number.isFinite(e.x + e.z + e.a)).toBe(true);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(gridTanker, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

function arena(): { s: TankerState; rng: ReturnType<typeof createRng>; tick: (n: number, input?: Input) => void } {
  const rng = createRng(11);
  const s = gridTanker.init({ rng, hiScore: 0 });
  s.enemies = [];
  s.obstacles = [];
  s.shells = [];
  s.saucerTimer = 1e9;
  s.me.invuln = 0;
  return { s, rng, tick: (n, input = NO_INPUT) => { for (let i = 0; i < n; i++) gridTanker.update(s, input, TICK, { rng, emit: () => undefined }); } };
}

describe('grid-tanker rules', () => {
  it('a shell destroys a tank in front and scores 1000', () => {
    const { s, tick } = arena();
    s.enemies.push({ kind: 'tank', x: 300, z: 0, a: Math.PI, cd: 99, vx: 0 });
    tick(1, held({}, { a: true }));
    tick(90);
    expect(s.enemies.some((e) => e.kind === 'tank' && e.x === 300)).toBe(false);
    expect(s.score).toBe(1000);
  });

  it('a shell that misses scores nothing', () => {
    const { s, tick } = arena();
    s.enemies.push({ kind: 'tank', x: 300, z: 200, a: Math.PI, cd: 99, vx: 0 });
    tick(1, held({}, { a: true }));
    tick(90);
    expect(s.score).toBe(0);
  });

  it('only one player shell can be in flight at a time', () => {
    const { s, tick } = arena();
    tick(1, held({}, { a: true }));
    tick(1, held({}, { a: true }));
    expect(s.shells.filter((sh) => sh.mine)).toHaveLength(1);
  });

  it('an enemy shell kills the player and costs a life; invulnerability protects after respawn', () => {
    const { s, tick } = arena();
    s.shells.push({ x: 40, z: 0, vx: -270, vz: 0, life: 3, mine: false });
    tick(30);
    expect(s.lives).toBe(2);
    expect(s.me.alive).toBe(false);
    tick(200);
    expect(s.me.alive).toBe(true);
    expect(s.me.invuln).toBeGreaterThan(0);
  });

  it('survives being hit while many shells are in flight, and clears enemy fire', () => {
    const { s, tick } = arena();
    for (let k = 0; k < 6; k++) s.shells.push({ x: 400 + k * 20, z: 300, vx: 0, vz: 0, life: 3, mine: false });
    s.shells.push({ x: 1, z: 0, vx: 0, vz: 0, life: 3, mine: false }, { x: 90, z: 90, vx: 0, vz: 0, life: 3, mine: true });
    for (let k = 0; k < 6; k++) s.shells.push({ x: -400 - k * 20, z: -300, vx: 0, vz: 0, life: 3, mine: false });
    tick(1);
    expect(s.lives).toBe(2);
    expect(s.shells.every((sh) => sh.mine)).toBe(true);
  });

  it('obstacles block movement and shells', () => {
    const { s, tick } = arena();
    s.obstacles.push({ x: 90, z: 0, r: 30, pyramid: false });
    tick(240, held({ up: true }));
    expect(s.me.x).toBeLessThan(90 - 30);
    s.enemies.push({ kind: 'tank', x: 400, z: 0, a: Math.PI, cd: 99, vx: 0 });
    tick(1, held({}, { a: true }));
    tick(90);
    expect(s.score).toBe(0); // the obstacle shielded the tank
  });

  it('a bonus saucer is worth 5000', () => {
    const { s, tick } = arena();
    s.enemies.push({ kind: 'saucer', x: 300, z: 0, a: 0, cd: 0, vx: 0 });
    tick(1, held({}, { a: true }));
    tick(90);
    expect(s.score).toBe(5000);
  });

  it('clearing the tanks starts the next wave', () => {
    const { s, tick } = arena();
    expect(s.wave).toBe(1);
    tick(200);
    expect(s.wave).toBe(2);
    expect(s.enemies.some((e) => e.kind === 'tank')).toBe(true);
  });
});

describe('grid-tanker rendering', () => {
  it('draws every frame of a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = gridTanker.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      gridTanker.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) gridTanker.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});
