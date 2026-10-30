// Runs the explicit owner-claim command; ordinary app startup does not run it.
import { parseArgs } from 'node:util';
import { claimLessons, defaultBackupRoot, prismaClaimStore, sqliteClaimStore } from './claim.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, lessons: { type: 'string' }, 'all-unclaimed': { type: 'boolean' }, confirm: { type: 'boolean' }, 'backup-dir': { type: 'string' } } });
// Closes this resource cleanly instead of leaving an active request or connection behind.
let close = async () => {};
try {
  const selected = process.env.COACHLAB_DATABASE || 'sqlite';
  let store;
  if (selected === 'sqlite') {
    const { openDatabase } = await import('./database.js');
    const { migrate } = await import('./migrations.js');
    const database = openDatabase();
    migrate(database);
    close = async () => database.close();
    store = sqliteClaimStore(database);
  } else if (selected === 'postgresql') {
    const { createDevelopmentClient } = await import('./prisma-development.js');
    const client = createDevelopmentClient();
    close = () => client.$disconnect();
    const identity = await client.$queryRaw`SELECT current_database() AS name`;
    if (identity[0].name !== process.env.COACHLAB_DEV_EXPECTED_DATABASE) throw new Error('Database identity mismatch.');
    store = prismaClaimStore(client);
  } else {
    throw new Error('Unsupported database selection.');
  }
  const lessonIds = values.lessons ? values.lessons.split(',').map(value => Number(value.trim())) : undefined;
  if (lessonIds?.some(id => !Number.isInteger(id) || id < 1)) throw new Error('--lessons must be a comma-separated list of lesson numbers.');
  const result = await claimLessons({ store, email: values.email, lessonIds, allUnclaimed: values['all-unclaimed'], confirm: values.confirm, backupRoot: values['backup-dir'] || defaultBackupRoot, log: console.log });
  if (!result.changed && !result.dryRun) process.exitCode = 1;
} catch (error) {
  console.error(`Claim failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await close().catch(() => {});
}
