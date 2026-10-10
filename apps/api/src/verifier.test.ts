import { NO_INPUT, Recorder, runHeadless, type Input } from '@arcade/engine';
import { loadGame } from '@arcade/games';
import { connect, migrate, seedGames, type DbHandle } from '@arcade/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';

let handle: DbHandle;
let app: ReturnType<typeof buildApp>;
const P = '/api/v1';
const SLUG = 'comet-crusher';

beforeAll(async () => {
  handle = connect();
  await migrate(handle);
  await seedGames(handle.db);
  app = buildApp({ db: handle.db, rateLimit: false });
});
afterAll(async () => {
  await app.verifier.idle();
  await app.close();
  await handle.close();
});

/** A scripted "player": sweeps left/right and holds fire. Same inputs the probe used. */
const script = (f: number): Input => ({
  held: { ...NO_INPUT.held, a: true, right: f % 120 < 60, left: f % 120 >= 60 },
  pressed: { ...NO_INPUT.pressed, a: f % 10 === 0 },
});
const idle = (): Input => NO_INPUT;

function record(frames: number, inputAt: (f: number) => Input = script) {
  const r = new Recorder();
  for (let f = 0; f < frames; f++) r.record(inputAt(f));
  return r;
}

async function signUp(name: string) {
  const res = await app.inject({ method: 'POST', url: `${P}/auth/register`, payload: { email: `${name}@x.io`, username: name, password: 'hunter2hunter2' } });
  return `sid=${res.cookies[0]!.value}`;
}

/** Plays `frames` of the scripted run for real (headless), returns what an honest client would submit. */
async function play(cookie: string, frames: number, slug = SLUG, appRef = app) {
  const s = (await appRef.inject({ method: 'POST', url: `${P}/sessions`, payload: { gameSlug: slug }, headers: { cookie } })).json();
  const def = (await loadGame(slug))!;
  const truth = runHeadless(def, { seed: s.seed, frames, inputAt: script }).status;
  return { sessionId: s.sessionId as string, seed: s.seed as number, score: truth.score, level: truth.level, frames };
}

async function submit(cookie: string, body: Record<string, unknown>, appRef = app) {
  const res = await appRef.inject({ method: 'POST', url: `${P}/scores`, headers: { cookie }, payload: body });
  expect(res.statusCode).toBe(202);
  return res.json().scoreId as string;
}
const statusOf = async (cookie: string, id: string) => (await app.inject({ url: `${P}/scores/${id}`, headers: { cookie } })).json().score.status as string;
const board = async (slug: string, q = '') => (await app.inject({ url: `${P}/leaderboards/${slug}${q}` })).json().items as { rank: number; username: string; score: number }[];

describe('replay verification', () => {
  it('verifies an honest run and puts it on the leaderboard and profile', async () => {
    const cookie = await signUp('honest');
    const run = await play(cookie, 1200);
    expect(run.score).toBeGreaterThan(0);
    const id = await submit(cookie, { sessionId: run.sessionId, score: run.score, durationMs: 20_000, replay: record(1200).toBase64() });
    await app.verifier.idle();
    expect(await statusOf(cookie, id)).toBe('verified');
    expect(await board(SLUG)).toEqual([expect.objectContaining({ rank: 1, username: 'honest', score: run.score })]);

    const profile = (await app.inject({ url: `${P}/users/HONEST` })).json();
    expect(profile.stats.verifiedRuns).toBe(1);
    expect(profile.stats.games[0]).toMatchObject({ gameSlug: SLUG, bestScore: run.score });
    expect(JSON.stringify(profile)).not.toContain('@x.io');
  });

  it('rejects an inflated score claim', async () => {
    const cookie = await signUp('liar');
    const run = await play(cookie, 1200);
    const id = await submit(cookie, { sessionId: run.sessionId, score: run.score + 1000, durationMs: 20_000, replay: record(1200).toBase64() });
    await app.verifier.idle();
    expect(await statusOf(cookie, id)).toBe('rejected');
    expect((await board(SLUG)).map((e) => e.username)).not.toContain('liar');
  });

  it('rejects a tampered replay (inputs changed, honest score claimed)', async () => {
    const cookie = await signUp('tamper');
    const run = await play(cookie, 1200);
    const id = await submit(cookie, { sessionId: run.sessionId, score: run.score, durationMs: 20_000, replay: record(1200, idle).toBase64() });
    await app.verifier.idle();
    expect(await statusOf(cookie, id)).toBe('rejected');
  });

  it('rejects a replay whose header frame count does not match its data', async () => {
    const cookie = await signUp('forger');
    const run = await play(cookie, 600);
    const bytes = record(600).toBytes();
    new DataView(bytes.buffer).setUint32(0, 6000, true);
    const id = await submit(cookie, { sessionId: run.sessionId, score: run.score, durationMs: 100_000, replay: Buffer.from(bytes).toString('base64') });
    await app.verifier.idle();
    expect(await statusOf(cookie, id)).toBe('rejected');
  });

  it('rejects a replay recorded for a different seed', async () => {
    const cookie = await signUp('swapper');
    const a = await play(cookie, 1200);
    const b = await play(cookie, 1200);
    // Claim run A's score but against session B, whose seed differs.
    if (a.seed === b.seed || a.score === b.score) return; // seeds are random; skip the rare coincidence
    const id = await submit(cookie, { sessionId: b.sessionId, score: a.score, durationMs: 20_000, replay: record(1200).toBase64() });
    await app.verifier.idle();
    expect(await statusOf(cookie, id)).toBe('rejected');
  });

  it('keeps each player to their best verified score, and ranks by score', async () => {
    const ivy = await signUp('ivy');
    const jon = await signUp('jon');
    for (const frames of [600, 1200]) {
      const run = await play(ivy, frames);
      await submit(ivy, { sessionId: run.sessionId, score: run.score, durationMs: frames * (1000 / 60), replay: record(frames).toBase64() });
    }
    const jr = await play(jon, 300);
    await submit(jon, { sessionId: jr.sessionId, score: jr.score, durationMs: 5000, replay: record(300).toBase64() });
    await app.verifier.idle();

    const items = await board(SLUG);
    expect(items.filter((e) => e.username === 'ivy')).toHaveLength(1);
    expect(items.map((e) => e.score)).toEqual([...items.map((e) => e.score)].sort((x, y) => y - x));
    expect(items.map((e) => e.rank)).toEqual(items.map((_, i) => i + 1));

    const me = (await app.inject({ url: `${P}/leaderboards/${SLUG}/me`, headers: { cookie: ivy } })).json();
    expect(me.rank).toBe(items.findIndex((e) => e.username === 'ivy') + 1);
    expect((await app.inject({ url: `${P}/leaderboards/${SLUG}?period=daily` })).json().items.length).toBeGreaterThan(0);
    expect((await app.inject({ url: `${P}/leaderboards/${SLUG}?period=yearly` })).statusCode).toBe(400);
  });
});

describe('pending scores', () => {
  it('stay off the board until verified, survive a restart, and stream their result over SSE', async () => {
    const slug = 'star-divers';
    const held = buildApp({ db: handle.db, rateLimit: false, autoVerify: false });
    const cookie = await signUp('ken');
    const def = (await loadGame(slug))!;
    const s = (await held.inject({ method: 'POST', url: `${P}/sessions`, payload: { gameSlug: slug }, headers: { cookie } })).json();
    const truth = runHeadless(def, { seed: s.seed, frames: 900, inputAt: script }).status;
    const id = await submit(cookie, { sessionId: s.sessionId, score: truth.score, durationMs: 15_000, replay: record(900).toBase64() }, held);

    expect(await board(slug)).toEqual([]);

    await held.listen({ port: 0, host: '127.0.0.1' });
    const addr = held.server.address() as { port: number };
    const res = await fetch(`http://127.0.0.1:${addr.port}${P}/scores/${id}/events`, { headers: { cookie } });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let seen = dec.decode((await reader.read()).value);
    expect(seen).toContain('"status":"pending"');

    expect(await held.verifier.recover()).toBeGreaterThanOrEqual(1); // what happens after a restart
    while (!seen.includes('verified')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      seen += dec.decode(chunk.value);
    }
    expect(seen).toContain('"status":"verified"');
    await held.verifier.idle();
    expect((await board(slug)).map((e) => e.username)).toEqual(['ken']);
    await held.close();
  }, 20_000);

  it('SSE is private to the score owner', async () => {
    const owner = await signUp('lea');
    const other = await signUp('max');
    const run = await play(owner, 300);
    const id = await submit(owner, { sessionId: run.sessionId, score: run.score, durationMs: 5000, replay: record(300).toBase64() });
    expect((await app.inject({ url: `${P}/scores/${id}/events`, headers: { cookie: other } })).statusCode).toBe(404);
    expect((await app.inject({ url: `${P}/scores/${id}/events` })).statusCode).toBe(401);
  });
});
