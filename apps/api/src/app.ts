import cookie from '@fastify/cookie';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { randomInt } from 'node:crypto';
import { schema, uuidv7, type Db } from '@arcade/db';
import {
  REPLAY_MAX_BYTES,
  SESSION_TTL_MS,
  TICK_HZ,
  createSessionBody,
  gamesQuery,
  loginBody,
  registerBody,
  slugSchema,
  submitScoreBody,
  type ApiGame,
  type ApiScore,
  type ApiUser,
} from '@arcade/shared';
import { z } from 'zod';
import { AppError, installErrorHandler, parse } from './errors';
import { RateLimiter, checkOrigin, hashPassword, hashToken, newToken, verifyPassword } from './security';

const { users, authSessions, games, gameSessions, scores } = schema;

const AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE = 'sid';

export interface AppOptions {
  db: Db;
  webUrl?: string;
  /** Set false in tests to disable rate limits. */
  rateLimit?: boolean;
  logger?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: ApiUser | null;
  }
}

const toUser = (u: typeof users.$inferSelect): ApiUser => ({ id: u.id, email: u.email, username: u.username, role: u.role, avatar: u.avatar });
const toGame = (g: typeof games.$inferSelect): ApiGame => ({
  slug: g.slug, title: g.title, category: g.category, archetype: g.archetype, description: g.description, controls: g.controls, currentVersion: g.currentVersion,
});
const toScore = (s: typeof scores.$inferSelect): ApiScore => ({
  id: s.id, gameSlug: s.gameSlug, gameVersion: s.gameVersion, score: s.score, levelReached: s.levelReached, durationMs: s.durationMs,
  status: s.status, createdAt: s.createdAt.toISOString(),
});

export function buildApp(opts: AppOptions) {
  const { db } = opts;
  const webUrl = opts.webUrl ?? 'http://localhost:5173';
  const secure = new URL(webUrl).protocol === 'https:';
  const limiter = new RateLimiter(opts.rateLimit ?? true);
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 512 * 1024, trustProxy: true });

  installErrorHandler(app);
  app.register(cookie);
  app.decorateRequest('user', null);
  app.addHook('preHandler', checkOrigin(webUrl));

  app.addHook('preHandler', async (req) => {
    const token = req.cookies[COOKIE];
    if (!token) return;
    const [row] = await db
      .select({ user: users, expiresAt: authSessions.expiresAt })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(eq(authSessions.id, hashToken(token)));
    if (row && row.expiresAt > new Date()) req.user = toUser(row.user);
  });

  const requireUser = (req: FastifyRequest): ApiUser => {
    if (!req.user) throw new AppError(401, 'unauthorized', 'Sign in required');
    return req.user;
  };

  async function startSession(req: FastifyRequest, reply: FastifyReply, userId: string) {
    const token = newToken();
    await db.insert(authSessions).values({
      id: hashToken(token), userId, expiresAt: new Date(Date.now() + AUTH_TTL_MS), ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 256),
    });
    reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: AUTH_TTL_MS / 1000 });
  }

  const api = (instance: typeof app) => {
    instance.get('/health', async () => ({ ok: true }));

    // ---- auth
    instance.post('/auth/register', async (req, reply) => {
      limiter.check(`auth:${req.ip}`, 10);
      const body = parse(registerBody, req.body);
      const email = body.email.toLowerCase();
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(or(sql`lower(${users.email}) = ${email}`, sql`lower(${users.username}) = ${body.username.toLowerCase()}`));
      if (taken.length) throw new AppError(409, 'conflict', 'Email or username already in use');
      const [user] = await db
        .insert(users)
        .values({ id: uuidv7(), email, username: body.username, passwordHash: await hashPassword(body.password) })
        .returning();
      await startSession(req, reply, user!.id);
      return reply.status(201).send({ user: toUser(user!) });
    });

    instance.post('/auth/login', async (req, reply) => {
      limiter.check(`auth:${req.ip}`, 10);
      const body = parse(loginBody, req.body);
      const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${body.email.toLowerCase()}`);
      const ok = await verifyPassword(body.password, user?.passwordHash ?? null);
      if (!user || !ok) throw new AppError(401, 'invalid_credentials', 'Wrong email or password');
      await startSession(req, reply, user.id);
      return { user: toUser(user) };
    });

    instance.post('/auth/logout', async (req, reply) => {
      const token = req.cookies[COOKIE];
      if (token) await db.delete(authSessions).where(eq(authSessions.id, hashToken(token)));
      reply.clearCookie(COOKIE, { path: '/' });
      return reply.status(204).send();
    });

    instance.get('/me', async (req) => ({ user: requireUser(req) }));

    // ---- catalog
    instance.get('/games', async (req) => {
      limiter.check(`read:${req.ip}`, 120);
      const q = parse(gamesQuery, req.query);
      const conds = [eq(games.enabled, true)];
      if (q.category) conds.push(eq(games.category, q.category));
      if (q.archetype) conds.push(eq(games.archetype, q.archetype));
      if (q.q) conds.push(ilike(games.title, `%${q.q.replace(/[%_\\]/g, '\\$&')}%`));
      const order = q.sort === 'new' ? desc(games.createdAt) : games.title;
      const rows = await db.select().from(games).where(and(...conds)).orderBy(order, games.slug);
      return { items: rows.map(toGame) };
    });

    instance.get('/games/:slug', async (req) => {
      const { slug } = parse(z.object({ slug: slugSchema }), req.params);
      const [g] = await db.select().from(games).where(and(eq(games.slug, slug), eq(games.enabled, true)));
      if (!g) throw new AppError(404, 'not_found', 'Game not found');
      return { game: toGame(g) };
    });

    // ---- play sessions and scores
    instance.post('/sessions', async (req, reply) => {
      limiter.check(`sessions:${req.user?.id ?? req.ip}`, 30);
      const { gameSlug } = parse(createSessionBody, req.body);
      const [g] = await db.select().from(games).where(and(eq(games.slug, gameSlug), eq(games.enabled, true)));
      if (!g) throw new AppError(404, 'not_found', 'Game not found');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      const [s] = await db
        .insert(gameSessions)
        .values({ id: uuidv7(), userId: req.user?.id ?? null, gameSlug, gameVersion: g.currentVersion, seed: randomInt(1, 2 ** 31), expiresAt })
        .returning();
      return reply.status(201).send({ sessionId: s!.id, seed: s!.seed, gameVersion: s!.gameVersion, expiresAt: expiresAt.toISOString() });
    });

    instance.post('/scores', async (req, reply) => {
      const user = requireUser(req);
      limiter.check(`scores:${user.id}`, 10);
      const body = parse(submitScoreBody, req.body);
      const idem = parse(z.string().min(1).max(128).optional(), req.headers['idempotency-key']);

      if (idem) {
        const [prev] = await db.select().from(scores).where(and(eq(scores.userId, user.id), eq(scores.idempotencyKey, idem)));
        if (prev) return reply.status(202).send({ scoreId: prev.id, status: prev.status });
      }

      const replay = Buffer.from(body.replay, 'base64');
      if (replay.length > REPLAY_MAX_BYTES) throw new AppError(413, 'replay_too_large', 'Replay exceeds size limit');
      if (replay.length < 4) throw new AppError(400, 'bad_replay', 'Replay is missing its header');
      const frames = replay.readUInt32LE(0);
      const expectedMs = (frames / TICK_HZ) * 1000;
      if (Math.abs(body.durationMs - expectedMs) > Math.max(1000, expectedMs * 0.05)) {
        throw new AppError(400, 'duration_mismatch', 'durationMs does not match replay length');
      }

      const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, body.sessionId));
      if (!session || (session.userId && session.userId !== user.id)) throw new AppError(404, 'not_found', 'Session not found');
      if (session.expiresAt <= new Date()) throw new AppError(410, 'session_expired', 'Session expired');

      // Single use, enforced atomically so concurrent submits cannot both win.
      const claimed = await db
        .update(gameSessions)
        .set({ used: true, userId: user.id })
        .where(and(eq(gameSessions.id, session.id), eq(gameSessions.used, false)))
        .returning({ id: gameSessions.id });
      if (!claimed.length) throw new AppError(409, 'session_used', 'Session already submitted');

      const [row] = await db
        .insert(scores)
        .values({
          id: uuidv7(), userId: user.id, gameSlug: session.gameSlug, gameVersion: session.gameVersion, sessionId: session.id,
          score: body.score, levelReached: body.levelReached, durationMs: body.durationMs, replay, idempotencyKey: idem ?? null,
        })
        .returning();
      // Client-claimed score is stored as `pending` only; the verifier (next milestone) decides.
      return reply.status(202).send({ scoreId: row!.id, status: row!.status });
    });

    instance.get('/scores/:id', async (req) => {
      const user = requireUser(req);
      const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
      const [s] = await db.select().from(scores).where(and(eq(scores.id, id), eq(scores.userId, user.id)));
      if (!s) throw new AppError(404, 'not_found', 'Score not found');
      return { score: toScore(s) };
    });

    instance.get('/me/scores', async (req) => {
      const user = requireUser(req);
      const { game } = parse(z.object({ game: slugSchema.optional() }), req.query);
      const rows = await db
        .select()
        .from(scores)
        .where(and(eq(scores.userId, user.id), game ? eq(scores.gameSlug, game) : undefined))
        .orderBy(desc(scores.createdAt))
        .limit(100);
      return { items: rows.map(toScore), nextCursor: null };
    });
  };

  app.register(async (i) => api(i as typeof app), { prefix: '/api/v1' });
  return app;
}
