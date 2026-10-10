import { sql } from 'drizzle-orm';
import { bigint, boolean, customType, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  passwordHash: text('password_hash'),
  avatar: text('avatar'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable('auth_sessions', {
  /** SHA-256 of the cookie token; the raw token is never stored. */
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const games = pgTable('games', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  archetype: text('archetype'),
  description: text('description').notNull().default(''),
  controls: jsonb('controls').$type<{ keys: string[]; label: string }[]>().notNull().default([]),
  currentVersion: integer('current_version').notNull().default(1),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  gameSlug: text('game_slug').notNull().references(() => games.slug),
  gameVersion: integer('game_version').notNull(),
  seed: integer('seed').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
});

export const scores = pgTable(
  'scores',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    gameSlug: text('game_slug').notNull().references(() => games.slug),
    gameVersion: integer('game_version').notNull(),
    sessionId: uuid('session_id').notNull().unique().references(() => gameSessions.id),
    score: bigint('score', { mode: 'number' }).notNull(),
    levelReached: integer('level_reached').notNull().default(0),
    durationMs: integer('duration_ms').notNull(),
    replayKey: text('replay_key'),
    replay: bytea('replay'),
    idempotencyKey: text('idempotency_key'),
    status: text('status', { enum: ['pending', 'verified', 'rejected'] }).notNull().default('pending'),
    rejectReason: text('reject_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('scores_board_idx').on(t.gameSlug, t.status, t.score.desc()),
    index('scores_user_idx').on(t.userId, t.gameSlug, t.createdAt.desc()),
    uniqueIndex('scores_idem_uq').on(t.userId, t.idempotencyKey).where(sql`${t.idempotencyKey} is not null`),
  ],
);
