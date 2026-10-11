import { STAGE_LEN, type BrawlerState } from '../_shared/brawler';
import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import metroRumble from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ right: f % 400 < 300, left: f % 400 >= 300 && f % 400 < 340, down: f % 7 === 0 && f % 400 > 200, up: f % 11 === 0 }, { a: f % 9 === 0, b: f % 47 === 0 });

describe('metro-rumble', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(metroRumble, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(metroRumble, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(metroRumble, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(metroRumble, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(metroRumble, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(metroRumble, { seed: 5, frames: 300, inputAt: script });
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
    const s = metroRumble.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      metroRumble.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) metroRumble.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});
const GAME = metroRumble;

function arena() {
  const rng = createRng(5);
  const s: BrawlerState = GAME.init({ rng, hiScore: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  return { s, tick };
}
const punch = held({}, { a: true });

describe('brawler rules', () => {
  it('a punch damages a foe in front and a combo ends with a knockdown', () => {
    const { s, tick } = arena();
    s.segments.forEach((q) => (q.done = true));
    s.crates = [];
    tick(1);
    s.foes.push({ ...s.hero, kind: 'thug', cd: 99, wind: 0, speed: 0, dmg: 5, reach: 30, drop: 'none', id: 99, x: s.hero.x + 30, hp: 200, maxHp: 200, invuln: undefined } as never);
    const f = s.foes[0]!;
    for (let k = 0; k < 3; k++) { tick(1, punch); tick(12); }
    expect(f.hp).toBeLessThan(200);
    expect(['down', 'hurt', 'getup', 'idle']).toContain(f.state);
  });

  it('the screen locks until a wave is beaten, then releases', () => {
    const { s, tick } = arena();
    tick(2);
    expect(s.locked).toBe(true);
    for (const f of s.foes) { f.hp = 0; f.state = 'dead'; f.t = 1; }
    tick(2);
    expect(s.locked).toBe(false);
    expect(s.go).toBeGreaterThan(0);
  });

  it('standing still with no foes brings stragglers after a while', () => {
    const { s, tick } = arena();
    s.segments.forEach((q) => (q.done = true));
    s.foes = [];
    tick(60 * 13);
    expect(s.foes.length).toBeGreaterThan(0);
  });

  it('at most two foes wind up at once', () => {
    const { s, tick } = arena();
    tick(2);
    s.hero.invuln = 99;
    let worst = 0;
    for (let k = 0; k < 600; k++) { tick(1); worst = Math.max(worst, s.foes.filter((f) => f.wind > 0).length); }
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('losing all health costs a life', () => {
    const { s, tick } = arena();
    s.hero.invuln = 0;
    s.hero.hp = 1;
    s.foes.push({ ...s.hero, kind: 'thug', cd: 0, wind: 0.01, speed: 0, dmg: 20, reach: 40, drop: 'none', id: 98, x: s.hero.x + 10, y: s.hero.y, face: -1, hp: 50, maxHp: 50 } as never);
    tick(3);
    expect(s.hero.state).toBe('dead');
    expect(s.lives).toBe(2);
  });

  it('the stage is long enough to scroll', () => {
    expect(STAGE_LEN).toBeGreaterThan(2000);
  });
});
