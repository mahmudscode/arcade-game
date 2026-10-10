import { EventEmitter } from 'node:events';
import { TICK, createRng, decodeReplay, type GameDefinition } from '@arcade/engine';
import { loadGame } from '@arcade/games';
import { VERIFY_TIMEOUT_MS } from '@arcade/shared';
import { schema, type Db } from '@arcade/db';
import { eq } from 'drizzle-orm';

const { scores, gameSessions } = schema;
const NO_INPUT_STATUS = { score: 0, level: 0 };

export type Verdict = { ok: true; score: number; level: number } | { ok: false; reason: string };

/**
 * Re-simulates a run exactly as the client did: same seed, same fixed step, recorded inputs.
 * The result is the score at the first tick the game reported `over` (what the client submits),
 * or at the last frame if the run never ended.
 */
export function simulate(def: GameDefinition<any>, seed: number, replay: Uint8Array, claimedFrames: number, timeoutMs = VERIFY_TIMEOUT_MS): Verdict {
  const inputs = decodeReplay(replay);
  if (inputs.length !== claimedFrames) return { ok: false, reason: 'replay_malformed' };
  const deadline = Date.now() + timeoutMs;
  const rng = createRng(seed);
  const state = def.init({ rng, hiScore: 0 });
  const ctx = { rng, emit: () => undefined };
  let result = NO_INPUT_STATUS;
  for (let i = 0; i < inputs.length; i++) {
    def.update(state, inputs[i]!, TICK, ctx);
    const s = def.status(state);
    if (s.over) {
      result = { score: s.score, level: s.level };
      return { ok: true, ...result };
    }
    if ((i & 1023) === 0 && Date.now() > deadline) return { ok: false, reason: 'timeout' };
  }
  const s = def.status(state);
  return { ok: true, score: s.score, level: s.level };
}

/**
 * In-process verification queue (one job at a time). Swapped for a BullMQ worker once Valkey is
 * part of the stack; the job itself (`verify`) doesn't change.
 */
export class Verifier {
  readonly events = new EventEmitter();
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(private db: Db, private log: { error(...a: unknown[]): void } = console) {}

  enqueue(scoreId: string): void {
    this.pending++;
    this.chain = this.chain
      .then(() => this.verify(scoreId))
      .catch((e) => this.log.error(e, 'verification failed'))
      .finally(() => void this.pending--);
  }

  /** Resolves when the queue is empty (tests, graceful shutdown). */
  async idle(): Promise<void> {
    while (this.pending > 0) await this.chain;
  }

  /** Re-queues scores left pending by a restart. */
  async recover(): Promise<number> {
    const rows = await this.db.select({ id: scores.id }).from(scores).where(eq(scores.status, 'pending'));
    rows.forEach((r) => this.enqueue(r.id));
    return rows.length;
  }

  async verify(scoreId: string): Promise<void> {
    const [row] = await this.db
      .select({ s: scores, seed: gameSessions.seed })
      .from(scores)
      .innerJoin(gameSessions, eq(gameSessions.id, scores.sessionId))
      .where(eq(scores.id, scoreId));
    if (!row || row.s.status !== 'pending') return;

    const verdict = await this.judge(row.s, row.seed);
    const finalScore = verdict.ok && verdict.score === row.s.score ? verdict : null;
    const status = finalScore ? 'verified' : 'rejected';
    const rejectReason = finalScore ? null : verdict.ok ? 'score_mismatch' : verdict.reason;
    await this.db
      .update(scores)
      .set({ status, rejectReason, ...(finalScore ? { levelReached: finalScore.level } : {}) })
      .where(eq(scores.id, scoreId));
    this.events.emit(scoreId, status);
  }

  private async judge(s: typeof scores.$inferSelect, seed: number): Promise<Verdict> {
    const def = await loadGame(s.gameSlug);
    if (!def) return { ok: false, reason: 'unknown_game' };
    if (!s.replay) return { ok: false, reason: 'replay_malformed' };
    const bytes = new Uint8Array(s.replay);
    if (bytes.length < 4) return { ok: false, reason: 'replay_malformed' };
    const frames = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
    return simulate(def, seed, bytes, frames);
  }
}
