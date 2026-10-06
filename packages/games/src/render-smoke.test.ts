import { describe, expect, it } from 'vitest';
import { NO_INPUT, runHeadless, type GameDefinition, type Input } from '@arcade/engine';
import { loadGame, playableSlugs } from './index';

/** A canvas context that accepts any call, so render() can run without a DOM. */
function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, key) => {
      if (key in t) return t[key as string];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => gradient;
      if (key === 'measureText') return () => ({ width: 10 });
      return () => undefined;
    },
    set: (t, key, value) => {
      t[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const script = (f: number): Input => ({
  held: { ...NO_INPUT.held, left: f % 200 < 80, right: f % 200 >= 100 && f % 200 < 180, up: f % 90 < 20, a: f % 12 < 6 },
  pressed: { ...NO_INPUT.pressed, a: f % 12 === 0 },
});

const slugs = playableSlugs();

describe('every game renders', () => {
  for (const slug of slugs) {
    it(slug, async () => {
      const game = (await loadGame(slug)) as GameDefinition<unknown> | null;
      expect(game, `${slug} must be registered in the games index`).not.toBeNull();
      expect(game!.id).toBe(slug);
      for (const frames of [0, 5, 900, 5000]) {
        const { state } = runHeadless(game!, { seed: 4, frames, inputAt: script });
        expect(() => game!.render(state, fakeContext(), frames / 60)).not.toThrow();
      }
    });
  }
});
