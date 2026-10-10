import { useEffect, useRef, useState } from 'react';
import { GameSession, type GameStatus } from '@arcade/engine';
import { loadGame } from '@arcade/games';
import { api, ApiError } from './api';
import { useAuth } from './auth';
import { buildKeyMap, getSettings } from './settings';
import { getHiScore, getSave, setHiScore } from './storage';

export type LoadState = 'loading' | 'ready' | 'unavailable';

/** Where a finished run's score ended up. `local` means it only counts for this browser. */
export type SubmitState =
  | { kind: 'idle' }
  | { kind: 'local'; reason: 'guest' | 'offline' | 'resumed' }
  | { kind: 'sending' }
  | { kind: 'pending'; score: number }
  | { kind: 'error'; message: string };

/**
 * Loads a game chunk, runs it on the returned canvas ref, and mirrors its status into React state.
 * Signed-in players get a server-issued seed so the run can be verified; everyone else plays with a
 * local seed and keeps scores in the browser.
 */
export function useGameSession(slug: string, resume: boolean) {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<GameSession<unknown> | null>(null);
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [paused, setPaused] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!ready) return; // wait for /me so we know whether to ask for a server seed
    let cancelled = false;
    let current: GameSession<unknown> | null = null;
    setLoadState('loading');
    setStatus(null);
    setSubmit({ kind: 'idle' });

    const unlockAudio = () => current?.audio.unlock();
    window.addEventListener('keydown', unlockAudio);

    void (async () => {
      const def = await loadGame(slug);
      if (cancelled) return;
      if (!def) return setLoadState('unavailable');

      const saved = resume ? getSave(slug) : null;
      let play: { sessionId: string; seed: number } | null = null;
      if (userId && !saved) {
        play = await api.createSession(slug).catch((e) => {
          if (!(e instanceof ApiError) || e.status !== 0) console.warn('session failed', e);
          return null;
        });
      }
      if (cancelled) return;
      // The canvas HUD uses a webfont; wait for it so the first frame doesn't fall back to monospace.
      await document.fonts?.load('14px "Press Start 2P"').catch(() => undefined);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;

      const settings = getSettings();
      let sent = false;
      const sessionRef: { s?: GameSession<unknown> } = {};
      current = new GameSession(canvas, def, {
        seed: play?.seed,
        hiScore: getHiScore(slug),
        keyMap: buildKeyMap(settings.keys),
        onStatus: (s, p) => {
          setStatus(s);
          setPaused(p);
          if (!s.over || sent) return;
          sent = true;
          const run = sessionRef.s?.getReplay();
          if (!userId) return setSubmit({ kind: 'local', reason: 'guest' });
          if (!play || !run) return setSubmit({ kind: 'local', reason: saved ? 'resumed' : 'offline' });
          setSubmit({ kind: 'sending' });
          api
            .submitScore(
              { sessionId: play.sessionId, score: s.score, levelReached: s.level, durationMs: Math.round((run.frames / 60) * 1000), replay: run.replay },
              play.sessionId,
            )
            .then(() => setSubmit({ kind: 'pending', score: s.score }))
            .catch((e: Error) => setSubmit({ kind: 'error', message: e.message }));
        },
        onHiScore: (score) => setHiScore(slug, score),
      });
      sessionRef.s = current;
      current.audio.volume = settings.volume;
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
  }, [slug, resume, ready, userId, runId]);

  /** Starts a fresh run (new server session, so the old replay can't be reused). */
  const newRun = () => setRunId((n) => n + 1);

  return { canvasRef, session, status, paused, loadState, submit, newRun };
}
