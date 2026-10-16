import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { migrate } from './migrations.js';

function run(code, filename) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, DATABASE_PATH: filename }, encoding: 'utf8',
  });
  assert.equal(result.error, undefined);
  return result;
}

test('database configuration accepts external paths and rejects unsafe paths', () => {
  const code = "import { databasePath } from './server/config.js'; console.log(databasePath);";
  const defaultResult = run(code, '');
  assert.equal(defaultResult.status, 0);
  assert.equal(defaultResult.stdout.trim(), path.join(homedir(), 'AppData', 'Local', 'CoachLab', 'coachlab.sqlite'));
  const custom = path.join(tmpdir(), 'coachlab-custom.sqlite');
  assert.equal(run(code, custom).stdout.trim(), custom);
  for (const invalid of ['relative.sqlite', path.join(homedir(), 'OneDrive', 'bad.sqlite'), path.join(homedir(), 'OneDrive - Company', 'bad.sqlite')]) {
    assert.notEqual(run(code, invalid).status, 0);
  }
});

test('versioned migration, constraints, and persistence across processes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'coachlab-test-'));
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith('coachlab-test-'));
  const filename = path.join(directory, 'nested', 'lessons.sqlite');
  let database;
  try {
    const migrationCode = "import './server/migrate.js';";
    assert.equal(run(migrationCode, filename).status, 0);
    database = new Database(filename);
    assert.deepEqual(database.prepare('PRAGMA table_info(lessons)').all().map(column => column.name), ['id', 'title', 'discipline', 'skill_level', 'duration_minutes', 'goal', 'drills', 'coaching_notes', 'created_at']);
    const title = "Coach's jab; DROP TABLE lessons; --";
    const insert = database.prepare('INSERT INTO lessons (title, discipline, duration_minutes) VALUES (?, ?, ?)');
    insert.run(title, 'Boxing', 45);
    for (const values of [[' ', 'Boxing', 45], ['Test', 'Unknown', 45], ['Test', 'Boxing', -1], ['Test', 'Boxing', 1.5]]) {
      assert.throws(() => insert.run(...values));
    }
    assert.throws(() => database.prepare('INSERT INTO lessons (title, discipline, skill_level) VALUES (?, ?, ?)').run('Test', 'Boxing', 'Expert'));
    const saved = database.prepare('SELECT * FROM lessons').get();
    assert.equal(saved.skill_level, 'Beginner');
    assert.equal(saved.goal, '');
    assert.ok(Number.isFinite(Date.parse(saved.created_at)));
    database.close();
    assert.equal(run(migrationCode, filename).status, 0);
    const reader = run("import { openDatabase } from './server/database.js'; const db = openDatabase(); console.log(JSON.stringify(db.prepare('SELECT * FROM lessons').all())); db.close();", filename);
    assert.equal(reader.status, 0);
    assert.deepEqual(JSON.parse(reader.stdout), [saved]);
    database = new Database(filename);
    assert.deepEqual(database.prepare('SELECT version FROM schema_migrations').all(), [{ version: 1 }, { version: 2 }]);
    assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    if (database?.open) database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('migration failure rolls back the schema and version together', () => {
  const database = new Database(':memory:');
  try {
    database.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)');
    database.exec("CREATE TRIGGER reject_version BEFORE INSERT ON schema_migrations BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    assert.throws(() => migrate(database), /test failure/);
    assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name = 'lessons'").get(), undefined);
    assert.equal(database.prepare('SELECT count(*) AS count FROM schema_migrations').get().count, 0);
  } finally {
    database.close();
  }
});
