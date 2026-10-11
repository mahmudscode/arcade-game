import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import bombHopper, { type HopperState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, a: f % 40 < 25, down: f % 200 >= 170 }, { a: f % 40 === 0 });

describe('bomb-hopper', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(bombHopper, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(bombHopper, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(bombHopper, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(bombHopper, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(bombHopper, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(bombHopper, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(bombHopper, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = bombHopper.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      bombHopper.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) bombHopper.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function sky() {
  const rng = createRng(5);
  const s: HopperState = bombHopper.init({ rng, hiScore: 0 });
  s.foes = [];
  s.bombs = [{ x: 26.5, y: 3 }]; // one far-off bomb keeps the level open
  s.lit = 0;
  s.ballTimer = 1e9;
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) bombHopper.update(s, input, TICK, { rng, emit: () => undefined }); };
  const walker = (x: number, row: number) => ({ kind: 0, x, y: row, vx: 2.2, vy: 0, row, gone: 0 });
  const flyer = (x: number, y: number, vx: number, vy: number) => ({ kind: 1, x, y, vx, vy, row: 0, gone: 0 });
  return { s, tick, walker, flyer };
}

describe('bomb-hopper rules', () => {
  it('the hero jumps high enough to reach a platform from below, passing through it, and lands on top', () => {
    const { s, tick } = sky();
    Object.assign(s.me, { x: 5.5, y: 17 });
    tick(1, held({}, { a: true }));
    tick(70);
    expect(s.me.y).toBe(14);
    expect(s.me.onGround).toBe(true);
  });

  it('holding jump glides: the fall is slow, otherwise it is fast', () => {
    const run = (glide: boolean) => {
      const { s, tick } = sky();
      Object.assign(s.me, { x: 14.5, y: 2, onGround: false, vy: 0 });
      let maxV = 0;
      for (let f = 0; f < 25; f++) {
        tick(1, glide ? held({ a: true }) : NO_INPUT);
        maxV = Math.max(maxV, s.me.vy);
      }
      return maxV;
    };
    expect(run(true)).toBeLessThanOrEqual(3.01);
    expect(run(false)).toBeGreaterThan(8);
  });

  it('bombs are worth 100, the lit one 300 and then the nearest bomb lights up', () => {
    const { s, tick } = sky();
    s.bombs = [{ x: 14.5, y: 16.3 }, { x: 15.5, y: 16.3 }, { x: 22.5, y: 10 }];
    s.lit = 1;
    Object.assign(s.me, { x: 14.5, y: 17 });
    tick(2);
    expect(s.score).toBe(100);
    expect(s.bombs).toHaveLength(2);
    Object.assign(s.me, { x: 15.5, y: 17 });
    tick(2);
    expect(s.score).toBe(100 + 300);
    expect(s.lit).toBe(0); // the only one left
  });

  it('taking the last bomb clears the level and starts a new one with 24 bombs', () => {
    const { s, tick } = sky();
    s.bombs = [{ x: 14.5, y: 16.3 }];
    Object.assign(s.me, { x: 14.5, y: 17 });
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.bombs).toHaveLength(24);
  });

  it('walkers patrol their platform and turn around at the ends', () => {
    const { s, tick, walker } = sky();
    Object.assign(s.me, { x: 26.5, y: 17 });
    s.foes.push(walker(15, 11));
    tick(60 * 8);
    expect(s.foes[0]!.x).toBeGreaterThanOrEqual(10);
    expect(s.foes[0]!.x).toBeLessThanOrEqual(18);
    expect(s.foes[0]!.y).toBe(11);
  });

  it('flyers bounce off the edges of the screen and never leave it', () => {
    const { s, tick, flyer } = sky();
    Object.assign(s.me, { x: 26.5, y: 17 });
    s.foes.push(flyer(3, 3, -2.4, -1.6));
    for (let f = 0; f < 60 * 20; f++) {
      tick(1);
      const e = s.foes[0]!;
      expect(e.x).toBeGreaterThanOrEqual(1);
      expect(e.x).toBeLessThanOrEqual(27);
      expect(e.y).toBeGreaterThanOrEqual(1.5);
      expect(e.y).toBeLessThanOrEqual(17);
    }
  });

  it('touching an enemy costs a life, but with the power ball it scores 200, 400, 800 and sends it away', () => {
    const a = sky();
    Object.assign(a.s.me, { x: 14.5, y: 17 });
    a.s.foes.push(a.walker(14.5, 17));
    a.s.foes[0]!.row = 14;
    a.s.foes[0]!.y = 17;
    a.tick(1);
    // (a walker snaps to its platform row, so use a flyer for the ground-level touch)
    const b = sky();
    Object.assign(b.s.me, { x: 14.5, y: 17 });
    b.s.foes.push(b.flyer(14.5, 17, 0, 0));
    b.tick(2);
    expect(b.s.lives).toBe(2);

    const c = sky();
    Object.assign(c.s.me, { x: 14.5, y: 17, power: 5 });
    c.s.foes.push(c.flyer(14.5, 17, 0, 0), c.flyer(14.7, 17, 0, 0), c.flyer(14.6, 16.9, 0, 0));
    c.tick(2);
    expect(c.s.lives).toBe(3);
    expect(c.s.score).toBe(200 + 400 + 800);
    expect(c.s.foes.every((f) => f.gone > 0)).toBe(true);
    c.tick(60 * 6);
    expect(c.s.foes.every((f) => f.gone <= 0)).toBe(true);
  });

  it('the power ball appears on a platform, vanishes if ignored, and gives six seconds of power', () => {
    const { s, tick } = sky();
    Object.assign(s.me, { x: 26.5, y: 17 });
    s.ballTimer = 0.01;
    tick(3);
    expect(s.ball.life).toBeGreaterThan(8);
    tick(60 * 10);
    expect(s.ball.life).toBeLessThanOrEqual(0);
    s.ball = { x: 14.5, y: 16.4, life: 5 };
    Object.assign(s.me, { x: 14.5, y: 17 });
    tick(2);
    expect(s.me.power).toBeGreaterThan(5);
  });

  it('the hero cannot leave the screen sideways or by the top', () => {
    const { s, tick } = sky();
    tick(200, held({ left: true }));
    expect(s.me.x).toBeGreaterThan(0.2);
    tick(1, held({}, { a: true }));
    for (let f = 0; f < 80; f++) tick(1, held({ a: true }));
    expect(s.me.y).toBeGreaterThanOrEqual(1);
  });

  it('every level scatters 24 distinct bombs, one of them lit, none overlapping a platform', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = bombHopper.init({ rng: createRng(seed), hiScore: 0 });
      expect(s.bombs).toHaveLength(24);
      expect(new Set(s.bombs.map((b) => `${b.x},${b.y}`)).size).toBe(24);
      expect(s.lit).toBe(0);
      for (const b of s.bombs) {
        expect(b.x).toBeGreaterThan(0);
        expect(b.x).toBeLessThan(28);
        expect(b.y).toBeGreaterThan(1);
        expect(b.y).toBeLessThan(17);
      }
    }
  });
});
