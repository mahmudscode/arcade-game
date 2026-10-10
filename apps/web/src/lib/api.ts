import { sessionResponse, type ApiScore, type ApiUser, type SessionResponse } from '@arcade/shared';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', 'Cannot reach the server');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? res.statusText);
  return data as T;
}

export type PlaySession = SessionResponse;

export const api = {
  me: () => call<{ user: ApiUser }>('GET', '/me').then((r) => r.user),
  register: (b: { email: string; username: string; password: string }) => call<{ user: ApiUser }>('POST', '/auth/register', b).then((r) => r.user),
  login: (b: { email: string; password: string }) => call<{ user: ApiUser }>('POST', '/auth/login', b).then((r) => r.user),
  logout: () => call<void>('POST', '/auth/logout'),
  createSession: (gameSlug: string) => call<unknown>('POST', '/sessions', { gameSlug }).then((r) => sessionResponse.parse(r)),
  submitScore: (b: { sessionId: string; score: number; levelReached: number; durationMs: number; replay: string }, key: string) =>
    call<{ scoreId: string; status: ApiScore['status'] }>('POST', '/scores', b, { 'idempotency-key': key }),
};
