import { connect } from './client';
import { migrate } from './migrate';
import { seedGames } from './seed';

const h = connect({ url: process.env.DATABASE_URL, dataDir: process.env.PGLITE_DIR });
const cmd = process.argv[2];
if (cmd === 'migrate') console.log('applied:', await migrate(h));
else if (cmd === 'seed') console.log('games upserted:', await seedGames(h.db));
else console.error('usage: cli.ts migrate|seed');
await h.close();
