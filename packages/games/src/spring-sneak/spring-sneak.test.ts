import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import springSneak, { type SneakState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150 }, { a: f % 70 === 0 });

describe('spring-sneak', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(springSneak, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(springSneak, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(springSneak, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(springSneak, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(springSneak, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(springSneak, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(springSneak, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = springSneak.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      springSneak.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) springSneak.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 28;
const i = (x: number, y: number) => y * COLS + x;

function mansion() {
  const rng = createRng(5);
  const s: SneakState = springSneak.init({ rng, hiScore: 0 });
  s.cats = [];
  s.doors = [];
  s.loot = [{ x: 20.5, y: 3, kind: 0 }]; // far away: keeps the level open
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) springSneak.update(s, input, TICK, { rng, emit: () => undefined }); };
  const cat = (x: number, y: number) => ({ b: { x, y, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, drop: 0 }, dir: 0, stun: 0, gone: 0, think: 99 });
  return { s, tick, cat };
}

describe('spring-sneak rules', () => {
  it('floors have openings over the three trampoline shafts, and the ground does not', () => {
    const { s } = mansion();
    for (const f of [3, 6, 9, 12]) {
      expect(s.grid[i(3, f)]).toBe(0);
      expect(s.grid[i(13, f)]).toBe(0);
      expect(s.grid[i(24, f)]).toBe(0);
      expect(s.grid[i(8, f)]).toBe(1);
    }
    expect(s.grid[i(3, 15)]).toBe(1);
  });

  it('the hero cannot jump, but walks off an edge, falls down the shaft and is thrown back up by the trampoline', () => {
    const { s, tick } = mansion();
    Object.assign(s.me, { x: 6.2, y: 3, onGround: true });
    s.tramp[0] = 6;
    tick(1, held({}, { a: false, b: true })); // jumping does nothing
    expect(s.me.y).toBe(3);
    Object.assign(s.me, { x: 4.0, y: 3 }); // over the middle of the shaft: nothing to stand on
    tick(200);
    expect(s.tramp[0]).toBeLessThan(6); // it bounced
    expect(s.me.y).toBeGreaterThan(2);
  });

  it('steering during a bounce can land on the floor above', () => {
    const { s, tick } = mansion();
    Object.assign(s.me, { x: 4, y: 14, onGround: false, vy: 0 });
    // Fall onto the trampoline, then head right as the bounce peaks.
    let landed = false;
    for (let f = 0; f < 240; f++) {
      const high = s.me.y < 12.6; // steer once the bounce has carried you above the floor
      tick(1, held({ right: high && !landed }));
      if (s.me.y === 12 && s.me.onGround) landed = true;
    }
    expect(s.me.y).toBeLessThanOrEqual(12);
    expect(s.me.x).toBeGreaterThan(5);
  });

  it('a trampoline snaps after enough bounces and then no longer throws anything up', () => {
    const { s, tick } = mansion();
    s.tramp[1] = 1;
    Object.assign(s.me, { x: 14, y: 12, onGround: false });
    for (let f = 0; f < 600; f++) tick(1);
    expect(s.tramp[1]).toBe(0);
    expect(s.me.y).toBe(15);
    expect(s.me.onGround).toBe(true);
  });

  it('loot scores 200-500 each; taking the last piece clears the level and starts the next', () => {
    const { s, tick } = mansion();
    s.loot = [{ x: 8.5, y: 15, kind: 2 }];
    Object.assign(s.me, { x: 8.5, y: 15 });
    tick(2);
    expect(s.score).toBeGreaterThanOrEqual(400);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.loot.length).toBeGreaterThanOrEqual(7);
  });

  it('a power door blasts the cats on its floor, once, and only when you are next to it', () => {
    const a = mansion();
    a.s.doors.push({ x: 10.5, y: 15, used: false });
    Object.assign(a.s.me, { x: 10.5, y: 15 });
    a.s.cats.push(a.cat(14.5, 15), a.cat(16.5, 15), a.cat(14.5, 12));
    a.tick(1, held({}, { a: true }));
    expect(a.s.cats.filter((c) => c.gone > 0)).toHaveLength(2);
    expect(a.s.cats[2]!.gone).toBe(0); // different floor
    expect(a.s.score).toBe(200 + 400);
    expect(a.s.doors[0]!.used).toBe(true);
    a.tick(1, held({}, { a: true }));
    expect(a.s.score).toBe(200 + 400); // used up

    const b = mansion();
    b.s.doors.push({ x: 20.5, y: 15, used: false });
    Object.assign(b.s.me, { x: 10.5, y: 15 });
    b.s.cats.push(b.cat(14.5, 15));
    b.tick(1, held({}, { a: true }));
    expect(b.s.cats[0]!.gone).toBe(0);
  });

  it('blasted cats come back at the top later', () => {
    const { s, tick, cat } = mansion();
    Object.assign(s.me, { x: 10.5, y: 15 });
    const c = cat(14.5, 15);
    c.gone = 0.5;
    s.cats.push(c);
    tick(60);
    expect(s.cats[0]!.b.y).toBe(3);
  });

  it('touching a cat costs a life', () => {
    const { s, tick, cat } = mansion();
    Object.assign(s.me, { x: 10, y: 15 });
    s.cats.push(cat(10.2, 15));
    tick(2);
    expect(s.lives).toBe(2);
  });

  it('cats on the hero\'s floor head toward them', () => {
    const { s, tick, cat } = mansion();
    Object.assign(s.me, { x: 20.5, y: 15 });
    const c = cat(8.5, 15);
    c.think = 0;
    s.cats.push(c);
    tick(60 * 8);
    expect(s.cats[0]!.b.x).toBeGreaterThan(12);
  });

  it('generated levels place loot on floors outside the shafts and doors on floors', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = springSneak.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.loot.length).toBeGreaterThanOrEqual(7);
      for (const l of s.loot) {
        expect([3, 6, 9, 12, 15]).toContain(l.y);
        expect(l.x % 1).toBe(0.5);
        expect([3, 4, 13, 14, 23, 24]).not.toContain(Math.floor(l.x));
      }
      for (const d of s.doors) expect([3, 6, 9, 12, 15]).toContain(d.y);
    }
  });
});
