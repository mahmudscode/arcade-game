import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

const field = 'mt-1.5 h-12 w-full rounded-xl border border-line bg-ink-2 px-4 text-paper placeholder:text-muted focus-visible:outline-gold';

export function Login() {
  const { user, ready, login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Only follow same-site paths so /login?next= can't bounce a player to another origin.
  const next = params.get('next');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (ready && user) return <Navigate to={dest} replace />;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const password = String(f.get('password'));
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, String(f.get('username')), password);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0 ? 'The server isn’t reachable. You can still play as a guest.'
        : err instanceof ApiError && err.code === 'validation_error' ? 'Check your details: username is 3-20 letters, numbers or _, password at least 8 characters.'
        : err instanceof Error ? err.message : 'Something went wrong',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-x pt-10">
      <div className="mx-auto max-w-md">
        <h1 className="font-pixel text-xl text-gold">{mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</h1>
        <p className="mt-3 text-sm text-muted">Accounts let you submit scores for verification and show up on leaderboards. Guests can always play.</p>

        <div role="tablist" className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-ink-2 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(''); }} className={`btn h-10 ${mode === m ? 'btn-gold' : 'text-muted'}`}>
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold">
            Email
            <input name="email" type="email" required autoComplete="email" maxLength={254} className={field} />
          </label>
          {mode === 'register' && (
            <label className="block text-sm font-semibold">
              Username
              <input name="username" required pattern="[A-Za-z0-9_]{3,20}" title="3-20 letters, numbers or underscores" autoComplete="username" className={field} />
            </label>
          )}
          <label className="block text-sm font-semibold">
            Password
            <input name="password" type="password" required minLength={mode === 'register' ? 8 : 1} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={field} />
          </label>
          {error && <p role="alert" className="rounded-xl border border-coral/60 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-gold h-12 w-full disabled:opacity-60">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
