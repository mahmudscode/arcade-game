import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import liftAgent, { type LiftState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 240 < 60, right: f % 240 >= 120 && f % 240 < 180, down: f % 240 >= 200 }, { a: f % 25 === 0, b: f % 70 === 0, up: f % 111 === 0 });

describe('lift-agent', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(liftAgent, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(liftAgent, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(liftAgent, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(liftAgent, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(liftAgent, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(liftAgent, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(liftAgent, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = liftAgent.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      liftAgent.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) liftAgent.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;

function tower() {
  const rng = createRng(5);
  const s: LiftState = liftAgent.init({ rng, hiScore: 0 });
  s.guards = [];
  s.shots = [];
  s.spawnTimer = 1e9;
  s.me.invuln = 0;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) liftAgent.update(s, input, TICK, { rng, emit: () => undefined }); };
  const guard = (x: number, y: number) => ({ b: { x, y, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 }, dir: 0, cd: 99, think: 99 });
  return { s, tick, guard };
}

describe('lift-agent rules', () => {
  it('floors have openings over both shafts, and the ground does not', () => {
    const { s } = tower();
    for (const f of [3, 6, 9, 12]) {
      expect(s.grid[i(8, f)]).toBe(0);
      expect(s.grid[i(19, f)]).toBe(0);
      expect(s.grid[i(5, f)]).toBe(1);
    }
    expect(s.grid[i(8, 15)]).toBe(1);
  });

  it('the agent can step onto an elevator car and ride it up and down by holding Up / Down', () => {
    const { s, tick } = tower();
    // Car 0 starts at the top floor; send the agent to stand on it.
    Object.assign(s.me, { x: 8.9, y: 3, onGround: true });
    tick(2);
    expect(s.me.y).toBe(s.cars[0]!.y);
    tick(60, held({ down: true }));
    expect(s.cars[0]!.y).toBeGreaterThan(6);
    expect(s.me.y).toBe(s.cars[0]!.y);
    tick(60, held({ up: true }));
    expect(s.cars[0]!.y).toBeLessThan(s.me.y + 1e-9);
    const y1 = s.cars[0]!.y;
    tick(60); // no input: the car stays where it is
    expect(s.cars[0]!.y).toBe(y1);
    expect(s.me.y).toBe(y1);
  });

  it('the car stops at the top and bottom of the building', () => {
    const { s, tick } = tower();
    Object.assign(s.me, { x: 8.9, y: 3, onGround: true });
    tick(260, held({ down: true }));
    expect(s.cars[0]!.y).toBe(15);
    tick(260, held({ up: true }));
    expect(s.cars[0]!.y).toBe(3);
  });

  it('walking into an empty shaft drops you onto the car if it is below, else to the ground', () => {
    const { s, tick } = tower();
    s.cars[1]!.y = 9;
    Object.assign(s.me, { x: 17.0, y: 3, onGround: true });
    tick(40, held({ right: true }));
    tick(100);
    expect(s.me.y).toBe(9);
    Object.assign(s.me, { x: 7.0, y: 3, onGround: true });
    s.cars[0]!.y = 15;
    tick(40, held({ right: true }));
    tick(120);
    expect(s.me.y).toBe(15);
  });

  it('red doors hold documents (500 each); each can be taken once, standing at the door and pressing Up', () => {
    const { s, tick } = tower();
    const door = s.doors.find((d) => d.doc)!;
    Object.assign(s.me, { x: door.x, y: door.y, onGround: true });
    tick(1, held({}, { up: true }));
    expect(s.docs).toBe(1);
    expect(s.score).toBe(500);
    tick(1, held({}, { up: true }));
    expect(s.docs).toBe(1);
    const far = s.doors.filter((d) => d.doc && !d.opened)[0]!;
    Object.assign(s.me, { x: far.x + 3, y: far.y });
    tick(1, held({}, { up: true }));
    expect(s.docs).toBe(1);
  });

  it('the exit only works with every document in the bag', () => {
    const { s, tick } = tower();
    Object.assign(s.me, { x: 14.5, y: 15 });
    tick(3);
    expect(s.levelDelay).toBe(0);
    s.docs = s.doors.filter((d) => d.doc).length;
    tick(3);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(150);
    expect(s.level).toBe(2);
  });

  it('shots defeat guards (150); guards on the same floor shoot back, and a hit costs a life', () => {
    const a = tower();
    Object.assign(a.s.me, { x: 5.5, y: 15, face: 1 });
    a.s.guards.push(a.guard(10.5, 15));
    a.tick(1, held({}, { a: true }));
    a.tick(30);
    expect(a.s.guards).toHaveLength(0);
    expect(a.s.score).toBe(150);

    const b = tower();
    Object.assign(b.s.me, { x: 5.5, y: 15 });
    const g = b.guard(11.5, 15);
    g.cd = 0;
    b.s.guards.push(g);
    b.tick(120);
    expect(b.s.lives).toBeLessThan(3);
  });

  it('crouching ducks high shots but not low ones', () => {
    const high = tower();
    Object.assign(high.s.me, { x: 5.5, y: 15 });
    high.s.shots.push({ x: 9, y: 13.9, dir: -1, mine: false, high: true });
    high.tick(60, held({ down: true }));
    expect(high.s.lives).toBe(3);

    const low = tower();
    Object.assign(low.s.me, { x: 5.5, y: 15 });
    low.s.shots.push({ x: 9, y: 14.55, dir: -1, mine: false, high: false });
    low.tick(60, held({ down: true }));
    expect(low.s.lives).toBe(2);

    const standing = tower();
    Object.assign(standing.s.me, { x: 5.5, y: 15 });
    standing.s.shots.push({ x: 9, y: 13.9, dir: -1, mine: false, high: true });
    standing.tick(60);
    expect(standing.s.lives).toBe(2);
  });

  it('guards come out of doors over time, and only when the agent is not right beside them', () => {
    const { s, tick } = tower();
    s.spawnTimer = 0.01;
    Object.assign(s.me, { x: 27, y: 15 });
    tick(300);
    expect(s.guards.length).toBeGreaterThan(0);
  });

  it('the mission clock counts down; running out costs a life', () => {
    const { s, tick } = tower();
    s.clock = 2;
    tick(60 * 3);
    expect(s.lives).toBe(2);
    expect(s.clock).toBeGreaterThan(50);
  });

  it('guards will not walk off a floor into an open shaft', () => {
    const { s, tick, guard } = tower();
    Object.assign(s.me, { x: 25.5, y: 15 });
    const g = guard(5.5, 6);
    g.dir = 1;
    g.think = 99;
    s.guards.push(g);
    tick(60 * 6);
    expect(s.guards[0]!.b.y).toBe(6);
    expect(s.guards[0]!.b.x).toBeLessThan(8.5);
  });

  it('every building has at least as many red doors as documents needed, none in a shaft', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = liftAgent.init({ rng: createRng(seed), hiScore: 0 });
      const docs = s.doors.filter((d) => d.doc).length;
      expect(docs).toBeGreaterThanOrEqual(4);
      for (const d of s.doors) {
        expect([3, 6, 9, 12]).toContain(d.y);
        expect([8, 9, 18, 19]).not.toContain(Math.floor(d.x));
      }
    }
  });
});
