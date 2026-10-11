import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import gold, { type RaiderState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 50 && f % 200 < 100, down: f % 200 >= 150 }, { a: f % 37 === 0, b: f % 53 === 0 });

describe('gold-raider', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(gold, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(gold, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(gold, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(gold, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(gold, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(gold, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(gold, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = gold.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      gold.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) gold.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;

/** One floor (feet y = 11, bricks on rows 11-12) over a stone ground (feet y = 14), a ladder at column 10. */
function stage() {
  const rng = createRng(5);
  const s: RaiderState = gold.init({ rng, hiScore: 0 });
  s.grid = s.grid.map((_, k) => {
    const x = k % COLS;
    const y = Math.floor(k / COLS);
    if (y >= 14) return 2;
    if (y === 11 || y === 12) return x === 10 ? 3 : 1;
    if (y === 13 && x === 10) return 3;
    return 0;
  });
  s.holes = [];
  s.gold = [{ x: 26, y: 13 }]; // far away, keeps the level from finishing
  s.open = false;
  s.guards = [];
  Object.assign(s.me, { x: 5.5, y: 11, vx: 0, vy: 0, onGround: true, climbing: false, alive: true, digCd: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) gold.update(s, input, TICK, { rng, emit: () => undefined }); };
  const guard = (x: number, y: number) => ({ b: { x, y, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 }, trapped: 0, think: 0, dir: 0, up: false, down: false });
  return { s, tick, guard };
}

describe('gold-raider rules', () => {
  it('digging opens a pit diagonally ahead, which refills after a while', () => {
    const { s, tick } = stage();
    tick(1, held({}, { a: true }));
    expect(s.holes).toEqual([{ x: 4, y: 11, t: expect.any(Number) }]);
    tick(60 * 6);
    expect(s.holes).toHaveLength(1);
    tick(60 * 2);
    expect(s.holes).toHaveLength(0);
    expect(s.grid[i(4, 11)]).toBe(1);
  });

  it('digs right with B, and only into plain brick with clear space above', () => {
    const { s, tick } = stage();
    tick(1, held({}, { b: true }));
    expect(s.holes[0]).toMatchObject({ x: 6, y: 11 });
    tick(30);
    s.grid[i(7, 10)] = 2; // something solid above the next brick
    s.me.x = 6.5;
    tick(1, held({}, { b: true }));
    expect(s.holes).toHaveLength(1);
    const ground = stage();
    Object.assign(ground.s.me, { y: 14, x: 5.5 });
    ground.tick(1, held({}, { a: true }));
    expect(ground.s.holes).toHaveLength(0); // the ground is stone
  });

  it('picking up gold scores 250; the last piece opens the escape ladder, and climbing it wins the level', () => {
    const { s, tick } = stage();
    s.gold = [{ x: 6, y: 10 }];
    tick(60, held({ right: true }));
    expect(s.score).toBe(250);
    expect(s.open).toBe(true);
    expect(s.grid[i(14, 0)]).toBe(3);
    // Put the player on the top floor under the escape ladder.
    Object.assign(s.me, { x: 14.5, y: 2, onGround: true, climbing: false });
    s.grid[i(14, 2)] = 1;
    for (let f = 0; f < 300 && s.levelDelay <= 0; f++) tick(1, held({ up: true }));
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThan(250);
    tick(120);
    expect(s.level).toBe(2);
  });

  it('a guard walking onto a pit is trapped, climbs out later, or dies when the brick returns (75)', () => {
    const a = stage();
    a.s.holes.push({ x: 8, y: 11, t: 5 });
    a.s.me.x = 20.5;
    a.s.guards.push(a.guard(7.5, 11));
    a.s.guards[0]!.dir = 1;
    a.tick(40);
    expect(a.s.guards[0]!.trapped).toBeGreaterThan(0);
    a.tick(60 * 4); // after 3.5 s it climbs out
    expect(a.s.guards[0]!.trapped).toBeLessThanOrEqual(0);

    const b = stage();
    b.s.holes.push({ x: 8, y: 11, t: 2 });
    b.s.me.x = 20.5;
    b.s.guards.push(b.guard(8.5, 12));
    b.s.guards[0]!.trapped = 10;
    b.tick(60 * 3);
    expect(b.s.score).toBe(75);
    expect(b.s.guards).toHaveLength(1); // a replacement spawned
  });

  it('guards find their way up a ladder to reach the player, and touching one is fatal', () => {
    const { s, tick, guard } = stage();
    Object.assign(s.me, { x: 20.5, y: 11 });
    s.guards.push(guard(3.5, 14));
    tick(60 * 12);
    expect(s.guards[0]!.b.y).toBeLessThanOrEqual(11.01);
    expect(s.lives).toBeLessThan(3);
  });

  it('a pit refilling on the player costs a life, but up climbs out in time', () => {
    const a = stage();
    a.s.holes.push({ x: 5, y: 11, t: 1 });
    Object.assign(a.s.me, { x: 5.5, y: 12, onGround: true });
    a.tick(80);
    expect(a.s.lives).toBe(2);

    const b = stage();
    b.s.holes.push({ x: 5, y: 11, t: 1 });
    Object.assign(b.s.me, { x: 5.5, y: 12, onGround: true });
    b.tick(10, held({ up: true }));
    expect(b.s.me.y).toBe(11);
    b.tick(80);
    expect(b.s.lives).toBe(3);
  });

  it('the player cannot jump and cannot walk through bricks', () => {
    const { s, tick } = stage();
    tick(30, held({ up: true, a: false }));
    expect(s.me.y).toBe(11);
    s.grid[i(7, 10)] = 1;
    tick(90, held({ right: true }));
    expect(s.me.x).toBeLessThan(7);
  });

  it('generated levels connect every floor with ladders, put gold on floors, and keep guards away', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = gold.init({ rng: createRng(seed), hiScore: 0 });
      for (let k = 0; k < 4; k++) {
        const cols = [...Array(COLS).keys()].filter((x) => s.grid[i(x, [2, 5, 8, 11][k]!)] === 3);
        expect(cols.length).toBeGreaterThanOrEqual(2);
      }
      for (const g of s.gold) expect([1, 4, 7, 10, 13]).toContain(g.y);
      expect(s.gold.length).toBeGreaterThanOrEqual(5);
      for (const g of s.guards) expect(Math.hypot(g.b.x - s.me.x, g.b.y - s.me.y)).toBeGreaterThanOrEqual(9);
    }
  });
});
