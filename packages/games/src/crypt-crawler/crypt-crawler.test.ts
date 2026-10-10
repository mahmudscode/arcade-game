import { describe, expect, it } from 'vitest';
import { NO_INPUT, TICK, createRng, runHeadless, type Input } from '@arcade/engine';
import cryptCrawler, { generateDungeon, visibleOnScreen, type CryptState } from './index';

const held = (over: Partial<Input['held']>, pressed: Partial<Input['pressed']> = {}): Input => ({
  held: { ...NO_INPUT.held, ...over },
  pressed: { ...NO_INPUT.pressed, ...pressed },
});

// A scripted "player": wander in a repeating pattern and press the action button.
const script = (f: number): Input => held({ left: f % 160 < 40, right: f % 160 >= 80 && f % 160 < 120, up: f % 160 >= 40 && f % 160 < 80, down: f % 160 >= 120 }, { a: f % 20 === 0 });

describe('crypt-crawler', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(cryptCrawler, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(cryptCrawler, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(cryptCrawler, { seed: 1, frames: 1200, inputAt: script });
    const b = runHeadless(cryptCrawler, { seed: 2, frames: 1200, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('keeps invariants: integer non-negative score, finite numbers everywhere', () => {
    const { state, status } = runHeadless(cryptCrawler, { seed: 7, frames: 12000, inputAt: script });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(cryptCrawler, { seed: 5, frames: 300, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('eventually ends when the player does nothing', () => {
    const { status } = runHeadless(cryptCrawler, { seed: 9, frames: 200000, inputAt: () => NO_INPUT });
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
    const s = cryptCrawler.init({ rng, hiScore: 0 });
    for (let f = 0; f < 1500; f++) {
      cryptCrawler.update(s, script(f), TICK, { rng, emit: () => undefined });
      if (f % 25 === 0) cryptCrawler.render(s, g, f / 60);
    }
    expect(bad).toEqual([]);
  });
});

const COLS = 19;
const i = (x: number, y: number) => y * COLS + x;

/** An open room (border walls only) with the player at (1, 5). */
function room() {
  const rng = createRng(5);
  const s: CryptState = cryptCrawler.init({ rng, hiScore: 0 });
  s.grid = s.grid.map((_, k) => {
    const x = k % COLS;
    const y = Math.floor(k / COLS);
    return x === 0 || y === 0 || x === COLS - 1 || y === 10 ? 1 : 0;
  });
  s.monsters = [];
  s.bullets = [];
  Object.assign(s.me, { tx: 1, ty: 5, dx: 0, dy: 0, p: 0, fx: 1, fy: 0, invuln: 0 });
  const tick = (n: number, input: Input = NO_INPUT) => { for (let k = 0; k < n; k++) cryptCrawler.update(s, input, TICK, { rng, emit: () => undefined }); };
  const mon = (x: number, y: number, kind: 0 | 1 | 2 = 0, cd = 1e9) => ({ tx: x, ty: y, dx: 0, dy: 0, p: 0, kind, cd });
  return { s, tick, mon };
}
const fire = held({}, { a: true });

describe('crypt-crawler rules', () => {
  it.each([[0, 100], [1, 200], [2, 500]] as const)('a shot kills monster tier %i for %i points', (kind, points) => {
    const { s, tick, mon } = room();
    // One target in a dead-end corridor facing the shooter, one sealed in a pocket (it keeps the wave going).
    for (const [x, y] of [[10, 4], [11, 4], [12, 4], [10, 6], [11, 6], [12, 6], [13, 5], [11, 9], [13, 9], [12, 8]] as const) s.grid[i(x, y)] = 1;
    s.monsters.push(mon(12, 5, kind), mon(12, 9, 0));
    tick(1, fire);
    tick(60);
    expect(s.monsters).toHaveLength(1);
    expect(s.score).toBe(points);
  });

  it('walls stop shots, and only one of your shots flies at a time', () => {
    const a = room();
    a.s.grid[i(5, 5)] = 1;
    a.s.monsters.push(a.mon(9, 5));
    a.tick(1, fire);
    a.tick(40);
    expect(a.s.monsters).toHaveLength(1);
    expect(a.s.score).toBe(0);

    const b = room();
    b.s.monsters.push(b.mon(17, 9));
    b.tick(1, fire);
    b.tick(1, fire);
    expect(b.s.bullets.filter((x) => x.mine)).toHaveLength(1);
  });

  it('a monster with a clear line fires, and its shot kills the player', () => {
    const { s, tick, mon } = room();
    s.monsters.push(mon(9, 5, 0, 0));
    tick(90);
    expect(s.lives).toBe(2);
  });

  it('a monster behind a wall holds its fire', () => {
    const { s, tick, mon } = room();
    s.grid[i(5, 5)] = 1;
    s.monsters.push(mon(9, 5, 0, 0));
    s.monsters[0]!.dx = 0;
    tick(1);
    expect(s.bullets.filter((b) => !b.mine)).toHaveLength(0);
  });

  it('touching a monster is fatal, except right after respawning', () => {
    const a = room();
    a.s.monsters.push(a.mon(1, 5));
    a.tick(2);
    expect(a.s.lives).toBe(2);

    const b = room();
    b.s.me.invuln = 2;
    b.s.monsters.push(b.mon(1, 5));
    b.tick(2);
    expect(b.s.lives).toBe(3);
  });

  it('the last monsters rush faster', () => {
    const run = (extra: number) => {
      const { s, tick, mon } = room();
      s.grid = s.grid.map((_, k) => (Math.floor(k / COLS) === 5 && k % COLS >= 1 && k % COLS <= 17 ? 0 : 1));
      s.me.alive = false; // keep the player out of the way
      s.respawn = 1e9;
      s.monsters.push({ ...mon(17, 5), dx: -1 });
      for (let k = 0; k < extra; k++) s.monsters.push({ ...mon(18, 5), dx: -1 }); // more monsters, so no rush
      tick(60);
      return s.monsters[0]!.tx;
    };
    expect(run(0)).toBeLessThan(run(3));
  });

  it('clearing the dungeon starts the next, bigger one', () => {
    const { s, tick } = room();
    tick(1);
    tick(150);
    expect(s.wave).toBe(2);
    expect(s.monsters.length).toBeGreaterThan(6);
    expect(s.monsters.some((m) => m.kind === 1)).toBe(true);
  });

  it('every generated dungeon is fully connected, with its pillars in place', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const grid = generateDungeon(createRng(seed));
      expect(grid[i(2, 2)]).toBe(1);
      expect(grid[i(1, 1)]).toBe(0);
      expect(grid[i(1, 9)]).toBe(0);
      const seen = new Set([i(1, 1)]);
      const q = [i(1, 1)];
      for (let h = 0; h < q.length; h++) {
        const c = q[h]!;
        for (const n of [c - 1, c + 1, c - COLS, c + COLS]) if (grid[n] === 0 && !seen.has(n)) (seen.add(n), q.push(n));
      }
      expect(seen.size).toBe(grid.filter((c) => c === 0).length);
    }
  });

  it('garwors are only visible up close', () => {
    const { s, mon } = room();
    expect(visibleOnScreen(s, mon(15, 5, 1))).toBe(false);
    expect(visibleOnScreen(s, mon(3, 5, 1))).toBe(true);
    expect(visibleOnScreen(s, mon(15, 5, 0))).toBe(true);
  });
});
