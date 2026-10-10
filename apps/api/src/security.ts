import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './errors';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((res, rej) => scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // Always do the work, even for unknown users, so response time doesn't reveal which emails exist.
  const parts = (stored ?? DUMMY_HASH).split('$');
  const [, n, r, p, salt, key] = parts;
  const expected = Buffer.from(key!, 'base64');
  const actual = await derive(password, Buffer.from(salt!, 'base64'), Number(n), Number(r), Number(p));
  return timingSafeEqual(actual, expected) && stored !== null;
}
const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEYLEN).toString('base64')}`;

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Fixed-window in-memory limiter. Valkey-backed in the leaderboard milestone (same interface). */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(private enabled = true) {}

  check(key: string, limit: number, windowMs = 60_000): void {
    if (!this.enabled) return;
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || h.reset <= now) {
      this.hits.set(key, { count: 1, reset: now + windowMs });
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset <= now) this.hits.delete(k);
      return;
    }
    if (++h.count > limit) throw new AppError(429, 'rate_limited', 'Too many requests', { retryAfterMs: h.reset - now });
  }
}

/** CSRF defence: cookie is SameSite=Lax; additionally reject cross-origin browser writes. */
export function checkOrigin(webUrl: string) {
  const allowed = new URL(webUrl).origin;
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const origin = req.headers.origin;
    if (origin && origin !== allowed) throw new AppError(403, 'bad_origin', 'Cross-origin request blocked');
  };
}
