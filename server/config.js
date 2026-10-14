import { homedir } from 'node:os';
import path from 'node:path';

// This only chooses the future database location; it does not create a database.
export const databasePath = process.env.DATABASE_PATH?.trim()
  || path.join(homedir(), 'AppData', 'Local', 'CoachLab', 'coachlab.sqlite');

if (!path.isAbsolute(databasePath)) {
  throw new Error('DATABASE_PATH must be an absolute path outside OneDrive.');
}

if (path.resolve(databasePath).split(path.sep).some(part => /^onedrive(?:\s|$)/i.test(part))) {
  throw new Error('DATABASE_PATH must be outside OneDrive.');
}
