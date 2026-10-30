// Starts the selected database and authenticated server, stopping on failure instead of falling back.
import { prismaClasses } from './class-store.js';
import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { migrate } from './migrations.js';
import { prismaLessons } from './lesson-store.js';
import { createAuth } from './auth.js';
import { consoleMailer } from './mailer.js';
import { listenerSettings } from './web.js';
import { productionSecuritySettings } from './production-security.js';
import { StartupCheckError, startupFailure } from './startup-errors.js';

// Closes this resource cleanly instead of leaving an active request or connection behind.
let close = async () => {};
let startupStage = 'application configuration';
try {
  const production = process.env.NODE_ENV === 'production';
  const { port, host } = listenerSettings();
  // Choose one database explicitly; a failed connection must never silently switch storage.
  const selected = production ? 'postgresql' : process.env.COACHLAB_DATABASE || 'sqlite';
  let lessons;
  let classes;
  let auth;
  const security = production ? productionSecuritySettings() : null;
  const publicUrl = security?.publicUrl || (process.env.COACHLAB_PUBLIC_URL || 'http://127.0.0.1:5174').replace(/\/+$/, '');
  const sameMachine = publicUrl.replace('//127.0.0.1', '//localhost');
  const allowedOrigins = security?.allowedOrigins || [...new Set((process.env.COACHLAB_ALLOWED_ORIGINS || publicUrl).split(',').map(origin => origin.trim()).filter(Boolean).concat(process.env.COACHLAB_ALLOWED_ORIGINS ? [] : [sameMachine]))];
  const authSettings = { secret: process.env.BETTER_AUTH_SECRET, baseURL: publicUrl, trustedOrigins: allowedOrigins, mailer: consoleMailer(), env: process.env };
  if (selected === 'sqlite') {
    const database = openDatabase();
    close = async () => database.close();
    migrate(database);
    auth = createAuth({ ...authSettings, database });
    await auth.prepare();
    lessons = database;
  } else if (selected === 'postgresql') {
    startupStage = 'Prisma Client module loading and initialization';
    const module = await import(production ? './prisma-production.js' : './prisma-development.js');
    const client = production ? module.createProductionClient() : module.createDevelopmentClient();
    close = () => client.$disconnect();
    startupStage = 'pooled DATABASE_URL connection and database identity query';
    // Authenticate and confirm the actual database name before serving application requests.
    const identity = await client.$queryRaw`SELECT current_database() AS name`;
    const expected = production ? process.env.PRODUCTION_DB_NAME : process.env.COACHLAB_DEV_EXPECTED_DATABASE;
    if (identity[0].name !== expected) throw new StartupCheckError('Connected database does not match the expected database name.');
    startupStage = 'Lesson table query after migrations';
    await client.lesson.count();
    startupStage = 'authentication initialization';
    auth = createAuth({ ...authSettings, prisma: client });
    lessons = prismaLessons(client);
    classes = prismaClasses(client);
  } else {
    throw new Error('Unsupported database selection.');
  }
  startupStage = 'Express and built React initialization';
  const server = createApp(lessons, { auth, allowedOrigins, production, classes }).listen(port, host, () => {
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
  if (process.env.NODE_ENV === 'production') {
    console.error(startupFailure(startupStage, error));
  } else {
    if (/authentication secret/.test(error?.message)) console.error('Login is not configured: set BETTER_AUTH_SECRET (at least 32 random characters) in the ignored .env file. CoachLab will not serve lessons without login.');
    console.error('Could not initialize the selected database. Check server configuration and connectivity. No fallback was attempted.');
  }
  process.exitCode = 1;
}
