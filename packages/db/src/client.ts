import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

export interface DbHandle {
  db: Db;
  /** Runs raw SQL (used by the migrator). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * With a URL: PostgreSQL via node-postgres. Without: embedded PGlite (real Postgres in WASM),
 * in memory or persisted to `dataDir`. Same schema and SQL either way.
 */
export function connect(opts: { url?: string; dataDir?: string } = {}): DbHandle {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url });
    return {
      db: drizzlePg(pool, { schema }) as unknown as Db,
      exec: async (sql) => void (await pool.query(sql)),
      close: () => pool.end(),
    };
  }
  const client = new PGlite(opts.dataDir);
  return {
    db: drizzlePglite(client, { schema }),
    exec: async (sql) => void (await client.exec(sql)),
    close: () => client.close(),
  };
}
