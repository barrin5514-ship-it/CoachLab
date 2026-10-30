// Selects a local SQLite path outside OneDrive to avoid cloud-sync database conflicts.
import { homedir } from 'node:os';
import path from 'node:path';

// This only chooses the future database location; it does not create a database.
export const databasePath = process.env.DATABASE_PATH?.trim()
  || path.join(homedir(), 'AppData', 'Local', 'CoachLab', 'coachlab.sqlite');

if (!path.isAbsolute(databasePath)) {
  throw new Error('DATABASE_PATH must be an absolute path outside OneDrive.');
}

// Cloud sync can race database writes; require the SQLite file outside OneDrive.
if (path.resolve(databasePath).split(path.sep).some(part => /^onedrive(?:\s|$)/i.test(part))) {
  throw new Error('DATABASE_PATH must be outside OneDrive.');
}
