import { useEffect, useRef, useState } from 'react';
import { GameSession, type GameStatus } from '@arcade/engine';
import { loadGame } from '@arcade/games';
import { getHiScore, getSave, getVolume, setHiScore } from './storage';

export type LoadState = 'loading' | 'ready' | 'unavailable';

/** Loads a game chunk, runs it on the returned canvas ref, and mirrors its status into React state. */
export function useGameSession(slug: string, resume: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<GameSession<unknown> | null>(null);
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [paused, setPaused] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    let current: GameSession<unknown> | null = null;
    setLoadState('loading');
    setStatus(null);

    const unlockAudio = () => current?.audio.unlock();
    window.addEventListener('keydown', unlockAudio);

    void (async () => {
      const def = await loadGame(slug);
      if (cancelled) return;
      if (!def) return setLoadState('unavailable');
      // The canvas HUD uses a webfont; wait for it so the first frame doesn't fall back to monospace.
      await document.fonts?.load('14px "Press Start 2P"').catch(() => undefined);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;

      current = new GameSession(canvas, def, {
        hiScore: getHiScore(slug),
        onStatus: (s, p) => {
          setStatus(s);
          setPaused(p);
        },
        onHiScore: (score) => setHiScore(slug, score),
      });
      current.audio.volume = getVolume();
      const saved = resume ? getSave(slug) : null;
      if (saved) current.load(saved);
      current.start();
      setSession(current);
      setLoadState('ready');
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', unlockAudio);
      current?.destroy();
      setSession(null);
    };
  }, [slug, resume]);

  return { canvasRef, session, status, paused, loadState };
}
