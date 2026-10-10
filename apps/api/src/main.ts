import { connect, migrate, seedGames } from '@arcade/db';
import { buildApp } from './app';

const handle = connect({ url: process.env.DATABASE_URL, dataDir: process.env.PGLITE_DIR });
await migrate(handle);
await seedGames(handle.db);

const app = buildApp({ db: handle.db, webUrl: process.env.PUBLIC_WEB_URL, logger: true });
const port = Number(process.env.PORT ?? 3001);
await app.verifier.recover();
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await handle.close();
    process.exit(0);
  });
}
