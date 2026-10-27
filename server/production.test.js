import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from './app.js';
import { listenerSettings } from './web.js';
import { productionDatabaseSettings } from './production-database.js';

test('production binds the hosting port while development stays local', () => {
  assert.deepEqual(listenerSettings({}), { port: 3001, host: '127.0.0.1' });
  assert.deepEqual(listenerSettings({ NODE_ENV: 'production', PORT: '12345' }), { port: 12345, host: '0.0.0.0' });
  for (const port of ['0', '65536', 'abc']) assert.throws(() => listenerSettings({ NODE_ENV: 'production', PORT: port }));
});

test('production database configuration rejects unsafe or mismatched targets without connecting', () => {
  const env = { NODE_ENV: 'production', COACHLAB_DB_ENV: 'production', PRODUCTION_DB_HOST: 'ep-production.example.neon.tech', PRODUCTION_DB_NAME: 'neondb', DATABASE_URL: 'postgresql://test:test@ep-production-pooler.example.neon.tech/neondb?sslmode=require', DIRECT_URL: 'postgresql://test:test@ep-production.example.neon.tech/neondb?sslmode=require' };
  const settings = productionDatabaseSettings(env);
  assert.equal(new URL(settings.direct).searchParams.get('sslmode'), 'verify-full');
  assert.equal(new URL(settings.pooled).search, '');
  for (const override of [{ NODE_ENV: 'development' }, { COACHLAB_DB_ENV: 'development' }, { COACHLAB_DATABASE: 'sqlite' }, { DATABASE_URL: 'invalid' }, { PRODUCTION_DB_NAME: 'wrong' }, { DIRECT_URL: env.DIRECT_URL.replace('test:test', 'test:other') }, { DIRECT_URL: env.DIRECT_URL.replace('sslmode=require', 'sslmode=disable') }, { DIRECT_URL: env.DATABASE_URL }, { COACHLAB_DEV_EXPECTED_HOST: 'ep-production-pooler.example.neon.tech' }]) {
    assert.throws(() => productionDatabaseSettings({ ...env, ...override }));
  }
});

test('production serves React browser routes without swallowing API or missing assets', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'coachlab-web-'));
  writeFileSync(join(directory, 'index.html'), '<html>CoachLab test shell</html>');
  writeFileSync(join(directory, 'example.js'), '/* test asset */');
  const auth = { getUser: async () => ({ id: 'test-coach' }) };
  const app = createApp({ list: async () => [] }, { auth, production: true, frontendDirectory: directory });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/lesson/123', '/reset-password']) {
    const response = await fetch(base + path, { headers: { accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /CoachLab test shell/);
  }
  assert.deepEqual(await (await fetch(base + '/api/lessons')).json(), []);
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.match(await (await fetch(base + '/example.js')).text(), /test asset/);
  assert.throws(() => createApp({}, { auth, production: true, frontendDirectory: join(directory, 'absent') }), /Build the React/);
});
