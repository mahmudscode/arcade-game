import type { FighterState } from '../_shared/fighter';
import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import dojoDuel from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ right: f % 200 < 70, left: f % 200 >= 100 && f % 200 < 130, up: f % 90 === 0, down: f % 130 < 20 }, { a: f % 11 === 0, b: f % 17 === 0 });

describe('dojo-duel', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(dojoDuel, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(dojoDuel, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(dojoDuel, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(dojoDuel, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(dojoDuel, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(dojoDuel, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(dojoDuel, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = dojoDuel.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      dojoDuel.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) dojoDuel.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});
const GAME = dojoDuel;
const CFG_POINTS = true;
const CFG_FIRE = false;

function bout() {
  const rng = createRng(5);
  const s: FighterState = GAME.init({ rng, hiScore: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  tick(100); // intro
  s.e.ai.think = 999; // a passive opponent for rule tests
  return { s, tick };
}
const press = (over: Partial<Input['held']>) => held(over, over);

describe('fighter rules', () => {
  it('the round starts with an intro, then the fight', () => {
    const rng = createRng(1);
    const s: FighterState = GAME.init({ rng, hiScore: 0 });
    expect(s.phase).toBe('intro');
    for (let k = 0; k < 100; k++) GAME.update(s, NO_INPUT, TICK, { rng, emit: () => undefined });
    expect(s.phase).toBe('fight');
  });

  it('walking moves toward the opponent and a jump leaves the ground', () => {
    const { s, tick } = bout();
    const x0 = s.p.x;
    tick(20, held({ right: true }));
    expect(s.p.x).toBeGreaterThan(x0 + 20);
    tick(1, held({ up: true }));
    expect(s.p.y).toBeLessThan(470);
  });

  it('a punch in range scores a hit', () => {
    const { s, tick } = bout();
    s.e.ai.think = 999;
    s.p.x = 400; s.e.x = 450;
    const before = CFG_POINTS ? s.p.points : s.e.hp;
    tick(1, press({ a: true }));
    tick(20);
    if (CFG_POINTS) expect(s.p.points).toBe(before + 1);
    else expect(s.e.hp).toBeLessThan(before);
  });

  it('a punch out of range misses', () => {
    const { s, tick } = bout();
    s.p.x = 200; s.e.x = 600;
    const before = CFG_POINTS ? s.p.points : s.e.hp;
    tick(1, press({ a: true }));
    tick(30);
    expect(CFG_POINTS ? s.p.points : s.e.hp).toBe(before);
  });

  it('blocking (holding back) stops a hit', () => {
    const { s, tick } = bout();
    s.p.x = 400; s.e.x = 450;
    s.p.face = 1;
    s.e.state = 'attack'; s.e.move = 'punch'; s.e.t = 0.09; s.e.hit = false; s.e.face = -1;
    const before = CFG_POINTS ? s.e.points : s.p.hp;
    tick(2, held({ left: true }));
    expect(CFG_POINTS ? s.e.points : s.p.hp).toBe(before);
    expect(s.p.state).toBe('block');
  });

  it('a clean hit on an unguarded fighter lands', () => {
    const { s, tick } = bout();
    s.p.x = 400; s.e.x = 450;
    s.e.face = -1; s.e.state = 'attack'; s.e.move = 'punch'; s.e.t = 0.09; s.e.hit = false;
    const before = CFG_POINTS ? s.e.points : s.p.hp;
    tick(2);
    if (CFG_POINTS) expect(s.e.points).toBe(before + 1);
    else expect(s.p.hp).toBeLessThan(before);
  });

  it.runIf(CFG_FIRE)('Down, Forward, Punch throws a fireball', () => {
    const { s, tick } = bout();
    tick(1, press({ down: true }));
    tick(3, held({ down: true }));
    tick(1, press({ right: true }));
    tick(2, held({ right: true }));
    tick(1, held({}, { a: true }));
    tick(30);
    expect(s.balls.length + (s.e.hp < 100 ? 1 : 0)).toBeGreaterThan(0);
  });

  it.runIf(!CFG_POINTS)('hp reaching zero ends the round with a K.O.', () => {
    const { s, tick } = bout();
    s.e.hp = 1;
    s.p.x = 400; s.e.x = 450;
    tick(1, press({ a: true }));
    tick(30);
    expect(s.phase).toBe('ko');
    expect(s.wins[0]).toBe(1);
  });

  it('winning two rounds advances to the next bout; losing two costs a life', () => {
    const win = bout();
    win.s.wins = [1, 0];
    win.s.ended = true;
    win.s.phase = 'ko';
    win.s.pt = 0.01;
    win.s.wins = [2, 0];
    win.tick(3);
    expect(win.s.level).toBe(2);
    const lose = bout();
    lose.s.wins = [0, 2];
    lose.s.ended = true;
    lose.s.phase = 'ko';
    lose.s.pt = 0.01;
    lose.tick(3);
    expect(lose.s.lives).toBe(2);
  });

  it('the round timer decides a time-up round', () => {
    const { s, tick } = bout();
    s.timer = 0.02;
    if (CFG_POINTS) s.p.points = 1; else s.e.hp = 50;
    tick(3);
    expect(s.phase).toBe('ko');
    expect(s.wins[0]).toBe(1);
  });
});
