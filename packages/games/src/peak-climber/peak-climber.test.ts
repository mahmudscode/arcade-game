import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import peakClimber, { type PeakState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150 }, { b: f % 25 === 0, a: f % 40 === 0 });

describe('peak-climber', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(peakClimber, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(peakClimber, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(peakClimber, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(peakClimber, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(peakClimber, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(peakClimber, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(peakClimber, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = peakClimber.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      peakClimber.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) peakClimber.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 24;
const i = (x: number, f: number) => f * COLS + x;
const floorY = (f: number) => -f * 3;

function mountain() {
  const rng = createRng(5);
  const s: PeakState = peakClimber.init({ rng, hiScore: 0 });
  s.seals = [];
  s.birds = [];
  s.birdTimer = 1e9;
  s.sealTimer = 1e9;
  s.me.invuln = 0;
  // Solid floors, no pre-opened gaps, so each test knows exactly what is there.
  for (let f = 1; f < s.rows; f++) for (let x = 0; x < COLS; x++) s.grid[i(x, f)] = 1;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) peakClimber.update(s, input, TICK, { rng, emit: () => undefined }); };
  const seal = (x: number, f: number) => ({ b: { x, y: floorY(f), vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 }, dir: 0, dead: 0 });
  return { s, tick, seal };
}
const jump = held({}, { b: true });
const hammer = held({}, { a: true });

describe('peak-climber rules', () => {
  it('jumping up into a brick floor knocks out the brick above you (10)', () => {
    const { s, tick } = mountain();
    Object.assign(s.me, { x: 5.5, y: 0 });
    tick(1, jump);
    tick(30);
    expect(s.grid[i(5, 1)]).toBe(0);
    expect(s.score).toBe(10);
    expect(s.grid[i(4, 1)]).toBe(1);
    expect(s.grid[i(6, 1)]).toBe(1);
  });

  it('once there is a hole you can jump up through it onto the floor above (100 for a new floor)', () => {
    const { s, tick } = mountain();
    s.grid[i(5, 1)] = 0;
    s.grid[i(6, 1)] = 0;
    Object.assign(s.me, { x: 5.9, y: 0 });
    tick(1, jump);
    for (let f = 0; f < 90; f++) tick(1, held({ right: f > 12 && f < 36 })); // drift onto the solid part of the upper floor
    expect(s.me.y).toBe(floorY(1));
    expect(s.best).toBe(1);
    expect(s.score).toBe(100);
  });

  it('a solid floor cannot be passed without breaking through it', () => {
    const { s, tick } = mountain();
    Object.assign(s.me, { x: 12.5, y: 0 });
    tick(1, jump);
    tick(60);
    expect(s.me.y).toBe(0);
    expect(s.best).toBe(0);
  });

  it('falling back down keeps your best floor, and you restart from it after a mishap', () => {
    const { s, tick } = mountain();
    s.best = 3;
    s.grid[i(10, 3)] = 0;
    Object.assign(s.me, { x: 5.5, y: floorY(3), onGround: true });
    s.birds.push({ x: 5.5, y: floorY(3) - 1, dir: 1 });
    tick(3);
    expect(s.lives).toBe(2);
    tick(120);
    expect(s.me.alive).toBe(true);
    expect(s.me.y).toBe(floorY(3));
  });

  it('seals plug open gaps with ice, which can be broken again from below; a hammer blow defeats a seal (400)', () => {
    const a = mountain();
    a.s.grid[i(8, 1)] = 0;
    a.s.seals.push(a.seal(7.2, 1));
    a.s.seals[0]!.dir = 1;
    Object.assign(a.s.me, { x: 20.5, y: 0 });
    a.tick(60);
    expect(a.s.grid[i(8, 1)]).toBe(2);
    Object.assign(a.s.me, { x: 8.5, y: 0 });
    a.s.seals = [];
    a.tick(1, jump);
    a.tick(30);
    expect(a.s.grid[i(8, 1)]).toBe(0);

    const b = mountain();
    Object.assign(b.s.me, { x: 5.5, y: 0, face: 1 });
    b.s.seals.push(b.seal(6.5, 0), b.seal(4.0, 0), b.seal(9.5, 0));
    b.tick(1, hammer);
    expect(b.s.seals.filter((s2) => s2.dead > 0)).toHaveLength(1);
    expect(b.s.score).toBe(400);
  });

  it('touching a live seal or a bird costs a life; the hammer sends a bird packing (800)', () => {
    const a = mountain();
    Object.assign(a.s.me, { x: 5.5, y: 0 });
    a.s.seals.push(a.seal(5.7, 0));
    a.tick(2);
    expect(a.s.lives).toBe(2);

    const b = mountain();
    Object.assign(b.s.me, { x: 5.5, y: 0, face: 1 });
    b.s.birds.push({ x: 6.8, y: -1, dir: -1 });
    b.tick(1, hammer);
    expect(b.s.birds).toHaveLength(0);
    expect(b.s.score).toBe(800);
  });

  it('reaching the top floor completes the mountain; the next one is taller', () => {
    const { s, tick } = mountain();
    const top = s.rows - 1;
    s.best = top - 1;
    s.grid[i(10, top)] = 0;
    s.grid[i(11, top)] = 0;
    Object.assign(s.me, { x: 5.5, y: floorY(top), onGround: true });
    // Standing on the top floor (as if having just climbed up).
    s.grid[i(5, top)] = 1;
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    const rows = s.rows;
    tick(150);
    expect(s.level).toBe(2);
    expect(s.rows).toBeGreaterThan(rows);
  });

  it('every generated mountain has two open gaps in each floor, plus solid ground', () => {
    for (const seed of [1, 2, 3]) {
      const s = peakClimber.init({ rng: createRng(seed), hiScore: 0 });
      for (let f = 1; f < s.rows; f++) {
        const open = s.grid.slice(f * COLS, f * COLS + COLS).filter((c) => c === 0).length;
        expect(open).toBeGreaterThanOrEqual(2);
        expect(open).toBeLessThanOrEqual(4);
      }
    }
  });
});
