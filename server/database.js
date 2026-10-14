import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { databasePath } from './config.js';

export function openDatabase() {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  return new Database(databasePath);
}
