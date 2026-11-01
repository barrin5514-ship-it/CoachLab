import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from './migrations.js';
import { sqliteResearchLibrary } from './research-library.js';

test('research library stores posts per owner and dedupes by source link', () => {
  const db = new Database(':memory:');
  migrate(db);
  const library = sqliteResearchLibrary(db);
  const post = { source_id: 'https://www.instagram.com/p/One/', title: 'Jab drill', url: 'https://www.instagram.com/p/One/', summary: 'A jab.', transcript: 'Keep the elbow in.', discipline: 'Boxing', drills: 'jab, cross' };
  assert.ok(library.add('owner-a', post));
  assert.equal(library.add('owner-a', post), null);
  assert.equal(library.list('owner-a').length, 1);
  assert.equal(library.list('owner-b').length, 0);
  const saved = library.list('owner-a')[0];
  assert.equal(saved.title, 'Jab drill');
  assert.equal(saved.drills, 'jab, cross');
  db.close();
});

test('finds the coach account by email and counts accounts and posts', () => {
  const db = new Database(':memory:');
  migrate(db);
  db.exec("CREATE TABLE auth_users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, email_verified INTEGER, created_at TEXT)");
  db.prepare('INSERT INTO auth_users VALUES (?,?,?,?,?)').run('one', 'Coach One', 'coach@example.com', 1, '2026-01-01');
  db.prepare('INSERT INTO auth_users VALUES (?,?,?,?,?)').run('two', 'Coach Two', 'other@example.com', 1, '2026-01-02');
  const library = sqliteResearchLibrary(db);
  assert.equal(library.findUserByEmail('COACH@example.com'), 'one');
  assert.equal(library.findUserByEmail('missing@example.com'), null);
  assert.equal(library.countUsers(), 2);
  library.add('one', { source_id: 'https://www.instagram.com/p/One/', title: 'Jab', url: 'https://www.instagram.com/p/One/', summary: 'A jab.', transcript: '', discipline: 'Boxing', drills: 'jab' });
  assert.equal(library.countPosts('one'), 1);
  assert.equal(library.countPosts('two'), 0);
  db.close();
});
