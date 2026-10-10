import { GAMES } from '@arcade/shared';
import { sql } from 'drizzle-orm';
import type { Db } from './client';
import { games } from './schema';

/** Upserts the catalog. Metadata updates never touch `current_version` (replay-pinned). */
export async function seedGames(db: Db): Promise<number> {
  const rows = GAMES.map((g) => ({
    slug: g.slug,
    title: g.title,
    category: g.category,
    description: g.description,
    controls: g.controls,
  }));
  await db
    .insert(games)
    .values(rows)
    .onConflictDoUpdate({
      target: games.slug,
      set: { title: sql`excluded.title`, category: sql`excluded.category`, description: sql`excluded.description`, controls: sql`excluded.controls` },
    });
  return rows.length;
}
