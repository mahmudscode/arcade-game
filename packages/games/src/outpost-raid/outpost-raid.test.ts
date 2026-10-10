import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import outpostRaid, { type OutpostState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": sweep headings and hold fire.
const script = (f: number): Input => held({ left: f % 300 < 60, right: f % 300 >= 100 && f % 300 < 160, up: f % 300 >= 160 && f % 300 < 230, down: f % 300 >= 230, a: f % 8 < 5 });

describe('outpost-raid', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(outpostRaid, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(outpostRaid, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(outpostRaid, { seed: 1, frames: 600, inputAt: script });
    const b = runHeadless(outpostRaid, { seed: 2, frames: 600, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: finite positions inside the world, integer non-negative score', () => {
    const { state, status } = runHeadless(outpostRaid, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    for (const e of [state.me, ...state.fighters, ...state.shots]) {
      expect(Number.isFinite(e.x + e.y)).toBe(true);
      expect(e.x >= 0 && e.x < 2400 && e.y >= 0 && e.y < 2400).toBe(true);
    }
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(outpostRaid, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('draws a run without throwing or non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = outpostRaid.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      outpostRaid.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) outpostRaid.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const C = 1200;
function arena(): { s: OutpostState; tick: (n: number, input?: Input) => void } {
  const rng = createRng(11);
  const s = outpostRaid.init({ rng, hiScore: 0 });
  s.bases = [];
  s.mines = [];
  s.fighters = [];
  s.shots = [];
  s.spawnTimer = 1e9;
  s.me.invuln = 0;
  Object.assign(s.me, { x: C, y: C, a: -Math.PI / 2 }); // heading up
  return { s, tick: (n, input = NO_INPUT) => { for (let i = 0; i < n; i++) outpostRaid.update(s, input, TICK, { rng, emit: () => undefined }); } };
}
const base = (x: number, y: number) => ({ x, y, core: true, pods: [true, true, true, true, true, true], cd: [999, 999, 999, 999, 999, 999] });

describe('outpost-raid rules', () => {
  it('keeps flying along its heading without input, wrapping around the world', () => {
    const { s, tick } = arena();
    s.me.y = 10;
    tick(30);
    expect(s.me.y).toBeGreaterThan(2300);
    expect(s.me.x).toBe(C);
  });

  it('steers in 8 directions and keeps the new heading when the key is released', () => {
    const { s, tick } = arena();
    tick(1, held({ right: true, up: true }));
    tick(30);
    expect(s.me.a).toBeCloseTo(-Math.PI / 4);
    expect(s.me.x).toBeGreaterThan(C + 20);
  });

  it('a shot destroys a gun pod for 200 and leaves the core standing', () => {
    const { s, tick } = arena();
    s.bases.push(base(C - POD_RING, C - 220)); // pod 0 sits directly in the ship's line of fire
    tick(40, held({ a: true }));
    expect(s.bases[0]!.pods[0]).toBe(false);
    expect(s.bases[0]!.core).toBe(true);
    expect(s.score).toBe(200);
  });

  it('a shot through the gap between pods destroys the core for 1500 and takes the whole base', () => {
    const { s, tick } = arena();
    s.bases.push(base(C, C - 220));
    tick(40, held({ a: true }));
    expect(s.bases[0]!.core).toBe(false);
    expect(s.bases[0]!.pods.every((p) => !p)).toBe(true);
    expect(s.score).toBe(1500);
  });

  it('fires astern as well as ahead', () => {
    const { s, tick } = arena();
    s.fighters.push({ x: C, y: C + 200, a: -Math.PI / 2, cd: 999 });
    tick(40, held({ a: true }));
    expect(s.fighters).toHaveLength(0);
    expect(s.score).toBe(100);
  });

  it('shooting a mine scores 50; flying into one costs a life', () => {
    const a = arena();
    a.s.mines.push({ x: C, y: C - 180 });
    a.tick(30, held({ a: true }));
    expect(a.s.score).toBe(50);

    const b = arena();
    b.s.mines.push({ x: C, y: C - 25 });
    b.tick(30);
    expect(b.s.lives).toBe(2);
    expect(b.s.me.alive).toBe(false);
  });

  it('survives the ship being hit while many shots are in flight, and clears enemy fire', () => {
    const { s, tick } = arena();
    for (let k = 0; k < 6; k++) s.shots.push({ x: C + 300 + k * 20, y: C + 300, vx: 0, vy: 0, life: 3, mine: false });
    s.shots.push({ x: C, y: C - 1, vx: 0, vy: 0, life: 3, mine: false }, { x: C + 40, y: C + 40, vx: 0, vy: 0, life: 3, mine: true });
    for (let k = 0; k < 6; k++) s.shots.push({ x: C - 300 - k * 20, y: C - 300, vx: 0, vy: 0, life: 3, mine: false });
    tick(1);
    expect(s.lives).toBe(2);
    expect(s.shots.every((sh) => sh.mine)).toBe(true);
  });

  it('is invulnerable right after respawning', () => {
    const { s, tick } = arena();
    s.me.invuln = 2;
    s.mines.push({ x: C, y: C - 25 });
    tick(30);
    expect(s.lives).toBe(3);
  });

  it('destroying every core starts the next round with a fresh set of bases', () => {
    const { s, tick } = arena();
    s.bases.push({ ...base(100, 100), core: false, pods: [false, false, false, false, false, false] });
    tick(120);
    expect(s.round).toBe(2);
    expect(s.score).toBe(1000);
    expect(s.bases.length).toBeGreaterThanOrEqual(4);
    expect(s.bases.every((b) => b.core)).toBe(true);
  });
});

const POD_RING = 40;
