import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { REMAPPABLE, keyLabel, keysFor, updateSettings, useSettings } from '../lib/settings';
import { captureKey, type Button } from '@arcade/engine';

const card = 'rounded-2xl border border-line bg-ink-2 p-5';

export function Settings() {
  const s = useSettings();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [capturing, setCapturing] = useState<Button | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const cap = captureKey();
    void cap.result.then((code) => {
      if (code) {
        // A key belongs to one action: take it from any other button that still has it.
        const keys = { ...s.keys };
        for (const { button } of REMAPPABLE) {
          const before = keysFor(button, keys);
          const after = before.filter((c) => c !== code);
          if (after.length !== before.length) keys[button] = after;
        }
        keys[capturing] = [code];
        updateSettings({ keys });
      }
      setCapturing(null);
    });
    return cap.cancel;
  }, [capturing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-x pt-8 pb-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">Account</h2>
          {user ? (
            <>
              <p className="mt-3 text-sm text-muted">Signed in as <span className="font-semibold text-paper">{user.username}</span> ({user.email})</p>
              <button type="button" className="btn btn-outline mt-4 h-10 px-6" onClick={async () => { await logout(); navigate('/'); }}>Sign out</button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted">Sign in to submit scores for verification.</p>
              <Link to="/login" className="btn btn-gold mt-4 h-10 px-6">Sign in</Link>
            </>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">Sound and motion</h2>
          <label className="mt-4 flex items-center gap-4 text-sm text-muted">
            Volume
            <input type="range" min={0} max={1} step={0.01} value={s.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} className="flex-1 accent-cyan" />
            <span className="w-10 text-right text-paper">{Math.round(s.volume * 100)}%</span>
          </label>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={s.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} className="size-4 accent-gold" />
            Reduce motion (turns off animations and transitions in the site)
          </label>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Keyboard controls</h2>
            <button type="button" className="btn btn-soft h-9 px-5" onClick={() => updateSettings({ keys: {} })}>Reset to defaults</button>
          </div>
          <p className="mt-2 text-sm text-muted">Choose a button, then press the key you want. Esc cancels. Changes apply the next time a game starts.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {REMAPPABLE.map(({ button, label }) => (
              <li key={button} className="flex items-center justify-between rounded-xl bg-ink-3 px-4 py-2.5">
                <span className="text-sm font-semibold">{label}</span>
                <span className="flex items-center gap-2">
                  {capturing === button ? (
                    <span className="text-sm text-gold" aria-live="polite">Press a key…</span>
                  ) : (
                    keysFor(button, s.keys).map((c) => <kbd key={c} className="rounded-md border border-line bg-ink px-2 py-0.5 text-xs font-semibold">{keyLabel(c)}</kbd>)
                  )}
                  <button type="button" className="btn btn-soft h-8 px-4 text-xs" onClick={() => setCapturing(capturing === button ? null : button)}>
                    {capturing === button ? 'Cancel' : 'Rebind'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
