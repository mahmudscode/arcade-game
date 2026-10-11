import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import routeRider, { type RouteState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 160 < 30, right: f % 160 >= 80 && f % 160 < 110 }, { a: f % 23 === 0, b: f % 29 === 0 });

describe('route-rider', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(routeRider, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(routeRider, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(routeRider, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(routeRider, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(routeRider, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(routeRider, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(routeRider, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = routeRider.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      routeRider.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) routeRider.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function street() {
  const rng = createRng(5);
  const s: RouteState = routeRider.init({ rng, hiScore: 0 });
  s.houses = [];
  s.cars = [];
  s.movers = [];
  s.holes = [];
  s.bundles = [];
  s.length = 400;
  s.rider.invuln = 0;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) routeRider.update(s, input, TICK, { rng, emit: () => undefined }); };
  const house = (z: number, side: number, sub: boolean) => ({ z, side, sub, mail: false, porch: false, win: false, angry: false });
  return { s, tick, house };
}
const throwLeft = held({}, { a: true });
const throwRight = held({}, { b: true });

describe('route-rider rules', () => {
  it('the rider rolls forward on its own, steers across the road within its edges, and speeds up or slows down', () => {
    const { s, tick } = street();
    tick(60);
    expect(s.rider.z).toBeGreaterThan(7);
    tick(200, held({ left: true }));
    expect(s.rider.x).toBe(-3.6);
    tick(200, held({ right: true }));
    expect(s.rider.x).toBe(3.6);
    const a = street();
    a.tick(120, held({ up: true }));
    const b = street();
    b.tick(120, held({ down: true }));
    expect(a.s.rider.z).toBeGreaterThan(b.s.rider.z + 8);
  });

  it('A throws a paper to the left, B to the right, and you run out', () => {
    const { s, tick } = street();
    tick(1, throwLeft);
    expect(s.flying[0]!.vx).toBeLessThan(0);
    tick(1, throwRight);
    expect(s.flying[1]!.vx).toBeGreaterThan(0);
    expect(s.papers).toBe(10);
    s.papers = 1;
    tick(1, throwRight);
    expect(s.papers).toBe(0);
    const count = s.flying.length;
    tick(1, throwRight);
    expect(s.flying.length).toBe(count);
  });

  it('a paper in a subscriber\'s mailbox scores 250, once; a non-subscriber\'s mailbox scores nothing', () => {
    const a = street();
    a.s.houses.push(a.house(100, 1, true));
    a.s.rider.z = 90;
    a.s.flying.push({ x: 4.0, z: 100, vx: 13, life: 0.5 });
    a.tick(1);
    expect(a.s.score).toBe(250);
    expect(a.s.houses[0]!.mail).toBe(true);
    a.s.flying.push({ x: 4.0, z: 100, vx: 13, life: 0.5 });
    a.tick(1);
    expect(a.s.score).toBe(250);

    const b = street();
    b.s.houses.push(b.house(100, -1, false));
    b.s.rider.z = 90;
    b.s.flying.push({ x: -4.0, z: 100, vx: -13, life: 0.5 });
    b.tick(1);
    expect(b.s.score).toBe(0);
  });

  it('a window smashed at a non-subscriber scores 400, but one at a subscriber cancels the subscription', () => {
    const a = street();
    a.s.houses.push(a.house(100, 1, false));
    a.s.rider.z = 90;
    a.s.flying.push({ x: 6.9, z: 100, vx: 13, life: 0.5 });
    a.tick(1);
    expect(a.s.score).toBe(400);
    expect(a.s.houses[0]!.win).toBe(true);

    const b = street();
    b.s.houses.push(b.house(100, 1, true));
    b.s.rider.z = 90;
    b.s.flying.push({ x: 6.9, z: 100, vx: 13, life: 0.5 });
    b.tick(1);
    expect(b.s.score).toBe(0);
    expect(b.s.houses[0]!.sub).toBe(false);
    expect(b.s.houses[0]!.angry).toBe(true);
  });

  it('a paper landing on a subscriber\'s porch scores 100', () => {
    const { s, tick, house } = street();
    s.houses.push(house(100, -1, true));
    s.rider.z = 90;
    s.flying.push({ x: -5.7, z: 100, vx: -1, life: 0.01 });
    tick(2);
    expect(s.score).toBe(100);
    expect(s.houses[0]!.porch).toBe(true);
  });

  it('cars, dogs, kids and potholes wreck you: a life is lost and you restart a little further on, briefly safe', () => {
    const kinds: [string, (t: ReturnType<typeof street>) => void][] = [
      ['car', (t) => t.s.cars.push({ x: 0, z: 30, vz: 0, parked: true })],
      ['dog', (t) => t.s.movers.push({ x: 0, z: 30, vx: 0, kind: 'dog' })],
      ['kid', (t) => t.s.movers.push({ x: 0, z: 30, vx: 0, kind: 'kid' })],
      ['hole', (t) => t.s.holes.push({ x: 0, z: 30 })],
    ];
    for (const [, add] of kinds) {
      const t = street();
      add(t);
      t.s.rider.z = 29;
      t.tick(5);
      expect(t.s.lives).toBe(2);
      expect(t.s.rider.crash).toBeGreaterThan(0);
      t.tick(120);
      expect(t.s.rider.crash).toBeLessThanOrEqual(0);
      expect(t.s.rider.z).toBeGreaterThan(34);
      expect(t.s.rider.invuln).toBeGreaterThan(0);
    }
  });

  it('steering around an obstacle avoids it', () => {
    const { s, tick } = street();
    s.cars.push({ x: 0, z: 30, vz: 0, parked: true });
    s.rider.z = 20;
    tick(60, held({ right: true }));
    tick(200);
    expect(s.lives).toBe(3);
    expect(s.rider.z).toBeGreaterThan(40);
  });

  it('oncoming cars come toward you', () => {
    const { s, tick } = street();
    s.cars.push({ x: 2, z: 80, vz: -6, parked: false });
    tick(60);
    expect(s.cars[0]!.z).toBeLessThan(75);
  });

  it('bundles restock papers (up to the limit)', () => {
    const { s, tick } = street();
    s.papers = 3;
    s.bundles.push({ x: 0, z: 5 });
    tick(30);
    expect(s.papers).toBe(13);
    expect(s.score).toBe(50);
    s.papers = 17;
    s.bundles.push({ x: 0, z: s.rider.z + 2 });
    tick(30);
    expect(s.papers).toBe(18);
  });

  it('finishing the street pays for deliveries (+2000 if every subscriber got one) and starts a longer day', () => {
    const { s, tick, house } = street();
    s.length = 60;
    s.rider.z = 55;
    const h1 = house(20, 1, true);
    h1.mail = true;
    const h2 = house(30, -1, true);
    h2.porch = true;
    s.houses.push(h1, h2, house(40, 1, false));
    s.papers = 4;
    tick(60);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBe(2 * 100 + 2000 + 4 * 20);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.length).toBeGreaterThan(370);
  });

  it('missing a subscriber means no all-delivered bonus', () => {
    const { s, tick, house } = street();
    s.length = 60;
    s.rider.z = 55;
    const h1 = house(20, 1, true);
    h1.mail = true;
    s.houses.push(h1, house(30, -1, true));
    s.papers = 0;
    tick(60);
    expect(s.score).toBe(100);
  });

  it('streets have houses on both sides (about half subscribers), traffic, critters, holes and bundles, and a clear start', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = routeRider.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.houses.some((h) => h.side < 0)).toBe(true);
      expect(s.houses.some((h) => h.side > 0)).toBe(true);
      const subs = s.houses.filter((h) => h.sub).length / s.houses.length;
      expect(subs).toBeGreaterThan(0.3);
      expect(subs).toBeLessThan(0.8);
      expect(s.cars.length).toBeGreaterThan(2);
      expect(s.bundles.length).toBeGreaterThan(2);
      for (const o of [...s.cars, ...s.movers, ...s.holes]) expect(o.z).toBeGreaterThan(30);
    }
  });
});
