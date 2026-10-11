import { STAGE_LEN, type GunnerState } from '../_shared/gunner';
import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import ironTrooper from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ up: f % 300 < 250, left: f % 180 < 40, right: f % 180 >= 90 && f % 180 < 130, a: f % 3 !== 0 }, { b: f % 120 === 0 });

describe('iron-trooper', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(ironTrooper, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(ironTrooper, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(ironTrooper, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(ironTrooper, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(ironTrooper, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(ironTrooper, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('draws a run without throwing or emitting non-finite coordinates', () => {
    const bad: number[] = [];
    const num = (...a: unknown[]) => a.forEach((v) => typeof v === 'number' && !Number.isFinite(v) && bad.push(v));
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, p) => (typeof p === 'string' && /^(moveTo|lineTo|fillRect|arc|fillText|strokeRect|rect|ellipse)$/.test(p) ? (...a: unknown[]) => num(...a) : () => ({ width: 0 })),
      set: () => true,
    });
    const rng = createRng(3);
    const s = ironTrooper.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      ironTrooper.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) ironTrooper.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});
const GAME = ironTrooper;


function field() {
  const rng = createRng(5);
  const s: GunnerState = GAME.init({ rng, hiScore: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}
const foe = (x: number, y: number, kind = 'soldier', hp = 2) => ({ kind, x, y, hp, maxHp: hp, cd: 99, wind: 0, aim: 0, speed: 0, side: 1 }) as never;

describe('gunner rules', () => {
  it('holding fire shoots in the direction you last moved', () => {
    const { s, tick } = field();
    s.obstacles = [];
    tick(1, held({ right: true }));
    tick(1, held({ right: true, a: true }));
    expect(s.bullets.some((b) => b.mine && b.vx > 0)).toBe(true);
  });

  it('a bullet defeats a soldier in front', () => {
    const { s, tick } = field();
    s.obstacles = [];
    s.hero.fy = -1; s.hero.fx = 0;
    s.foes.push(foe(s.hero.x, s.hero.y - 120, 'soldier', 1));
    tick(60, held({ a: true }));
    expect(s.score).toBeGreaterThanOrEqual(100);
  });

  it('cover blocks bullets', () => {
    const { s, tick } = field();
    s.obstacles = [{ x: s.hero.x - 40, y: s.hero.y - 60, w: 80, h: 20 }];
    s.foes.push(foe(s.hero.x, s.hero.y - 150, 'soldier', 1));
    tick(40, held({ a: true }));
    expect(s.foes[0]!.hp).toBe(1);
  });

  it('a grenade lobs over cover and blasts a bunker', () => {
    const { s, tick } = field();
    s.obstacles = [{ x: s.hero.x - 60, y: s.hero.y - 100, w: 120, h: 30 }];
    s.foes.push(foe(s.hero.x, s.hero.y - 200, 'bunker', 8));
    const g0 = s.hero.grenades;
    tick(1, held({}, { b: true }));
    expect(s.hero.grenades).toBe(g0 - 1);
    tick(60);
    expect(s.foes.some((f) => f.kind === 'bunker' && f.hp > 0)).toBe(false);
  });

  it('one hit ends a life on foot', () => {
    const { s, tick } = field();
    s.hero.invuln = 0;
    s.bullets.push({ x: s.hero.x, y: s.hero.y, vx: 0, vy: 0, life: 1, mine: false, dmg: 1 });
    tick(1);
    expect(s.hero.dead).toBe(true);
    expect(s.lives).toBe(2);
  });

  it('the stage clock runs out and costs a life', () => {
    const { s, tick } = field();
    s.clock = 0.05;
    tick(10);
    expect(s.lives).toBe(2);
  });

  it('the camera only scrolls forward', () => {
    const { s, tick } = field();
    s.obstacles = [];
    tick(60, held({ up: true }));
    const y = s.camY;
    tick(60, held({ down: true }));
    expect(s.camY).toBe(y);
    expect(s.hero.y).toBeLessThanOrEqual(s.camY + 570);
  });

  it('the stage is long', () => {
    expect(STAGE_LEN).toBeGreaterThan(3000);
  });
});
