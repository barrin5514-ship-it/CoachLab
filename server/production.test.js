import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from './app.js';
import { listenerSettings } from './web.js';
import { productionDatabaseSettings } from './production-database.js';
import { deployMigrations } from './deploy-migrations.js';
import { productionSecuritySettings } from './production-security.js';

test('production binds the hosting port while development stays local', () => {
  assert.deepEqual(listenerSettings({}), { port: 3001, host: '127.0.0.1' });
  assert.deepEqual(listenerSettings({ NODE_ENV: 'production', PORT: '12345' }), { port: 12345, host: '0.0.0.0' });
  for (const port of ['0', '65536', 'abc']) assert.throws(() => listenerSettings({ NODE_ENV: 'production', PORT: port }));
});

test('production requires one public HTTPS origin and a strong authentication secret', () => {
  const env = { APP_URL: 'https://coachlab.example/', BETTER_AUTH_SECRET: 'test-only-secret-'.repeat(4) };
  assert.deepEqual(productionSecuritySettings(env), { publicUrl: 'https://coachlab.example', allowedOrigins: ['https://coachlab.example'] });
  for (const APP_URL of ['', 'http://coachlab.example', 'https://localhost', 'https://coachlab.example/path', 'https://user:password@coachlab.example', 'https://coachlab.example/?query=1']) assert.throws(() => productionSecuritySettings({ ...env, APP_URL }));
  assert.throws(() => productionSecuritySettings({ ...env, BETTER_AUTH_SECRET: 'short' }));
});

test('production database configuration rejects unsafe or mismatched targets without connecting', () => {
  const env = { NODE_ENV: 'production', COACHLAB_DB_ENV: 'production', PRODUCTION_DB_HOST: 'ep-production.example.neon.tech', PRODUCTION_DB_NAME: 'neondb', DATABASE_URL: 'postgresql://test:test@ep-production-pooler.example.neon.tech/neondb?sslmode=require', DIRECT_URL: 'postgresql://test:test@ep-production.example.neon.tech/neondb?sslmode=require' };
  const settings = productionDatabaseSettings(env);
  let calls = 0;
  const run = (command, args, options) => {
    calls++;
    assert.equal(command, process.execPath);
    assert.deepEqual(args.slice(1, 4), ['migrate', 'deploy', '--config']);
    assert.equal(options.env, env);
    assert.equal(options.stdio, 'pipe');
    return { status: 0 };
  };
  deployMigrations(env, run);
  assert.equal(calls, 1);
  assert.throws(() => deployMigrations(env, () => ({ status: 1 })), /Startup stopped/);
  assert.throws(() => deployMigrations({}, run));
  assert.equal(calls, 1);
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
  let forwarded;
  const auth = { getUser: async request => { forwarded = request.headers['x-forwarded-for']; return { id: 'test-coach' }; } };
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
  await fetch(base + '/api/lessons', { headers: { 'x-forwarded-for': '203.0.113.99, 198.51.100.7' } });
  assert.equal(forwarded, '198.51.100.7');
  assert.equal(app.get('trust proxy'), 1);
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.match(await (await fetch(base + '/example.js')).text(), /test asset/);
  assert.throws(() => createApp({}, { auth, production: true, frontendDirectory: join(directory, 'absent') }), /Build the React/);
});
