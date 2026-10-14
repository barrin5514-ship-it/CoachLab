import { openDatabase } from './database.js';
import { migrate } from './migrations.js';

const database = openDatabase();
try {
  migrate(database);
  console.log('Database migrations are up to date.');
} finally {
  database.close();
}
