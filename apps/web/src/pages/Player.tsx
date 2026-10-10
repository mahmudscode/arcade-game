import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CATEGORIES, GAMES, formatPlays, getGame, type GameMeta } from '@arcade/shared';
import { Sprite, Thumb } from '../components/Sprite';
import { TouchPad } from '../components/TouchPad';
import { ChevronLeftIcon, FullscreenIcon, HeartIcon, PauseIcon, PlayIcon } from '../components/icons';
import { useGameSession, type SubmitState } from '../lib/useGameSession';
import { getHiScore, putSave, useFavorites } from '../lib/storage';
import { updateSettings, useSettings } from '../lib/settings';
import { useAuth } from '../lib/auth';
import { NotFound } from './Simple';
import { useRef } from 'react';

// Sample data until the leaderboard API exists.
const SAMPLE_SCORES = [
  { name: 'NOVA_K', score: 182400 },
  { name: 'ByteRider', score: 176950 },
  { name: 'mahi_bd', score: 161200 },
  { name: 'PX_Queen', score: 158075 },
];

const pad = (n: number) => String(n).padStart(6, '0');
const fmt = (n: number) => n.toLocaleString('en-US');

export function Player() {
  const { slug = '' } = useParams();
  const game = getGame(slug);
  return game ? <PlayerView key={game.slug} game={game} /> : <NotFound />;
}

function PlayerView({ game }: { game: GameMeta }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { canvasRef, session, status, paused, loadState, submit, newRun } = useGameSession(game.slug, params.get('resume') === '1');
  const { favs, toggle } = useFavorites();
  const frameRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const { volume } = useSettings();
  const { user } = useAuth();
  const fav = favs.has(game.slug);
  const categoryLabel = CATEGORIES.find((c) => c.id === game.category)?.label ?? game.category;
  const playable = loadState !== 'unavailable';
  const hi = Math.max(status?.hiScore ?? 0, getHiScore(game.slug));

  useEffect(() => {
    document.title = `${game.title} · Arcade Hub`;
    return () => {
      document.title = 'Arcade Hub';
    };
  }, [game.title]);

  const flash = (set: (v: boolean) => void) => {
    set(true);
    window.setTimeout(() => set(false), 1800);
  };

  const save = () => {
    if (!session) return;
    putSave(game.slug, session.save());
    flash(setSaved);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash(setShared);
    } catch {
      // Clipboard can be unavailable (insecure context); nothing else to do.
    }
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  };

  const similar = [...GAMES.filter((g) => g.category === game.category && g.slug !== game.slug), ...GAMES.filter((g) => g.category !== game.category && g.slug !== game.slug)].slice(0, 3);

  return (
    <div className="page-x pt-4 md:pt-8">
      {/* Mobile top bar */}
      <div className="mb-3 grid grid-cols-[40px_1fr_40px] items-center md:hidden">
        <button type="button" onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full bg-ink-3" aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="text-center">
          <p className="font-pixel text-[11px] text-gold">{game.title.toUpperCase()}</p>
          {status && <p className="mt-1 text-[11px] text-muted">Wave {status.level}</p>}
        </div>
        <button type="button" onClick={() => (paused ? session?.resume() : session?.pause())} disabled={!session} className="grid size-9 place-items-center rounded-full bg-ink-3 disabled:opacity-40" aria-label={paused ? 'Resume' : 'Pause'}>
          {paused ? <PlayIcon width={16} height={16} /> : <PauseIcon width={16} height={16} />}
        </button>
      </div>

      <nav aria-label="Breadcrumb" className="mb-5 hidden text-sm text-muted md:block">
        <Link to="/" className="hover:text-paper">Games</Link> / <Link to={`/?q=${game.category}`} className="hover:text-paper">{categoryLabel}</Link> /{' '}
        <span className="text-paper">{game.title}</span>
      </nav>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
        <div>
          <div ref={frameRef} className="rounded-[26px] border-[3px] border-line bg-[#0d0819] p-2.5 md:p-3">
            <div className="relative aspect-[800/570] overflow-hidden rounded-2xl bg-[#120a2a]">
              {playable ? (
                <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label={`${game.title} game screen`} />
              ) : (
                <>
                  <Thumb slug={game.slug} className="absolute inset-0 size-full opacity-60" />
                  <div className="absolute inset-0 grid place-items-center bg-ink/60 text-center">
                    <div>
                      <Sprite slug={game.slug} className="mx-auto w-24" />
                      <p className="mt-6 font-pixel text-sm text-gold">COMING SOON</p>
                      <p className="mx-auto mt-3 max-w-xs px-4 text-sm text-muted">{game.title} isn't playable yet. Try Comet Crusher.</p>
                      <Link to="/play/comet-crusher" className="btn btn-gold mt-5 h-10 px-6">Play Comet Crusher</Link>
                    </div>
                  </div>
                </>
              )}
              {playable && loadState === 'loading' && <div className="absolute inset-0 grid place-items-center font-pixel text-xs text-muted">LOADING…</div>}
              {paused && (
                <div className="absolute inset-0 grid place-items-center bg-ink/70">
                  <button type="button" onClick={() => session?.resume()} className="btn btn-gold h-12 px-8">Resume</button>
                </div>
              )}
            </div>
          </div>

          {/* Desktop / tablet control bar */}
          <div className="mt-4 hidden items-center gap-3 rounded-2xl border border-line bg-ink-2 p-3 md:flex">
            <button type="button" className="btn btn-soft h-10 px-6" disabled={!session} onClick={() => (paused ? session?.resume() : session?.pause())}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" className="btn btn-soft h-10 px-6" disabled={!session} onClick={newRun}>Restart</button>
            <button type="button" className="btn btn-soft h-10 px-6" disabled={!session} onClick={save}>{saved ? 'Saved ✓' : 'Save state'}</button>
            <label className="ml-auto flex items-center gap-3 text-sm text-muted">
              Sound
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateSettings({ volume: v });
                  if (session) session.audio.volume = v;
                }}
                className="w-28 accent-cyan"
              />
            </label>
            <button type="button" onClick={fullscreen} aria-label="Toggle fullscreen" className="grid size-10 place-items-center rounded-full bg-ink-3 hover:bg-line">
              <FullscreenIcon width={18} height={18} />
            </button>
          </div>

          <ScoreNotice submit={submit} signedIn={!!user} onAgain={newRun} />

          {/* Mobile score bar + controller */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-ink-2 px-4 py-3 md:hidden">
            <span className="font-pixel text-[11px]">SCORE {pad(status?.score ?? 0)}</span>
            <span className="flex gap-1.5 text-coral" aria-label={`${status?.lives ?? 0} lives`}>
              {Array.from({ length: status?.lives ?? 0 }, (_, i) => <HeartIcon key={i} width={14} height={14} filled />)}
            </span>
          </div>
          {session && <TouchPad press={(b, d) => session.press(b, d)} labels={game.touch} />}
        </div>

        <aside className="hidden md:block">
          <h1 className="font-pixel text-[20px] leading-snug text-gold">{game.title.toUpperCase()}</h1>
          <p className="mt-3 text-sm text-muted">
            {game.category} · {game.players} · Rated {game.rating} by {fmt(game.ratingCount)} players
          </p>
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={() => toggle(game.slug)} aria-pressed={fav} className="btn btn-outline h-12 px-8">
              {fav ? 'Favorited' : 'Favorite'}
            </button>
            <button type="button" onClick={share} className="btn btn-outline h-12 px-8">{shared ? 'Link copied' : 'Share'}</button>
          </div>

          <section className="mt-6 rounded-2xl border border-line bg-ink-2 p-5">
            <h2 className="font-semibold">How to play</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {game.controls.map((c) => (
                <li key={c.label} className="flex items-center gap-3">
                  <span className="flex min-w-[72px] gap-1">
                    {c.keys.map((k) => (
                      <kbd key={k} className="rounded-md border border-line bg-ink-3 px-2 py-0.5 font-sans text-xs font-semibold">{k}</kbd>
                    ))}
                  </span>
                  <span className="text-muted">{c.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5 rounded-2xl border border-line bg-ink-2 p-5">
            <h2 className="font-semibold">Top scores this week</h2>
            <ol className="mt-3 space-y-1">
              {SAMPLE_SCORES.map((s, i) => (
                <li key={s.name} className="flex items-center px-2 py-1.5 text-sm">
                  <span className="w-9 font-pixel text-[11px] text-muted">{i + 1}</span>
                  <span className={`flex-1 font-semibold ${i === 0 ? 'text-gold' : ''}`}>{s.name}</span>
                  <span className={`font-pixel text-[11px] ${i === 0 ? 'text-gold' : ''}`}>{fmt(s.score)}</span>
                </li>
              ))}
              <li className="flex items-center rounded-lg bg-ink-3 px-2 py-1.5 text-sm">
                <span className="w-9 font-pixel text-[11px] text-muted">—</span>
                <span className="flex-1 font-semibold text-cyan">You</span>
                <span className="font-pixel text-[11px] text-cyan">{fmt(hi)}</span>
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted">Sample leaderboard. Real rankings arrive once scores are verified.</p>
          </section>

          <section className="mt-6">
            <h2 className="font-semibold">More like this</h2>
            <ul className="mt-3 space-y-3">
              {similar.map((g) => (
                <li key={g.slug}>
                  <Link to={`/play/${g.slug}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-ink-2">
                    <Thumb slug={g.slug} className="h-12 w-[60px] shrink-0 rounded-lg" />
                    <span>
                      <span className="block text-sm font-semibold">{g.title}</span>
                      <span className="block text-xs text-muted">{g.category} · {formatPlays(g.plays)} plays</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ScoreNotice({ submit, signedIn, onAgain }: { submit: SubmitState; signedIn: boolean; onAgain: () => void }) {
  if (submit.kind === 'idle') return null;
  const text =
    submit.kind === 'sending' ? 'Submitting your score…'
    : submit.kind === 'pending' ? `Score ${fmt(submit.score)} submitted. Pending verification.`
    : submit.kind === 'error' ? `Couldn't submit your score: ${submit.message}`
    : submit.reason === 'guest' ? 'Sign in to submit scores. This run counts for this browser only.'
    : submit.reason === 'resumed' ? 'Runs continued from a saved state can’t be verified, so this score stays on this browser.'
    : 'The server isn’t reachable, so this score stays on this browser.';
  return (
    <div role="status" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm">
      <span className="flex-1 text-muted">{text}</span>
      {submit.kind === 'local' && submit.reason === 'guest' && !signedIn && <Link to="/login" className="btn btn-gold h-9 px-5">Sign in</Link>}
      {submit.kind !== 'sending' && <button type="button" className="btn btn-soft h-9 px-5" onClick={onAgain}>Play again</button>}
    </div>
  );
}
