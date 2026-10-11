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

    for (const [slug, seed] of [['comet-crusher', 777], ['star-divers', 4242], ['jelly-pop', 99], ['capsule-clinic', 5], ['grid-tanker', 31], ['outpost-raid', 17], ['frost-shover', 8], ['garden-gates', 12], ['orchard-digger', 3], ['crypt-crawler', 21], ['orb-popper', 6], ['crystal-quarry', 14], ['vault-delver', 33], ['skyline-stomper', 9], ['tilt-track', 27], ['gold-raider', 4], ['barrel-brute', 19], ['pipe-bumper', 11], ['stack-chef', 7], ['bomb-hopper', 30], ['spring-sneak', 2], ['roo-rescue', 13], ['bubble-brawler', 22], ['lift-agent', 15], ['vine-climber', 41], ['sailor-slugger', 9], ['canopy-climb', 5], ['planet-patrol', 12], ['portal-patrol', 3], ['zone-striker', 8], ['altitude-raid', 26], ['peak-climber', 4], ['disc-warrior', 7], ['fruit-runner', 16], ['grave-knight', 23], ['deep-delver', 31], ['jungle-spitter', 5], ['shadow-agent', 18], ['ninja-strike', 27], ['route-rider', 9], ['dirt-rider', 35]] as const) {
      const def = (await loadGame(slug))!;
      let last: GameStatus | null = null;
      let atOver: GameStatus | null = null; // what the web client submits: the status when the game first ends
      const session = new GameSession(canvas as any, def, { seed, onStatus: (s) => ((last = s), s.over && !atOver && (atOver = s)) });
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
      // Compare with the status at the same moment the client reports it (a finished game restarts on Space).
      expect(verdict).toMatchObject({ score: ((atOver as GameStatus | null) ?? (last as GameStatus | null))!.score });
      if (slug === 'comet-crusher' || slug === 'star-divers') expect(last!.score).toBeGreaterThan(0);
    }
  });
});
