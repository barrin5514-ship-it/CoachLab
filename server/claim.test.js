import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrations.js';
import { sqliteLessons } from './lesson-store.js';
import { claimLessons, sqliteClaimStore, assertSafeBackupDirectory } from './claim.js';

function fixture(t) {
  const database = new Database(':memory:');
  migrate(database);
  database.exec(`CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, email TEXT)`);
  database.prepare('INSERT INTO user VALUES (?, ?, ?)').run('coach-1', 'Coach One', 'one@example.com');
  database.prepare('INSERT INTO user VALUES (?, ?, ?)').run('coach-2', 'Coach Two', 'two@example.com');
  const insert = database.prepare('INSERT INTO lessons (title, discipline, drills, owner_id) VALUES (?, ?, ?, ?)');
  insert.run('Old lesson A', 'Boxing', 'Warm-up — 5 minutes', null);
  insert.run('Old lesson B', 'MMA', '', null);
  insert.run('Coach Two plan', 'Wrestling', '', 'coach-2');
  database.prepare("INSERT INTO lesson_media (lesson_id, kind, origin, url, title) VALUES (1, 'youtube', 'link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Old video')").run();
  database.prepare("INSERT INTO lesson_media (lesson_id, owner_id, kind, origin, url, title) VALUES (3, 'coach-2', 'youtube', 'link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Theirs')").run();
  const backupRoot = mkdtempSync(path.join(tmpdir(), 'coachlab-claim-'));
  t.after(() => { database.close(); rmSync(backupRoot, { recursive: true, force: true }); });
  return { database, store: sqliteClaimStore(database), backupRoot };
}

test('a dry run lists what would be claimed and changes nothing', async t => {
  const { database, store, backupRoot } = fixture(t);
  const lines = [];
  const result = await claimLessons({ store, email: 'ONE@example.com', allUnclaimed: true, backupRoot, log: line => lines.push(line) });
  assert.equal(result.dryRun, true);
  assert.equal(result.changed, false);
  assert.ok(lines.some(line => line.includes('Old lesson A') && line.includes('1 attachment')));
  assert.ok(lines.some(line => line.includes('Dry run')));
  assert.equal(database.prepare('SELECT count(*) AS n FROM lessons WHERE owner_id IS NULL').get().n, 2);
  assert.equal(existsSync(path.join(backupRoot, 'anything')), false);
});

test('confirming writes a verified backup first, then hands only the chosen unclaimed lessons and their media to that coach', async t => {
  const { database, store, backupRoot } = fixture(t);
  const result = await claimLessons({ store, email: 'one@example.com', lessonIds: [1], confirm: true, backupRoot });
  assert.deepEqual({ changed: result.changed, claimed: result.claimed, media: result.media }, { changed: true, claimed: 1, media: 1 });
  const backup = JSON.parse(readFileSync(result.backup, 'utf8'));
  assert.equal(backup.lessons.length, 1);
  assert.equal(backup.lessons[0].title, 'Old lesson A');
  assert.equal(backup.lessons[0].owner_id, null);
  assert.equal(backup.media.length, 1);
  assert.equal(database.prepare('SELECT owner_id FROM lessons WHERE id = 1').get().owner_id, 'coach-1');
  assert.equal(database.prepare('SELECT owner_id FROM lesson_media WHERE lesson_id = 1').get().owner_id, 'coach-1');
  assert.equal(database.prepare('SELECT owner_id FROM lessons WHERE id = 2').get().owner_id, null);
  assert.equal(database.prepare('SELECT owner_id FROM lessons WHERE id = 3').get().owner_id, 'coach-2');
  const lessons = sqliteLessons(database);
  assert.deepEqual(lessons.list('coach-1').map(item => item.title), ['Old lesson A']);
  assert.equal(lessons.media.list('coach-1').length, 1);
  assert.deepEqual(lessons.list('coach-2').map(item => item.title), ['Coach Two plan']);
});

test('lessons that already belong to someone can never be claimed, and bad requests change nothing', async t => {
  const { database, store, backupRoot } = fixture(t);
  await assert.rejects(claimLessons({ store, email: 'one@example.com', lessonIds: [3], confirm: true, backupRoot }), /not found among unclaimed/);
  await assert.rejects(claimLessons({ store, email: 'nobody@example.com', allUnclaimed: true, confirm: true, backupRoot }), /No registered coach/);
  await assert.rejects(claimLessons({ store, email: 'one@example.com', confirm: true, backupRoot }), /Choose the lessons/);
  await assert.rejects(claimLessons({ store, lessonIds: [1], confirm: true, backupRoot }), /--email/);
  await assert.rejects(claimLessons({ store, email: 'one@example.com', allUnclaimed: true, confirm: true, backupRoot: path.join(homedir(), 'OneDrive', 'Desktop', 'backups') }), /outside OneDrive/);
  assert.equal(database.prepare('SELECT count(*) AS n FROM lessons WHERE owner_id IS NULL').get().n, 2);
  assert.equal(database.prepare('SELECT owner_id FROM lessons WHERE id = 3').get().owner_id, 'coach-2');
  assert.throws(() => assertSafeBackupDirectory(path.join(homedir(), 'OneDrive - Company', 'x')), /outside OneDrive/);
  assert.equal(assertSafeBackupDirectory(path.join(homedir(), 'CoachLab-backups')), path.join(homedir(), 'CoachLab-backups'));
  const again = await claimLessons({ store, email: 'one@example.com', allUnclaimed: true, confirm: true, backupRoot });
  assert.equal(again.claimed, 2);
  const none = await claimLessons({ store, email: 'two@example.com', allUnclaimed: true, confirm: true, backupRoot });
  assert.equal(none.changed, false);
});
