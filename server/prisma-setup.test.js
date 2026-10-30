// Checks prisma setup behavior with controlled fixtures; read each test name for its expected outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDevelopmentClient } from './prisma-development.js';

test('development client fails closed without explicit safe target configuration', () => {
  assert.throws(() => createDevelopmentClient({}), /Explicit development/);
  assert.throws(() => createDevelopmentClient({ COACHLAB_DB_ENV: 'production' }), /Explicit development/);
  assert.throws(() => createDevelopmentClient({ COACHLAB_DB_ENV: 'development' }), /missing or invalid/);
});

test('generated ESM client constructs offline with strict target checks', async () => {
  const url = new URL('postgresql://test:test@ep-example-pooler.us-east-2.aws.neon.tech/coachlab_test?sslmode=require');
  const env = { COACHLAB_DB_ENV: 'development', COACHLAB_DEV_DATABASE_URL: url.href, COACHLAB_DEV_EXPECTED_HOST: url.hostname, COACHLAB_DEV_EXPECTED_DATABASE: 'coachlab_test' };
  const client = createDevelopmentClient(env);
  assert.equal(typeof client.lesson.findMany, 'function');
  assert.equal(typeof client.lesson.create, 'function');
  await client.$disconnect();
  assert.throws(() => createDevelopmentClient({ ...env, COACHLAB_DEV_EXPECTED_DATABASE: 'another' }), /does not match/);
  assert.throws(() => createDevelopmentClient({ ...env, COACHLAB_DEV_DATABASE_URL: url.href.replace('sslmode=require', 'sslmode=disable') }), /TLS/);
  assert.throws(() => createDevelopmentClient({ ...env, COACHLAB_DEV_DATABASE_URL: url.href + '&sslcert=unexpected' }), /Unsupported/);
});

test('initial migration preserves nine fields and SQLite checks without destructive SQL', () => {
  const sql = readFileSync(new URL('../prisma/migrations/20261015000100_create_lessons/migration.sql', import.meta.url), 'utf8');
  const columns = [...sql.matchAll(/^  "([a-z_]+)" /gm)].map(match => match[1]);
  assert.deepEqual(columns, ['id', 'title', 'discipline', 'skill_level', 'duration_minutes', 'goal', 'drills', 'coaching_notes', 'created_at']);
  assert.equal((sql.match(/ CHECK /g) || []).length, 4);
  assert.match(sql, /TIMESTAMPTZ\(3\)/);
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/i);
});
