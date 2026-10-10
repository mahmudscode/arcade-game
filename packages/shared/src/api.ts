import { z } from 'zod';

export const REPLAY_MAX_BYTES = 256 * 1024;
export const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
export const TICK_HZ = 60;
/** One hour of play. Bounds how much work verifying a replay can cost. */
export const MAX_REPLAY_FRAMES = 60 * 60 * TICK_HZ;
export const VERIFY_TIMEOUT_MS = 10_000;

export const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64);

export const registerBody = z.object({
  email: z.email().max(254),
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/),
  password: z.string().min(8).max(128),
});
export const loginBody = z.object({ email: z.email(), password: z.string().min(1).max(128) });

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  role: z.enum(['user', 'admin']),
  avatar: z.string().nullable(),
});
export type ApiUser = z.infer<typeof userSchema>;

export const gamesQuery = z.object({
  category: z.string().optional(),
  archetype: z.string().optional(),
  q: z.string().max(64).optional(),
  sort: z.enum(['popular', 'new', 'name']).default('name'),
});

export const gameSchema = z.object({
  slug: slugSchema,
  title: z.string(),
  category: z.string(),
  archetype: z.string().nullable(),
  description: z.string(),
  controls: z.array(z.object({ keys: z.array(z.string()), label: z.string() })),
  currentVersion: z.number().int(),
});
export type ApiGame = z.infer<typeof gameSchema>;

export const createSessionBody = z.object({ gameSlug: slugSchema });
export const sessionResponse = z.object({
  sessionId: z.string(),
  seed: z.number().int(),
  gameVersion: z.number().int(),
  expiresAt: z.string(),
});

/**
 * Replay envelope (base64): u32 little-endian frame count, then the recorder's input stream.
 * The stream format is owned by the verifier milestone; the API only checks the header and size.
 */
export const submitScoreBody = z.object({
  sessionId: z.string().uuid(),
  score: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  levelReached: z.number().int().min(0).max(10_000).default(0),
  durationMs: z.number().int().min(0).max(Math.ceil((MAX_REPLAY_FRAMES / TICK_HZ) * 1000) + 1000),
  replay: z.string().max(Math.ceil((REPLAY_MAX_BYTES * 4) / 3) + 4).regex(/^[A-Za-z0-9+/]*={0,2}$/),
});

export const scoreStatus = z.enum(['pending', 'verified', 'rejected']);
export const scoreSchema = z.object({
  id: z.string(),
  gameSlug: slugSchema,
  gameVersion: z.number().int(),
  score: z.number().int(),
  levelReached: z.number().int(),
  durationMs: z.number().int(),
  status: scoreStatus,
  createdAt: z.string(),
});
export type ApiScore = z.infer<typeof scoreSchema>;

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type SessionResponse = z.infer<typeof sessionResponse>;

export const periodSchema = z.enum(['all', 'weekly', 'daily']);
export type Period = z.infer<typeof periodSchema>;
export const leaderboardQuery = z.object({ period: periodSchema.default('all'), limit: z.coerce.number().int().min(1).max(100).default(50) });

export const leaderboardEntry = z.object({
  rank: z.number().int(),
  username: z.string(),
  score: z.number().int(),
  achievedAt: z.string(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntry>;
