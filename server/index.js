import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { migrate } from './migrations.js';
import { prismaLessons } from './lesson-store.js';
import { createAuth } from './auth.js';
import { consoleMailer } from './mailer.js';
import { listenerSettings } from './web.js';

let close = async () => {};
try {
  const production = process.env.NODE_ENV === 'production';
  const { port, host } = listenerSettings();
  const selected = process.env.COACHLAB_DATABASE || 'sqlite';
  let lessons;
  let auth;
  const publicUrl = (process.env.COACHLAB_PUBLIC_URL || 'http://127.0.0.1:5174').replace(/\/+$/, '');
  const sameMachine = publicUrl.replace('//127.0.0.1', '//localhost');
  const allowedOrigins = [...new Set((process.env.COACHLAB_ALLOWED_ORIGINS || publicUrl).split(',').map(origin => origin.trim()).filter(Boolean).concat(process.env.COACHLAB_ALLOWED_ORIGINS ? [] : [sameMachine]))];
  const authSettings = { secret: process.env.BETTER_AUTH_SECRET, baseURL: publicUrl, trustedOrigins: allowedOrigins, mailer: consoleMailer(), env: process.env };
  if (selected === 'sqlite') {
    const database = openDatabase();
    close = async () => database.close();
    migrate(database);
    auth = createAuth({ ...authSettings, database });
    await auth.prepare();
    lessons = database;
  } else if (selected === 'postgresql') {
    const { createDevelopmentClient } = await import('./prisma-development.js');
    const client = createDevelopmentClient();
    close = () => client.$disconnect();
    const identity = await client.$queryRaw`SELECT current_database() AS name`;
    if (identity[0].name !== process.env.COACHLAB_DEV_EXPECTED_DATABASE) throw new Error('Database identity mismatch.');
    await client.lesson.count();
    auth = createAuth({ ...authSettings, prisma: client });
    lessons = prismaLessons(client);
  } else {
    throw new Error('Unsupported database selection.');
  }
  const server = createApp(lessons, { auth, allowedOrigins, production }).listen(port, host, () => {
    console.log(`CoachLab API listening on port ${port}; database=${selected}`);
  });
  server.on('error', async () => {
    await close();
    console.error('Could not start CoachLab API. Check whether the configured port is already in use.');
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => { await close(); }));
  }
} catch (error) {
  await close().catch(() => {});
  if (/authentication secret/.test(error?.message)) console.error('Login is not configured: set BETTER_AUTH_SECRET (at least 32 random characters) in the ignored .env file. CoachLab will not serve lessons without login.');
  console.error('Could not initialize the selected database. Check server configuration and connectivity. No fallback was attempted.');
  process.exitCode = 1;
}
