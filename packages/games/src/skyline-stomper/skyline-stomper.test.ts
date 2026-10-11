import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import skylineStomper, { monsterPos, type StomperState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 300 < 60, right: f % 300 >= 100 && f % 300 < 160, up: f % 300 >= 160 && f % 300 < 230, down: f % 300 >= 230 }, { a: f % 12 === 0 });

describe('skyline-stomper', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(skylineStomper, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(skylineStomper, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(skylineStomper, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(skylineStomper, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(skylineStomper, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(skylineStomper, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(skylineStomper, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = skylineStomper.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      skylineStomper.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) skylineStomper.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 4;

function city() {
  const rng = createRng(5);
  const s: StomperState = skylineStomper.init({ rng, hiScore: 0 });
  s.tanks = [];
  s.choppers = [];
  s.shots = [];
  s.tankTimer = 1e9;
  s.chopTimer = 1e9;
  s.mon.invuln = 0;
  for (const b of s.buildings) {
    b.sniper = b.sniper.map(() => 0);
    b.people = b.people.map(() => 0);
  }
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) skylineStomper.update(s, input, TICK, { rng, emit: () => undefined }); };
  /** Puts the monster on building `bi` at (col, row). */
  const climb = (bi: number, col: number, row: number) => Object.assign(s.mon, { b: bi, col, row, move: 0 });
  return { s, tick, climb };
}
const hit = held({}, { a: true });

describe('skyline-stomper rules', () => {
  it('walks the ground within the screen and climbs only when standing at a building', () => {
    const { s, tick } = city();
    s.mon.x = 260; // in the gap between two buildings
    tick(10, held({ up: true }));
    expect(s.mon.b).toBe(-1);
    tick(400, held({ left: true }));
    expect(s.mon.x).toBe(20);
    s.mon.x = s.buildings[0]!.x + 60;
    tick(2, held({ up: true }));
    expect(s.mon.b).toBe(0);
    expect(s.mon.row).toBe(s.buildings[0]!.rows - 1);
  });

  it('climbs one window at a time, stays on the face, and steps off at the bottom', () => {
    const { s, tick, climb } = city();
    climb(0, 1, 3);
    tick(10, held({ up: true }));
    expect(s.mon.row).toBe(2);
    tick(200, held({ right: true }));
    expect(s.mon.col).toBe(COLS - 1);
    tick(200, held({ up: true }));
    expect(s.mon.row).toBe(0);
    tick(300, held({ down: true }));
    expect(s.mon.b).toBe(-1);
  });

  it('a window takes two punches; each punch also hits the window above', () => {
    const { s, tick, climb } = city();
    const b = s.buildings[0]!;
    climb(0, 1, 3);
    tick(1, hit);
    expect(b.win[3 * COLS + 1]).toBe(1);
    expect(b.win[2 * COLS + 1]).toBe(1);
    tick(20);
    tick(1, hit);
    expect(b.win[3 * COLS + 1]).toBe(0);
    expect(b.win[2 * COLS + 1]).toBe(0);
    expect(s.score).toBe(20);
  });

  it('eating a person at a broken window scores 100 and heals', () => {
    const { s, tick, climb } = city();
    const b = s.buildings[0]!;
    b.people[3 * COLS + 1] = 1;
    s.mon.hp = 50;
    climb(0, 1, 3);
    tick(1, hit);
    tick(20);
    tick(1, hit);
    expect(s.score).toBe(10 + 10 + 100);
    expect(s.mon.hp).toBeGreaterThan(50);
    expect(b.people[3 * COLS + 1]).toBe(0);
  });

  it('a building collapses once most windows are broken (1000), dropping the climber', () => {
    const { s, tick, climb } = city();
    const b = s.buildings[0]!;
    const n = b.win.length;
    for (let i = 0; i < Math.ceil(n * 0.7) - 1; i++) b.win[i] = 0;
    b.win[n - 1] = 1;
    b.win[n - 1 - COLS] = 1;
    climb(0, COLS - 1, b.rows - 1);
    s.score = 0;
    tick(1, hit);
    expect(b.fall).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(1000);
    expect(s.mon.b).toBe(-1);
    expect(s.mon.hp).toBeLessThan(100);
    tick(100);
    expect(b.dead).toBe(true);
  });

  it('flattening all three buildings starts the next level', () => {
    const { s, tick } = city();
    for (const b of s.buildings) b.fall = 1.19;
    tick(200);
    expect(s.level).toBe(2);
    expect(s.buildings.every((b) => !b.dead && b.fall === 0)).toBe(true);
  });

  it('a tank on the ground can be punched for 200; its shells hurt (8)', () => {
    const a = city();
    a.s.mon.x = 400;
    a.s.tanks.push({ x: 430, dir: 1, cd: 99 });
    a.tick(1, hit);
    expect(a.s.tanks).toHaveLength(0);
    expect(a.s.score).toBe(200);

    const b = city();
    b.s.mon.x = 400;
    b.s.tanks.push({ x: 300, dir: 1, cd: 0 });
    b.tick(60);
    expect(b.s.mon.hp).toBeLessThan(100);
  });

  it('a chopper next to a climber can be swatted (300)', () => {
    const { s, tick, climb } = city();
    climb(1, 1, 2);
    const p = monsterPos(s);
    s.choppers.push({ x: p.x + 20, y: p.y, dir: 1, cd: 99 });
    tick(1, hit);
    expect(s.choppers).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(300);
  });

  it('snipers shoot a climber that gets close, and breaking their window pays 50', () => {
    const a = city();
    const b = a.s.buildings[0]!;
    b.sniper[2 * COLS + 1] = 1;
    b.cd[2 * COLS + 1] = 0;
    a.climb(0, 1, 3);
    a.tick(90);
    expect(a.s.mon.hp).toBeLessThan(100);

    const c = city();
    const cb = c.s.buildings[0]!;
    cb.sniper[3 * COLS + 1] = 1;
    cb.cd[3 * COLS + 1] = 99;
    c.climb(0, 1, 3);
    c.tick(1, hit);
    c.tick(20);
    c.tick(1, hit);
    expect(c.s.score).toBe(10 + 10 + 50);
  });

  it('losing all health costs a life, then the monster is back at full health and briefly safe', () => {
    const { s, tick } = city();
    s.mon.hp = 5;
    s.shots.push({ x: s.mon.x, y: 492, vx: 0, vy: 0 });
    tick(2);
    expect(s.lives).toBe(2);
    expect(s.mon.hp).toBe(0);
    tick(150);
    expect(s.mon.hp).toBe(100);
    expect(s.mon.invuln).toBeGreaterThan(0);
  });

  it('generated cities have three standing buildings with windows and some people', () => {
    for (const seed of [1, 2, 3]) {
      const s = skylineStomper.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.buildings).toHaveLength(3);
      expect(s.buildings.every((b) => b.win.length === b.rows * COLS && b.win.every((w) => w === 2))).toBe(true);
      expect(s.buildings.some((b) => b.people.some((p) => p === 1))).toBe(true);
    }
  });
});
