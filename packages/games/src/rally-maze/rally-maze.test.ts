import { describe, expect, it } from 'vitest';
import { createRng, NO_INPUT, runHeadless, TICK, type Input } from '@arcade/engine';
import { MCOLS, MROWS } from '../_shared/maze-chase';
import game from './index';

const held = (over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: NO_INPUT.pressed });
const press = (f: number, over: Partial<Input['held']>): Input => ({ held: { ...NO_INPUT.held, ...over }, pressed: { ...NO_INPUT.pressed, ...over } });

const script = (f: number): Input => { const k = f % 360; return press(f, { up: k < 60, right: k >= 60 && k < 140, down: k >= 140 && k < 200, left: k >= 200 && k < 300, b: f % 150 === 0 }); };

describe('rally-maze', () => {
  it('is deterministic: same seed and inputs give the same final state', () => {
    const a = runHeadless(game, { seed: 42, frames: 3600, inputAt: script });
    const b = runHeadless(game, { seed: 42, frames: 3600, inputAt: script });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('different seeds diverge', () => {
    const a = runHeadless(game, { seed: 1, frames: 1800, inputAt: script });
    const b = runHeadless(game, { seed: 2, frames: 1800, inputAt: script });
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('scores points: a bot that drives to the nearest flag collects some', () => {
    const rng = createRng(3);
    const s = game.init({ rng, hiScore: 0 });
    const dirs = [[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']] as const;
    for (let f = 0; f < 3000 && !s.over; f++) {
      const start = s.player.cx + s.player.cy * MCOLS;
      const prev = new Map<number, number>([[start, -1]]);
      const queue = [start];
      let goal = -1;
      for (let h = 0; h < queue.length && goal < 0; h++) {
        const c = queue[h]!;
        if (s.flags.some((fl) => fl.x + fl.y * MCOLS === c)) goal = c;
        for (const [dx, dy] of dirs) {
          const x = (c % MCOLS) + dx;
          const y = Math.floor(c / MCOLS) + dy;
          if (x < 0 || y < 0 || x >= MCOLS || y >= MROWS || s.walls[y * MCOLS + x] === 1 || prev.has(y * MCOLS + x)) continue;
          prev.set(y * MCOLS + x, c);
          queue.push(y * MCOLS + x);
        }
      }
      let step: Partial<Input['held']> = {};
      if (goal >= 0 && goal !== start) {
        let c = goal;
        while (prev.get(c) !== start) c = prev.get(c)!;
        const d = dirs.find((e) => e[0] === (c % MCOLS) - s.player.cx && e[1] === Math.floor(c / MCOLS) - s.player.cy);
        if (d) step = { [d[2]]: true };
      }
      game.update(s, { held: { ...NO_INPUT.held, ...step }, pressed: NO_INPUT.pressed }, TICK, { rng, emit: () => undefined });
    }
    expect(game.status(s).score).toBeGreaterThan(0);
  });

  it('ends the game if the player never fights back', () => {
    const { status } = runHeadless(game, { seed: 4, frames: 60000, inputAt: () => NO_INPUT });
    expect(status.over).toBe(true);
  });

  it('keeps invariants: integer non-negative score, sane status', () => {
    const { status } = runHeadless(game, {
      seed: 7,
      frames: 10000,
      inputAt: (f) => press(f, { left: (f * 7) % 5 === 0, right: (f * 3) % 7 === 0, up: (f * 5) % 11 === 0, down: (f * 5) % 13 === 0, a: f % 2 === 0, b: f % 97 === 0 }),
    });
    expect(Number.isInteger(status.score) && status.score >= 0).toBe(true);
    expect(status.lives).toBeGreaterThanOrEqual(0);
    expect(status.level).toBeGreaterThanOrEqual(1);
  });

  it('is saveable: state survives a JSON round-trip', () => {
    const { state } = runHeadless(game, { seed: 5, frames: 600, inputAt: script });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
