import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { migrate } from './migrations.js';

let database;
try {
  database = openDatabase();
  migrate(database);
  const server = createApp(database).listen(3001, '127.0.0.1', () => {
    console.log('CoachLab API listening at http://127.0.0.1:3001');
  });
  server.on('error', () => {
    database.close();
    console.error('Could not start CoachLab API. Check whether port 3001 is already in use.');
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => database.close()));
  }
} catch {
  if (database?.open) database.close();
  console.error('Could not initialize CoachLab database. Check DATABASE_PATH and run npm run db:migrate.');
  process.exitCode = 1;
}
