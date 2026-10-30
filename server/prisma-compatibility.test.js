// Checks prisma compatibility behavior with controlled fixtures; read each test name for its expected outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadConfigFromFile } from '@prisma/config';
import { deepmerge } from 'deepmerge-ts';

test('Prisma loads the real CoachLab configuration with the security override', async () => {
  const result = await loadConfigFromFile({ configRoot: process.cwd() });
  assert.equal(result.error, undefined);
  assert.equal(result.config.schema, resolve('prisma/schema.prisma'));
  assert.deepEqual(result.config.migrations, { path: resolve('prisma/migrations') });
});

test('configuration merging preserves nested settings and handles circular references', () => {
  const original = { migrations: { path: 'prisma/migrations' } };
  assert.deepEqual(deepmerge(original, { migrations: { seed: 'node seed.js' } }), {
    migrations: { path: 'prisma/migrations', seed: 'node seed.js' },
  });
  assert.deepEqual(original, { migrations: { path: 'prisma/migrations' } });
  const left = {};
  const right = {};
  left.self = left;
  right.self = right;
  const merged = deepmerge(left, right);
  assert.equal(merged.self, merged);
});
