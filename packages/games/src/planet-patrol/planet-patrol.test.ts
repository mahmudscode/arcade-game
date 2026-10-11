import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import planetPatrol from './index';
import { WORLD, groundAt, wrapDx, type DefenderState } from '../_shared/defender';

const GAME = planetPatrol;

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 300 < 80, right: f % 300 >= 120 && f % 300 < 220, up: f % 300 >= 220 && f % 300 < 260, down: f % 300 >= 260, a: f % 6 < 3 }, { b: f % 500 === 499 });

describe('planet-patrol', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(planetPatrol, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(planetPatrol, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(planetPatrol, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(planetPatrol, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(planetPatrol, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(planetPatrol, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(planetPatrol, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = planetPatrol.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      planetPatrol.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) planetPatrol.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const arenaOf = () => {
  const rng = createRng(5);
  const s: DefenderState = GAME.init({ rng, hiScore: 0 });
  s.foes = [];
  s.shots = [];
  s.mines = [];
  s.queue = 5; // keeps the wave open
  s.arrive = 1e9;
  s.ship.invuln = 0;
  Object.assign(s.ship, { x: 1000, y: 250, vx: 0, vy: 0, face: 1 });
  s.humans.forEach((h, k) => Object.assign(h, { x: 1600 + k * 100, y: groundAt(s, 1600 + k * 100) - 8, state: 'walk', dir: 0 }));
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) GAME.update(s, input, TICK, { rng, emit: () => undefined }); };
  const foe = (kind: string, x: number, y: number) => ({ kind, x, y, vx: 0, vy: 0, human: -1, carrying: false, cd: 99, t: 0 }) as unknown as DefenderState['foes'][number];
  return { s, tick, foe };
};

describe(`${GAME.id} rules`, () => {
  it('wrapDx is the shortest signed distance around the planet', () => {
    expect(wrapDx(100, 300)).toBe(200);
    expect(wrapDx(3100, 100)).toBe(200);
    expect(wrapDx(100, 3100)).toBe(-200);
    expect(Math.abs(wrapDx(0, WORLD / 2))).toBe(WORLD / 2);
  });

  it('thrust accelerates in the facing direction, coasts when released, reverses on the opposite key, and the world wraps', () => {
    const { s, tick } = arenaOf();
    tick(30, held({ right: true }));
    expect(s.ship.vx).toBeGreaterThan(200);
    expect(s.ship.face).toBe(1);
    const x1 = s.ship.x;
    tick(30);
    expect(s.ship.x).toBeGreaterThan(x1);
    expect(s.ship.vx).toBeGreaterThan(0);
    expect(s.ship.vx).toBeLessThan(520.1);
    tick(60, held({ left: true }));
    expect(s.ship.face).toBe(-1);
    expect(s.ship.vx).toBeLessThan(0);
    s.ship.x = 20;
    s.ship.vx = -400;
    tick(20, held({ left: true }));
    expect(s.ship.x).toBeGreaterThan(WORLD - 400);
  });

  it('up and down fly the ship within the sky, never below the ground or above the radar band', () => {
    const { s, tick } = arenaOf();
    tick(240, held({ down: true }));
    expect(s.ship.y).toBeLessThanOrEqual(groundAt(s, s.ship.x) - 17);
    tick(240, held({ up: true }));
    expect(s.ship.y).toBeGreaterThanOrEqual(80);
  });

  it('the laser kills a lander in front of the ship (150) and expires', () => {
    const { s, tick, foe } = arenaOf();
    s.foes.push(foe('lander', 1300, 250));
    tick(1, held({ a: true }));
    tick(30);
    expect(s.foes).toHaveLength(0);
    expect(s.score).toBe(150);
    expect(s.shots).toHaveLength(0);
  });

  it('a lander flies to a humanoid, picks it up and carries it to the top, where it becomes a mutant and the humanoid is lost', () => {
    const { s, tick, foe } = arenaOf();
    Object.assign(s.ship, { x: 100, y: 450 });
    const l = foe('lander', 1620, 150);
    s.foes.push(l);
    tick(60 * 9);
    expect(l.carrying).toBe(true);
    expect(s.humans.some((h) => (h.state as string) === 'carried')).toBe(true);
    tick(60 * 10);
    expect(l.kind).toBe('mutant');
    expect(s.humans.filter((h) => h.state === 'dead')).toHaveLength(1);
  });

  it('shooting a carrying lander drops the humanoid; catching it scores 500 and setting it down on the ground another 500', () => {
    const { s, tick, foe } = arenaOf();
    const l = foe('lander', 1620, 250);
    l.carrying = true;
    l.human = 0;
    s.humans[0]!.state = 'carried';
    s.foes.push(l);
    Object.assign(s.ship, { x: 1450, y: 250, face: 1 });
    tick(1, held({ a: true }));
    tick(12);
    expect(s.humans[0]!.state as string).toBe('fall');
    // Fly under it and catch it.
    for (let f = 0; f < 90 && (s.humans[0]!.state as string) === 'fall'; f++) {
      const h = s.humans[0]!;
      s.ship.x = h.x;
      s.ship.y = h.y - 5;
      tick(1);
    }
    expect(s.humans[0]!.state as string).toBe('held');
    const caught = s.score;
    for (let f = 0; f < 200 && (s.humans[0]!.state as string) === 'held'; f++) tick(1, held({ down: true }));
    expect(s.humans[0]!.state as string).toBe('walk');
    expect(s.score).toBeGreaterThanOrEqual(caught + 500);
  });

  it('a humanoid dropped from a great height dies on landing; a short fall is survived (250)', () => {
    const high = arenaOf();
    Object.assign(high.s.ship, { x: 100, y: 450 });
    Object.assign(high.s.humans[0]!, { state: 'fall', y: 90, vy: 0, fromY: 90, x: 1600 });
    high.tick(60 * 5);
    expect(high.s.humans[0]!.state).toBe('dead');

    const low = arenaOf();
    Object.assign(low.s.ship, { x: 100, y: 120 });
    const gy = groundAt(low.s, 1600) - 8;
    Object.assign(low.s.humans[0]!, { state: 'fall', y: gy - 100, vy: 0, fromY: gy - 100, x: 1600 });
    low.tick(60 * 3);
    expect(low.s.humans[0]!.state).toBe('walk');
    expect(low.s.score).toBe(250);
  });

  it('the smart bomb clears foes near the ship (not far ones), uses up a bomb, and does nothing when none are left', () => {
    const { s, tick, foe } = arenaOf();
    s.foes.push(foe('mutant', 1200, 200), foe('mutant', 1300, 300), foe('mutant', 2600, 200));
    tick(1, held({}, { b: true }));
    expect(s.foes).toHaveLength(1);
    expect(s.ship.bombs).toBe(2);
    s.ship.bombs = 0;
    s.foes.push(foe('mutant', 1100, 200));
    tick(1, held({}, { b: true }));
    expect(s.foes).toHaveLength(2);
  });

  it('losing every humanoid destroys the planet and turns landers into mutants', () => {
    const { s, tick, foe } = arenaOf();
    s.foes.push(foe('lander', 2800, 200));
    for (const h of s.humans) h.state = 'dead';
    tick(2);
    expect(s.planet).toBe(false);
    expect(s.foes[0]!.kind).toBe('mutant');
  });

  it('mutants chase and shoot; a hit costs a life, and the respawned ship is briefly invulnerable', () => {
    const { s, tick, foe } = arenaOf();
    const m = foe('mutant', 1400, 250);
    m.cd = 0;
    s.foes.push(m);
    for (let f = 0; f < 60 * 5 && s.lives === 3; f++) tick(1);
    expect(s.lives).toBe(2);
    expect(s.ship.alive).toBe(false);
    let invulnOnRespawn = 0;
    for (let f = 0; f < 60 * 4; f++) {
      tick(1);
      if (s.ship.alive) {
        invulnOnRespawn = s.ship.invuln;
        break;
      }
    }
    expect(invulnOnRespawn).toBeGreaterThan(2);
  });

  it('if the wave drags on, a fast baiter shows up to hurry you along', () => {
    const { s, tick, foe } = arenaOf();
    s.foes.push(foe('lander', 2800, 200));
    s.waveTime = 44.9;
    tick(20);
    expect(s.foes.some((f) => f.kind === 'baiter')).toBe(true);
  });

  it('clearing the wave pays 100 x round per surviving humanoid and starts the next wave with a fresh planet', () => {
    const { s, tick } = arenaOf();
    s.queue = 0;
    tick(2);
    expect(s.levelDelay).toBeGreaterThan(0);
    expect(s.score).toBe(10 * 100);
    tick(200);
    expect(s.level).toBe(2);
    expect(s.humans.every((h) => h.state === 'walk')).toBe(true);
    expect(s.foes.length).toBeGreaterThanOrEqual(4);
  });
});
