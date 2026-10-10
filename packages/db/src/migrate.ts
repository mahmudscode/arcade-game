import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { DbHandle } from './client';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Forward-only SQL migrations, applied in filename order and recorded in `_migrations`. */
export async function migrate({ db, exec }: DbHandle): Promise<string[]> {
  await exec('CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await db.execute<{ name: string }>(sql`SELECT name FROM _migrations`)).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await exec(`BEGIN;\n${readFileSync(join(dir, file), 'utf8')}\nINSERT INTO _migrations (name) VALUES ('${file}');\nCOMMIT;`);
    applied.push(file);
  }
  return applied;
}
