import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import altitudeRaid, { project, type RaidState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 240 < 60, right: f % 240 >= 120 && f % 240 < 180, up: f % 240 >= 60 && f % 240 < 100, down: f % 240 >= 180 && f % 240 < 210, a: f % 5 < 3 });

describe('altitude-raid', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(altitudeRaid, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(altitudeRaid, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(altitudeRaid, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(altitudeRaid, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(altitudeRaid, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(altitudeRaid, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(altitudeRaid, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = altitudeRaid.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      altitudeRaid.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) altitudeRaid.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function lane() {
  const rng = createRng(5);
  const s: RaidState = altitudeRaid.init({ rng, hiScore: 0 });
  s.targets = [];
  s.walls = [];
  s.shots = [];
  s.spawnTimer = 1e9;
  s.wallTimer = 1e9;
  s.ship.invuln = 0;
  Object.assign(s.ship, { u: 150, z: 60 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) altitudeRaid.update(s, input, TICK, { rng, emit: () => undefined }); };
  const target = (kind: 'turret' | 'fuel' | 'plane' | 'boss', u: number, dv: number, z: number) => ({ kind, u, v: s.v + dv, z, hp: kind === 'boss' ? 14 : 1, cd: 99, t: 0 });
  return { s, tick, target };
}
const fire = held({ a: true });

describe('altitude-raid rules', () => {
  it('projection: things ahead go up-right, things to the right go down-right, and altitude lifts them', () => {
    const s = { v: 0, ship: { u: 150 } };
    const o = project(s, 150, 0, 0);
    const ahead = project(s, 150, 100, 0);
    const right = project(s, 250, 0, 0);
    const high = project(s, 150, 0, 50);
    expect(ahead.x).toBeGreaterThan(o.x);
    expect(ahead.y).toBeLessThan(o.y);
    expect(right.x).toBeGreaterThan(o.x);
    expect(right.y).toBeGreaterThan(o.y);
    expect(high.y).toBeLessThan(o.y);
    expect(high.x).toBe(o.x);
  });

  it('the ship steers across the lane and up and down, within limits', () => {
    const { s, tick } = lane();
    s.fuel = 1e9;
    tick(300, held({ left: true, down: true }));
    expect(s.ship.u).toBe(14);
    expect(s.ship.z).toBe(6);
    tick(400, held({ right: true, up: true }));
    expect(s.ship.u).toBe(286);
    expect(s.ship.z).toBe(112);
  });

  it('shots only hit what is at their altitude: a plane at the same height dies (200), one far above does not', () => {
    const a = lane();
    a.s.targets.push(a.target('plane', 150, 200, 60));
    a.tick(1, fire);
    a.tick(40);
    expect(a.s.score).toBe(200);

    const b = lane();
    b.s.targets.push({ ...b.target('plane', 150, 200, 100), cd: 99 });
    b.tick(1, fire);
    b.tick(20);
    expect(b.s.score).toBe(0);
  });

  it('ground turrets can only be hit from low altitude (300)', () => {
    const high = lane();
    high.s.targets.push(high.target('turret', 150, 200, 0));
    high.s.ship.z = 80;
    high.tick(1, fire);
    high.tick(40);
    expect(high.s.score).toBe(0);
    const low = lane();
    low.s.targets.push(low.target('turret', 150, 200, 0));
    low.s.ship.z = 6;
    low.tick(1, fire);
    low.tick(40);
    expect(low.s.score).toBe(300);
  });

  it('fuel drains with time; shooting a fuel tank refills it; an empty tank costs a life', () => {
    const { s, tick, target } = lane();
    tick(60 * 5);
    expect(s.fuel).toBeLessThan(95);
    s.fuel = 40;
    s.targets.push(target('fuel', 150, 200, 0));
    s.ship.z = 6;
    tick(1, fire);
    tick(40);
    expect(s.fuel).toBeGreaterThan(60);
    expect(s.score).toBe(300);

    const dry = lane();
    dry.s.fuel = 0.05;
    dry.tick(10);
    expect(dry.s.lives).toBe(2);
    dry.tick(150);
    expect(dry.s.fuel).toBeGreaterThanOrEqual(40);
  });

  it('a wall has to be flown through its opening: inside scores 100, anywhere else crashes', () => {
    const through = lane();
    through.s.walls.push({ v: through.s.v + 100, u0: 120, u1: 190, z0: 40, z1: 90, passed: false });
    through.tick(60);
    expect(through.s.lives).toBe(3);
    expect(through.s.score).toBe(100);

    const crash = lane();
    crash.s.walls.push({ v: crash.s.v + 100, u0: 20, u1: 90, z0: 40, z1: 90, passed: false });
    crash.tick(60);
    expect(crash.s.lives).toBe(2);

    const tooLow = lane();
    tooLow.s.walls.push({ v: tooLow.s.v + 100, u0: 120, u1: 190, z0: 70, z1: 110, passed: false });
    tooLow.tick(60);
    expect(tooLow.s.lives).toBe(2);
  });

  it('hitting a ground object or a plane head on costs a life; enemy shots aimed at you hit unless you move', () => {
    const a = lane();
    a.s.ship.z = 6;
    a.s.targets.push(a.target('turret', 150, 60, 0));
    a.tick(60);
    expect(a.s.lives).toBe(2);

    const b = lane();
    const t = b.target('turret', 150, 220, 0);
    t.cd = 0;
    b.s.targets.push(t);
    b.s.ship.z = 20;
    b.tick(2);
    expect(b.s.shots.some((x) => !x.mine)).toBe(true);
    b.tick(150);
    expect(b.s.lives).toBe(2);

    const c = lane();
    const t2 = c.target('turret', 150, 220, 0);
    t2.cd = 0;
    c.s.targets.push(t2);
    c.s.ship.z = 20;
    c.tick(2);
    c.tick(150, held({ right: true }));
    expect(c.s.lives).toBe(3);
  });

  it('after the stage distance a boss arrives and spawning stops; 14 hits destroy it (6000) and start the next stage', () => {
    const { s, tick } = lane();
    s.v = 7000;
    s.spawnTimer = 0.1;
    tick(5);
    expect(s.boss).toBe(true);
    const boss = s.targets.find((t) => t.kind === 'boss')!;
    expect(boss).toBeDefined();
    s.spawnTimer = 0;
    tick(60);
    expect(s.targets.filter((t) => t.kind !== 'boss' && t.kind !== 'plane').length).toBe(0);
    s.ship.invuln = 99;
    s.fuel = 1e9;
    for (let f = 0; f < 60 * 25 && s.levelDelay <= 0; f++) {
      const b = s.targets.find((t) => t.kind === 'boss');
      if (b) {
        s.ship.u = b.u;
        s.ship.z = 20;
        b.cd = 99;
      }
      tick(1, fire);
    }
    expect(s.score).toBeGreaterThanOrEqual(6000);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.boss).toBe(false);
  });

  it('ground objects, fuel tanks, planes and walls all turn up over a stage', () => {
    const { s, tick } = lane();
    s.spawnTimer = 0.1;
    s.wallTimer = 0.1;
    const kinds = new Set<string>();
    let walls = 0;
    for (let f = 0; f < 60 * 40 && !s.over; f++) {
      s.ship.invuln = 99;
      s.fuel = 100;
      tick(1);
      s.targets.forEach((t) => kinds.add(t.kind));
      walls = Math.max(walls, s.walls.length);
    }
    expect(kinds.has('turret')).toBe(true);
    expect(kinds.has('fuel')).toBe(true);
    expect(kinds.has('plane')).toBe(true);
    expect(walls).toBeGreaterThan(0);
  });
});
