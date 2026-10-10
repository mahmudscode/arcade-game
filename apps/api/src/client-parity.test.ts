import { GameSession, TICK, type GameStatus } from '@arcade/engine';
import { loadGame } from '@arcade/games';
import { describe, expect, it, vi } from 'vitest';
import { simulate } from './verifier';

/**
 * Drives the real browser GameSession (stubbed canvas + rAF) with key presses, then checks the
 * verifier reproduces the same score from the replay the session recorded.
 */
describe('client/verifier parity', () => {
  it('verifier reproduces the score of a real GameSession run', async () => {
    const g = globalThis as any;
    let frame: ((t: number) => void) | null = null;
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const noop = () => undefined;
    const ctx = new Proxy({}, { get: (_t, p) => (p === 'canvas' ? {} : p === 'measureText' ? () => ({ width: 0 }) : noop), set: () => true });
    g.window = { addEventListener: (k: string, f: any) => (listeners[k] ??= []).push(f), removeEventListener: noop };
    g.document = { addEventListener: noop, removeEventListener: noop, hidden: false };
    g.requestAnimationFrame = (f: (t: number) => void) => ((frame = f), 1);
    g.cancelAnimationFrame = noop;
    g.performance = { now: () => 0 };
    g.HTMLElement = class {};
    const canvas = { getContext: () => ctx, width: 0, height: 0 };

    for (const [slug, seed] of [['comet-crusher', 777], ['star-divers', 4242]] as const) {
      const def = (await loadGame(slug))!;
      let last: GameStatus | null = null;
      const session = new GameSession(canvas as any, def, { seed, onStatus: (s) => (last = s) });
      session.start();

      let now = 0;
      const key = (type: 'keydown' | 'keyup', code: string) => (listeners[type] ?? []).forEach((f) => f({ code, repeat: false, target: null, preventDefault: noop }));
      for (let i = 0; i < 1500; i++) {
        if (i % 90 === 0) key('keyup', i % 180 === 0 ? 'ArrowLeft' : 'ArrowRight'), key('keydown', i % 180 === 0 ? 'ArrowRight' : 'ArrowLeft');
        if (i % 12 === 0) key('keydown', 'Space');
        if (i % 12 === 6) key('keyup', 'Space');
        now += TICK * 1000 + (i % 3 === 0 ? 3 : -1); // uneven frame times, like a real display
        frame!(now);
      }
      const run = session.getReplay()!;
      session.destroy();
      expect(run.frames).toBeGreaterThan(1000);

      const bytes = Uint8Array.from(atob(run.replay), (c) => c.charCodeAt(0));
      const verdict = simulate(def, seed, bytes, run.frames);
      expect(verdict.ok).toBe(true);
      // Compare with the status at the same moment the client would report it.
      expect(verdict).toMatchObject({ score: last!.score });
      expect(last!.score).toBeGreaterThan(0);
    }
  });
});
