import { connect, migrate, seedGames, schema, type DbHandle } from '@arcade/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';

let handle: DbHandle;
let app: ReturnType<typeof buildApp>;
const P = '/api/v1';

beforeAll(async () => {
  handle = connect();
  await migrate(handle);
  await seedGames(handle.db);
  app = buildApp({ db: handle.db, rateLimit: false });
});
afterAll(async () => {
  await app.close();
  await handle.close();
});

const replayOf = (frames: number) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(frames, 0);
  return b.toString('base64');
};

async function signUp(name: string) {
  const res = await app.inject({ method: 'POST', url: `${P}/auth/register`, payload: { email: `${name}@x.io`, username: name, password: 'hunter2hunter2' } });
  expect(res.statusCode).toBe(201);
  return { cookie: `sid=${res.cookies[0]!.value}` };
}
const newSession = async (cookie?: string, gameSlug = 'comet-crusher') =>
  (await app.inject({ method: 'POST', url: `${P}/sessions`, payload: { gameSlug }, headers: cookie ? { cookie } : {} })).json();

describe('catalog', () => {
  it('lists seeded games and filters', async () => {
    const all = (await app.inject({ url: `${P}/games` })).json().items;
    expect(all.length).toBeGreaterThan(40);
    const q = (await app.inject({ url: `${P}/games?q=comet` })).json().items;
    expect(q.map((g: { slug: string }) => g.slug)).toContain('comet-crusher');
    expect((await app.inject({ url: `${P}/games/nope-nope` })).statusCode).toBe(404);
    expect((await app.inject({ url: `${P}/games?sort=bogus` })).statusCode).toBe(400);
  });
});

describe('auth', () => {
  it('registers, reads /me, logs out, rejects bad credentials and duplicates', async () => {
    const { cookie } = await signUp('alice');
    expect((await app.inject({ url: `${P}/me`, headers: { cookie } })).json().user.username).toBe('alice');
    expect((await app.inject({ url: `${P}/me` })).statusCode).toBe(401);

    const dup = await app.inject({ method: 'POST', url: `${P}/auth/register`, payload: { email: 'ALICE@x.io', username: 'other', password: 'hunter2hunter2' } });
    expect(dup.statusCode).toBe(409);
    const weak = await app.inject({ method: 'POST', url: `${P}/auth/register`, payload: { email: 'w@x.io', username: 'w', password: 'short' } });
    expect(weak.statusCode).toBe(400);

    const bad = await app.inject({ method: 'POST', url: `${P}/auth/login`, payload: { email: 'alice@x.io', password: 'wrong-password' } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: `${P}/auth/login`, payload: { email: 'alice@x.io', password: 'hunter2hunter2' } });
    expect(ok.statusCode).toBe(200);

    await app.inject({ method: 'POST', url: `${P}/auth/logout`, headers: { cookie } });
    expect((await app.inject({ url: `${P}/me`, headers: { cookie } })).statusCode).toBe(401);
  });

  it('never stores the raw password or session token', async () => {
    const { cookie } = await signUp('carol');
    const [u] = await handle.db.select().from(schema.users).where(eq(schema.users.username, 'carol'));
    expect(u!.passwordHash).toMatch(/^scrypt\$/);
    const rows = await handle.db.select().from(schema.authSessions);
    expect(rows.some((r) => r.id === cookie.slice(4))).toBe(false);
  });

  it('blocks cross-origin writes', async () => {
    const res = await app.inject({ method: 'POST', url: `${P}/sessions`, payload: { gameSlug: 'comet-crusher' }, headers: { origin: 'https://evil.example' } });
    expect(res.statusCode).toBe(403);
  });
});

describe('sessions and scores', () => {
  it('register -> play -> submit -> stored as pending', async () => {
    const { cookie } = await signUp('bob');
    const s = await newSession(cookie);
    expect(s.seed).toBeGreaterThan(0);

    const res = await app.inject({
      method: 'POST', url: `${P}/scores`, headers: { cookie },
      payload: { sessionId: s.sessionId, score: 4200, levelReached: 3, durationMs: 10_000, replay: replayOf(600) },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('pending');

    const mine = (await app.inject({ url: `${P}/me/scores?game=comet-crusher`, headers: { cookie } })).json().items;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ score: 4200, status: 'pending', gameVersion: s.gameVersion });
    expect((await app.inject({ url: `${P}/scores/${res.json().scoreId}`, headers: { cookie } })).json().score.status).toBe('pending');
  });

  it('is single-use, and idempotent with an Idempotency-Key', async () => {
    const { cookie } = await signUp('dave');
    const s = await newSession(cookie);
    const payload = { sessionId: s.sessionId, score: 10, durationMs: 1000, replay: replayOf(60) };
    const a = await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie, 'idempotency-key': 'k1' }, payload });
    const b = await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie, 'idempotency-key': 'k1' }, payload });
    expect(b.json().scoreId).toBe(a.json().scoreId);
    const c = await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie }, payload });
    expect(c.statusCode).toBe(409);
  });

  it('rejects guests, foreign sessions, unknown sessions, and inconsistent durations', async () => {
    const eve = await signUp('eve');
    const frank = await signUp('frank');
    const own = await newSession(eve.cookie);
    const payload = { sessionId: own.sessionId, score: 1, durationMs: 1000, replay: replayOf(60) };

    expect((await app.inject({ method: 'POST', url: `${P}/scores`, payload })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie: frank.cookie }, payload })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie: eve.cookie }, payload: { ...payload, sessionId: crypto.randomUUID() } })).statusCode).toBe(404);
    const liar = await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie: eve.cookie }, payload: { ...payload, durationMs: 90_000 } });
    expect(liar.statusCode).toBe(400);
    expect(liar.json().error.code).toBe('duration_mismatch');
    // a rejected attempt must not burn the session
    expect((await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie: eve.cookie }, payload })).statusCode).toBe(202);
  });

  it('lets a guest session be claimed by the user who submits it', async () => {
    const { cookie } = await signUp('gina');
    const s = await newSession();
    const res = await app.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie }, payload: { sessionId: s.sessionId, score: 5, durationMs: 0, replay: replayOf(0) } });
    expect(res.statusCode).toBe(202);
  });

  it('rejects unknown games and malformed bodies', async () => {
    expect((await app.inject({ method: 'POST', url: `${P}/sessions`, payload: { gameSlug: 'not-a-game' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `${P}/sessions`, payload: { gameSlug: 'Bad Slug' } })).statusCode).toBe(400);
  });
});

describe('rate limits', () => {
  it('limits auth attempts per IP', async () => {
    const limited = buildApp({ db: handle.db, rateLimit: true });
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await limited.inject({ method: 'POST', url: `${P}/auth/login`, payload: { email: 'n@x.io', password: 'x' } })).statusCode;
    expect(last).toBe(429);
    await limited.close();
  });
});
