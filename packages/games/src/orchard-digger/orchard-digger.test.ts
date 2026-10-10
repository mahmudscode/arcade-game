import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import orchardDigger, { type OrchardState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 200 < 50, right: f % 200 >= 100 && f % 200 < 150, up: f % 200 >= 50 && f % 200 < 100, down: f % 200 >= 150 }, { a: f % 15 === 0 });

describe('orchard-digger', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(orchardDigger, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(orchardDigger, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(orchardDigger, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(orchardDigger, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(orchardDigger, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(orchardDigger, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(orchardDigger, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = orchardDigger.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      orchardDigger.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) orchardDigger.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 17;
const i = (x: number, y: number) => y * COLS + x;

/** All dirt, one open pocket for the digger at (8,6). */
function field() {
  const rng = createRng(5);
  const s: OrchardState = orchardDigger.init({ rng, hiScore: 0 });
  s.dirt = s.dirt.map(() => 1);
  s.dirt[i(8, 6)] = 0;
  s.cherries = [{ x: 15, y: 2 }];
  s.apples = [];
  s.grubs = [];
  s.quota = 5;
  s.spawnTimer = 1e9;
  Object.assign(s.me, { tx: 8, ty: 6, dx: 0, dy: 0, p: 0, invuln: 0, fx: 0, fy: -1 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) orchardDigger.update(s, input, TICK, { rng, emit: () => undefined }); };
  const apple = (x: number, y: number) => ({ x, y, mode: 'rest' as const, t: 0, p: 0, fallen: 0, kills: 0 });
  const grub = (x: number, y: number, digger = false) => ({ tx: x, ty: y, dx: 0, dy: 0, p: 0, digger });
  return { s, tick, apple, grub };
}

describe('orchard-digger rules', () => {
  it('digging through dirt leaves a tunnel and picks up cherries (50)', () => {
    const { s, tick } = field();
    s.cherries.push({ x: 10, y: 6 });
    tick(60, held({ right: true }));
    expect(s.dirt[i(9, 6)]).toBe(0);
    expect(s.dirt[i(10, 6)]).toBe(0);
    expect(s.cherries).toHaveLength(1);
    expect(s.score).toBe(50);
  });

  it('an undermined apple wobbles, falls, and survives a one-cell drop', () => {
    const { s, tick, apple } = field();
    s.apples.push(apple(5, 2));
    s.dirt[i(5, 2)] = 0;
    s.dirt[i(5, 3)] = 0;
    tick(10);
    expect(s.apples[0]!.mode).toBe('wobble');
    tick(60);
    expect(s.apples).toHaveLength(1);
    expect(s.apples[0]).toMatchObject({ y: 3, mode: 'rest' });
  });

  it('an apple that drops two or more cells smashes', () => {
    const { s, tick, apple } = field();
    s.apples.push(apple(5, 1));
    for (const y of [1, 2, 3, 4]) s.dirt[i(5, y)] = 0;
    tick(100);
    expect(s.apples).toHaveLength(0);
  });

  it('a falling apple crushes a grub underneath for 1000', () => {
    const { s, tick, apple, grub } = field();
    s.apples.push(apple(5, 1));
    for (const y of [1, 2, 3, 4]) s.dirt[i(5, y)] = 0;
    s.grubs.push(grub(5, 4));
    tick(100);
    expect(s.grubs).toHaveLength(0);
    expect(s.score).toBe(1000);
  });

  it('and crushes the digger if they linger under it', () => {
    const { s, tick, apple } = field();
    s.apples.push(apple(5, 1));
    for (const y of [1, 2, 3, 4, 5]) s.dirt[i(5, y)] = 0;
    Object.assign(s.me, { tx: 5, ty: 5 });
    tick(100);
    expect(s.lives).toBe(2);
  });

  it('apples can be shoved sideways into open tunnel but not into dirt', () => {
    const a = field();
    a.s.dirt[i(9, 6)] = 0;
    a.s.dirt[i(10, 6)] = 0;
    a.s.dirt[i(9, 7)] = 1;
    a.s.apples.push(a.apple(9, 6));
    a.tick(20, held({ right: true }));
    expect(a.s.apples[0]!.x).toBe(10);

    const b = field();
    b.s.dirt[i(9, 6)] = 0;
    b.s.apples.push(b.apple(9, 6));
    b.tick(20, held({ right: true }));
    expect(b.s.apples[0]!.x).toBe(9);
  });

  it('the power ball kills a grub in the tunnel (500) and bounces off dirt', () => {
    const { s, tick, grub } = field();
    for (let x = 3; x <= 13; x++) s.dirt[i(x, 6)] = 0;
    s.grubs.push(grub(12, 6));
    s.me.fx = 1;
    s.me.fy = 0;
    tick(1, held({}, { a: true }));
    tick(40);
    expect(s.score).toBe(500);
    expect(s.grubs).toHaveLength(0);

    const b = field();
    b.s.me.fx = 1;
    b.s.me.fy = 0;
    b.tick(1, held({}, { a: true }));
    b.tick(30);
    expect(b.s.ball.dx).toBe(-1); // turned back at the dirt wall
  });

  it('only one ball at a time, and it recharges', () => {
    const { s, tick } = field();
    s.me.fx = 1;
    s.me.fy = 0;
    tick(1, held({}, { a: true }));
    const first = { ...s.ball };
    tick(1, held({}, { a: true }));
    expect(s.ball.life).toBeLessThan(first.life);
    expect(s.ballCd).toBeGreaterThan(0);
  });

  it('a grub chases through tunnels and touching it costs a life', () => {
    const { s, tick, grub } = field();
    for (let x = 2; x <= 8; x++) s.dirt[i(x, 6)] = 0;
    s.grubs.push(grub(2, 6));
    tick(90);
    expect(s.grubs[0]!.tx).toBeGreaterThan(3);
    tick(300);
    expect(s.lives).toBe(2);
  });

  it('a digger grub tunnels through dirt toward the player', () => {
    const { s, tick, grub } = field();
    s.grubs.push(grub(2, 6, true));
    s.levelTime = 20;
    tick(400);
    expect(s.dirt[i(3, 6)]).toBe(0);
    expect(s.lives).toBe(2);
  });

  it('taking the last cherry clears the level', () => {
    const { s, tick } = field();
    s.cherries = [{ x: 9, y: 6 }];
    tick(40, held({ right: true }));
    tick(120);
    expect(s.level).toBe(2);
    expect(s.cherries.length).toBeGreaterThan(0);
  });
});
