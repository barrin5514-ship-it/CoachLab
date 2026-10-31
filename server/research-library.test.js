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
