// Opens the configured SQLite file while leaving PostgreSQL selection to startup.
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { databasePath } from './config.js';

// Creates the parent folder when needed and opens the configured SQLite file.
export function openDatabase() {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  return new Database(databasePath);
}
