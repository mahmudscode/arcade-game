import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, ApiError, type Profile as ProfileData } from '../lib/api';
import { useAuth } from '../lib/auth';
import { NotFound } from './Simple';

export function Profile() {
  const { username = '' } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'offline' | 'ok'>('loading');

  useEffect(() => {
    let live = true;
    setState('loading');
    api.profile(username).then(
      (p) => live && (setData(p), setState('ok')),
      (e) => live && setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'offline'),
    );
    return () => {
      live = false;
    };
  }, [username]);

  if (state === 'missing') return <NotFound />;
  if (state === 'loading') return <p className="page-x pt-10 text-muted">Loading…</p>;
  if (state === 'offline' || !data) return <p className="page-x pt-10 text-muted">The server isn’t reachable right now.</p>;

  const { stats } = data;
  return (
    <div className="page-x pt-8 pb-8">
      <h1 className="font-pixel text-xl text-gold">{data.user.username.toUpperCase()}</h1>
      <p className="mt-3 text-sm text-muted">
        Joined {new Date(data.user.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {stats.verifiedRuns} verified {stats.verifiedRuns === 1 ? 'run' : 'runs'}
        {user?.username.toLowerCase() === data.user.username.toLowerCase() && <> · <Link to="/settings" className="text-gold underline">Settings</Link></>}
      </p>
      <h2 className="mt-8 font-semibold">Best scores</h2>
      {stats.games.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">No verified scores yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line/50 overflow-hidden rounded-2xl border border-line bg-ink-2">
          {stats.games.map((g) => (
            <li key={g.gameSlug} className="flex items-center px-5 py-3">
              <Link to={`/leaderboards?game=${g.gameSlug}`} className="flex-1 font-semibold hover:underline">{g.title}</Link>
              <span className="mr-6 text-xs text-muted">{g.verifiedRuns} {g.verifiedRuns === 1 ? 'run' : 'runs'}</span>
              <span className="font-pixel text-xs">{g.bestScore.toLocaleString('en-US')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** /profile with no name: your own page, or sign-in. */
export function MyProfile() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return <Navigate to={user ? `/profile/${user.username}` : '/login?next=/profile'} replace />;
}
