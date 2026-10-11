import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import zoneStriker, { type StrikerState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 240 < 60, right: f % 240 >= 120 && f % 240 < 180, up: f % 240 >= 190 && f % 240 < 215, down: f % 240 >= 215, a: f % 5 < 3 }, { b: f % 40 === 0 });

describe('zone-striker', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(zoneStriker, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(zoneStriker, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(zoneStriker, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(zoneStriker, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(zoneStriker, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(zoneStriker, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(zoneStriker, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = zoneStriker.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      zoneStriker.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) zoneStriker.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

function sky() {
  const rng = createRng(5);
  const s: StrikerState = zoneStriker.init({ rng, hiScore: 0 });
  s.air = [];
  s.ground = [];
  s.bullets = [];
  s.bombs = [];
  s.airTimer = 1e9;
  s.groundTimer = 1e9;
  s.ship.invuln = 0;
  Object.assign(s.ship, { x: 400, y: 470 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) zoneStriker.update(s, input, TICK, { rng, emit: () => undefined }); };
  const air = (kind: 'ring' | 'dart' | 'armor', x: number, y: number) => ({ kind, x, y, x0: x, t: 0, hp: kind === 'armor' ? 3 : 1, cd: 99 });
  const gnd = (kind: 'dome' | 'tower' | 'tank' | 'fortress', x: number, y: number) => ({ kind, x, y, hp: { dome: 1, tower: 1, tank: 2, fortress: 14 }[kind], cd: 99, dir: 0 });
  return { s, tick, air, gnd };
}
const fire = held({ a: true });
const bomb = held({}, { b: true });

describe('zone-striker rules', () => {
  it('the ship flies inside the lower part of the screen', () => {
    const { s, tick } = sky();
    tick(200, held({ left: true, up: true }));
    expect(s.ship.x).toBe(24);
    expect(s.ship.y).toBe(300);
    tick(200, held({ right: true, down: true }));
    expect(s.ship.x).toBe(776);
    expect(s.ship.y).toBe(530);
  });

  it('the gun fires twin shots at air targets: rings 100, darts 150, armour takes three hits (300)', () => {
    // Keep the ship lined up under the target so every shot counts.
    const shoot = (kind: 'ring' | 'dart' | 'armor') => {
      const w = sky();
      w.s.air.push(w.air(kind, 400, 120));
      w.tick(1, fire);
      expect(w.s.bullets.filter((b) => b.mine)).toHaveLength(2);
      for (let f = 0; f < 300 && w.s.air.length > 0; f++) {
        w.s.ship.x = w.s.air[0]!.x;
        w.s.ship.invuln = 99;
        w.tick(1, fire);
      }
      return w.s;
    };
    expect(shoot('ring').score).toBe(100);
    expect(shoot('dart').score).toBe(150);
    const armor = shoot('armor');
    expect(armor.air).toHaveLength(0);
    expect(armor.score).toBe(300);
  });

  it('armour is not destroyed by a single hit', () => {
    const { s, tick, air } = sky();
    s.air.push(air('armor', 400, 200));
    s.air[0]!.x0 = 400;
    s.air[0]!.t = 0;
    s.ship.x = 400;
    s.bullets.push({ x: 400, y: 205, vx: 0, vy: 0, mine: true });
    tick(1);
    expect(s.air[0]!.hp).toBe(2);
    expect(s.score).toBe(0);
  });

  it('a bomb lands at the crosshair a moment after it is dropped and wrecks ground targets nearby (dome 200, tower 300)', () => {
    const { s, tick, gnd } = sky();
    // The sight is 150 px ahead of the ship; the ground scrolls ~70 px/s, so aim a little early.
    s.ground.push(gnd('dome', 400, 320 - 25), gnd('tower', 520, 320 - 25));
    tick(1, bomb);
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]!.y).toBeLessThan(330);
    tick(40);
    expect(s.bombs).toHaveLength(0);
    expect(s.score).toBe(200);
    s.ground.push(gnd('tower', 400, 300));
    tick(1, bomb);
    tick(40);
    expect(s.score).toBe(500);
  });

  it('bombs ignore air targets and the gun ignores ground targets; the bomb has a cooldown', () => {
    const { s, tick, air, gnd } = sky();
    s.air.push({ ...air('ring', 400, 320), x0: 400 });
    s.ground.push(gnd('dome', 600, 200));
    tick(1, bomb);
    tick(1, bomb);
    expect(s.bombs.length).toBe(1);
    tick(50);
    expect(s.score).toBe(0);
    const g2 = sky();
    g2.s.ground.push(g2.gnd('dome', 400, 300));
    g2.tick(1, fire);
    g2.tick(40);
    expect(g2.s.ground.some((g) => g.kind === 'dome')).toBe(true);
    expect(g2.s.score).toBe(0);
  });

  it('a tank takes two bombs (400)', () => {
    const { s, tick, gnd } = sky();
    s.ground.push(gnd('tank', 400, 295));
    s.ground[0]!.dir = 0;
    tick(1, bomb);
    tick(30);
    expect(s.score).toBe(0);
    s.ground[0]!.y = 295;
    tick(30);
    tick(1, bomb);
    tick(30);
    expect(s.score).toBe(400);
  });

  it('enemy shots and air enemies cost a life, with brief invulnerability after respawning', () => {
    const a = sky();
    a.s.bullets.push({ x: 400, y: 440, vx: 0, vy: 200, mine: false });
    a.tick(10);
    expect(a.s.lives).toBe(2);
    const b = sky();
    b.s.air.push(b.air('dart', 400, 460));
    b.tick(3);
    expect(b.s.lives).toBe(2);
    const c = sky();
    c.s.ship.invuln = 2;
    c.s.air.push(c.air('dart', 400, 460));
    c.tick(3);
    expect(c.s.lives).toBe(3);
  });

  it('air formations and ground installations keep arriving over time', () => {
    const { s, tick } = sky();
    s.airTimer = 0.1;
    s.groundTimer = 0.1;
    tick(60 * 6);
    expect(s.air.length + s.score).toBeGreaterThan(0);
    expect(s.ground.length).toBeGreaterThan(0);
  });

  it('at the end of the stage a fortress arrives and the usual spawning stops; 14 bombs destroy it (5000) and start the next stage', () => {
    const { s, tick, gnd } = sky();
    s.scroll = 9000;
    s.airTimer = 0.1;
    tick(5);
    expect(s.fortress).toBe(true);
    expect(s.ground.some((g) => g.kind === 'fortress')).toBe(true);
    s.airTimer = 0;
    s.groundTimer = 0;
    tick(30);
    const count = s.ground.length;
    tick(60);
    expect(s.ground.length).toBeLessThanOrEqual(count);
    // Put it right under the sight and bomb it to death.
    s.ship.invuln = 99;
    s.bullets = [];
    for (let k = 0; k < 14 && s.levelDelay <= 0; k++) {
      const fort = s.ground.find((g) => g.kind === 'fortress');
      if (fort) {
        fort.y = 320 - 25;
        fort.x = s.ship.x;
        fort.cd = 99;
      }
      s.bombs = [];
      tick(1, bomb);
      tick(32);
      s.ship.bombCd = 0;
    }
    expect(s.score).toBeGreaterThanOrEqual(5000);
    expect(s.levelDelay).toBeGreaterThan(0);
    tick(150);
    expect(s.level).toBe(2);
    expect(s.fortress).toBe(false);
    void gnd;
  });
});
