import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { migrate } from './migrations.js';
import { prismaLessons } from './lesson-store.js';

let close = async () => {};
try {
  const selected = process.env.COACHLAB_DATABASE || 'sqlite';
  let lessons;
  if (selected === 'sqlite') {
    const database = openDatabase();
    close = async () => database.close();
    migrate(database);
    lessons = database;
  } else if (selected === 'postgresql') {
    const { createDevelopmentClient } = await import('./prisma-development.js');
    const client = createDevelopmentClient();
    close = () => client.$disconnect();
    const identity = await client.$queryRaw`SELECT current_database() AS name`;
    if (identity[0].name !== process.env.COACHLAB_DEV_EXPECTED_DATABASE) throw new Error('Database identity mismatch.');
    await client.lesson.count();
    lessons = prismaLessons(client);
  } else {
    throw new Error('Unsupported database selection.');
  }
  const server = createApp(lessons).listen(3001, '127.0.0.1', () => {
    console.log(`CoachLab API listening at http://127.0.0.1:3001; database=${selected}`);
  });
  server.on('error', async () => {
    await close();
    console.error('Could not start CoachLab API. Check whether port 3001 is already in use.');
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => { await close(); }));
  }
} catch {
  await close().catch(() => {});
  console.error('Could not initialize the selected database. Check server configuration and connectivity. No fallback was attempted.');
  process.exitCode = 1;
}
