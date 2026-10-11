import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import rooRescue, { type RooState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 150 }, { a: f % 20 === 0, b: f % 45 === 0 });

describe('roo-rescue', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(rooRescue, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(rooRescue, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(rooRescue, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(rooRescue, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(rooRescue, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(rooRescue, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(rooRescue, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = rooRescue.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      rooRescue.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) rooRescue.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;
const FLOORS = [16, 12, 8, 4];

function outback() {
  const rng = createRng(5);
  const s: RooState = rooRescue.init({ rng, hiScore: 0 });
  s.monkeys = [];
  s.apples = [];
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) rooRescue.update(s, input, TICK, { rng, emit: () => undefined }); };
  const monkey = (x: number, y: number) => ({ b: { x, y, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 }, dir: 0, up: false, down: false, think: 99, cd: 99, gone: 0 });
  return { s, tick, monkey };
}
const punch = held({}, { a: true });

describe('roo-rescue rules', () => {
  it('walks, jumps with B (and Up away from ladders), and climbs ladders with Up', () => {
    const { s, tick } = outback();
    // Find a ladder column on the bottom gap.
    const col = [...Array(COLS).keys()].find((x) => s.grid[i(x, 12)] === 2)!;
    Object.assign(s.me, { x: 2.5, y: 16 });
    tick(1, held({}, { b: true }));
    tick(1);
    expect(s.me.y).toBeLessThan(16);
    tick(60);
    expect(s.me.y).toBe(16);
    Object.assign(s.me, { x: col + 0.5, y: 16, onGround: true });
    tick(30, held({ up: true }));
    expect(s.me.climbing).toBe(true);
    expect(s.me.y).toBeLessThan(16);
  });

  it('a punch knocks away an apple in front for 200', () => {
    const { s, tick } = outback();
    Object.assign(s.me, { x: 5.5, y: 16, face: 1 });
    s.apples.push({ x: 6.8, y: 16, dir: -1 });
    tick(1, punch);
    expect(s.apples).toHaveLength(0);
    expect(s.score).toBe(200);
  });

  it('a punch does nothing behind you, or on a different floor', () => {
    const { s, tick } = outback();
    Object.assign(s.me, { x: 5.5, y: 16, face: 1 });
    s.apples.push({ x: 3.8, y: 16, dir: 1 }, { x: 6.8, y: 12, dir: -1 });
    tick(1, punch);
    expect(s.apples).toHaveLength(2);
  });

  it('an apple that hits costs a life; a well-timed jump clears it', () => {
    const a = outback();
    Object.assign(a.s.me, { x: 5.5, y: 16 });
    a.s.apples.push({ x: 12, y: 16, dir: -1 });
    a.tick(90);
    expect(a.s.lives).toBe(2);

    const hits: number[] = [];
    for (let at = 20; at <= 50; at += 3) {
      const b = outback();
      Object.assign(b.s.me, { x: 5.5, y: 16 });
      b.s.apples.push({ x: 12, y: 16, dir: -1 });
      b.tick(at);
      b.tick(1, held({}, { b: true }));
      b.tick(80);
      hits.push(b.s.lives);
    }
    expect(hits.some((l) => l === 3)).toBe(true);
  });

  it('punching a monkey scores 800 and it comes back at the top later', () => {
    const { s, tick, monkey } = outback();
    Object.assign(s.me, { x: 5.5, y: 16, face: 1 });
    s.monkeys.push(monkey(6.5, 16));
    tick(1, punch);
    expect(s.monkeys[0]!.gone).toBeGreaterThan(0);
    expect(s.score).toBe(800);
    tick(60 * 9);
    expect(s.monkeys[0]!.gone).toBeLessThanOrEqual(0);
    expect(s.monkeys[0]!.b.y).toBe(4);
  });

  it('a monkey on your floor throws apples at you; it only touches you if you are not punching', () => {
    const a = outback();
    Object.assign(a.s.me, { x: 5.5, y: 16 });
    const m = a.monkey(14.5, 16);
    m.cd = 0.1;
    a.s.monkeys.push(m);
    a.tick(20);
    expect(a.s.apples.length).toBeGreaterThanOrEqual(1);
    expect(a.s.apples[0]!.dir).toBe(-1);

    const b = outback();
    Object.assign(b.s.me, { x: 5.5, y: 16 });
    b.s.monkeys.push(b.monkey(5.8, 16));
    b.tick(2);
    expect(b.s.lives).toBe(2);
  });

  it('monkeys climb ladders to reach you on another floor', () => {
    const { s, tick, monkey } = outback();
    Object.assign(s.me, { x: 14.5, y: 16 });
    s.monkeys.push(monkey(14.5, 12));
    s.monkeys[0]!.think = 0;
    tick(60 * 25);
    expect(s.monkeys[0]!.b.y).toBeGreaterThanOrEqual(15.99);
  });

  it('rescuing the joey banks the bonus and starts a harder level; the bonus clock running out costs a life', () => {
    const a = outback();
    a.s.bonus = 2500;
    Object.assign(a.s.me, { x: 25.5, y: 4, onGround: true });
    a.tick(2);
    expect(a.s.score).toBe(2500 + 1000);
    a.tick(150);
    expect(a.s.level).toBe(2);

    const b = outback();
    b.s.bonus = 160;
    b.tick(60 * 3);
    expect(b.s.lives).toBe(2);
  });

  it('generated levels have four floors and two ladders in every gap', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = rooRescue.init({ rng: createRng(seed), hiScore: 0 });
      for (let k = 0; k < 3; k++) {
        const cols = [...Array(COLS).keys()].filter((x) => s.grid[i(x, FLOORS[k + 1]!)] === 2);
        expect(cols.length).toBe(2);
      }
      expect(s.monkeys.length).toBeGreaterThanOrEqual(2);
    }
  });
});
