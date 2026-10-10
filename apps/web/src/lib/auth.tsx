import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ApiUser } from '@arcade/shared';
import { api } from './api';

interface AuthValue {
  user: ApiUser | null;
  /** False until the first /me answer, so the UI doesn't flash "Sign in" for a signed-in player. */
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    api.me().then((u) => live && setUser(u), () => undefined).finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => setUser(await api.login({ email, password })), []);
  const register = useCallback(async (email: string, username: string, password: string) => setUser(await api.register({ email, username, password })), []);
  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
