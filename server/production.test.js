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
import { productionApiGuard } from './request-guard.js';
import { startProduction } from './production-startup.js';
import { StartupCheckError, startupFailure } from './startup-errors.js';

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
  assert.throws(() => deployMigrations(env, () => ({ status: 1 })), /prisma migrate deploy failed/);
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
  for (const path of ['/api/lessons', '/api/media/upload', '/api/auth/sign-in/email']) {
    const rejected = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, body: 'not a compressed stream' });
    assert.equal(rejected.status, 415);
    assert.match((await rejected.json()).error, /Compressed request/);
  }
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.match(await (await fetch(base + '/example.js')).text(), /test asset/);
  assert.throws(() => createApp({}, { auth, production: true, frontendDirectory: join(directory, 'absent') }), /Build the React/);
});

test('production API limiter bounds memory, separates clients and expires limits without blocking health', () => {
  let time = 1000;
  const guard = productionApiGuard({ now: () => time, limit: 2, maxClients: 2 });
  const call = (ip, path = '/lessons') => {
    const result = { status: 200, headers: {} };
    const response = { set: (name, value) => { result.headers[name] = value; return response; }, status: value => { result.status = value; return response; }, json: body => { result.body = body; } };
    guard({ method: 'GET', path, ip, headers: {}, socket: {} }, response, () => { result.next = true; });
    return result;
  };
  assert.equal(call('client-a').next, true);
  assert.equal(call('client-a').next, true);
  assert.equal(call('client-a').status, 429);
  assert.equal(call('client-a').headers['Retry-After'], '60');
  assert.equal(call('client-b').next, true);
  assert.equal(call('client-c').status, 503);
  assert.equal(call('client-c', '/health').next, true);
  time += 60000;
  assert.equal(call('client-c').next, true);
  assert.equal(call('client-a').next, true);
});

test('startup diagnostics identify settings without disclosing their values', () => {
  const env = { NODE_ENV: 'production', COACHLAB_DB_ENV: 'production', PRODUCTION_DB_HOST: 'ep-production.example.neon.tech', PRODUCTION_DB_NAME: 'neondb', DATABASE_URL: 'postgresql://test:test@ep-production-pooler.example.neon.tech/neondb?sslmode=require', DIRECT_URL: 'postgresql://test:test@ep-production.example.neon.tech/neondb?sslmode=require' };
  const cases = [
    [{ NODE_ENV: 'private-sentinel' }, /NODE_ENV/],
    [{ COACHLAB_DB_ENV: 'private-sentinel' }, /COACHLAB_DB_ENV/],
    [{ COACHLAB_DATABASE: 'private-sentinel' }, /COACHLAB_DATABASE/],
    [{ DATABASE_URL: 'private-sentinel' }, /DATABASE_URL.*valid URL/],
    [{ DIRECT_URL: 'private-sentinel' }, /DIRECT_URL.*valid URL/],
    [{ PRODUCTION_DB_HOST: 'private-sentinel' }, /PRODUCTION_DB_HOST.*host/],
    [{ PRODUCTION_DB_NAME: 'private-sentinel' }, /PRODUCTION_DB_NAME.*name/],
    [{ DIRECT_URL: env.DIRECT_URL.replace('test:test', 'test:private-sentinel') }, /match on password/],
    [{ DIRECT_URL: env.DATABASE_URL }, /DIRECT_URL.*without -pooler/],
    [{ DATABASE_URL: env.DIRECT_URL }, /DATABASE_URL.*pooled/],
    [{ DIRECT_URL: env.DIRECT_URL.replace('sslmode=require', 'sslmode=private-sentinel') }, /DIRECT_URL.*sslmode/],
    [{ DIRECT_URL: env.DIRECT_URL + '&private-sentinel=yes' }, /unsupported query parameters/],
  ];
  for (const [override, expected] of cases) {
    assert.throws(() => productionDatabaseSettings({ ...env, ...override }), error => {
      const message = startupFailure('configuration', error);
      assert.match(message, expected);
      assert.doesNotMatch(message, /private-sentinel|postgresql:\/\/|ep-production/);
      return true;
    });
  }
  for (const code of ['P1000', 'P1001', 'P1011', 'P1012', 'P3005', 'P3009', 'P3018', 'P9999']) {
    assert.throws(() => deployMigrations(env, () => ({ status: 1, stderr: `Error: ${code} private-sentinel ${env.DIRECT_URL}` })), error => {
      assert.match(error.message, /prisma migrate deploy failed/);
      assert.doesNotMatch(error.message, /private-sentinel|postgresql:\/\/|ep-production|P9999/);
      if (code !== 'P9999') assert.ok(error.message.includes(code));
      return true;
    });
  }
  assert.throws(() => deployMigrations(env, () => ({ error: { code: 'ETIMEDOUT', message: 'private-sentinel' } })), /five-minute/);
  assert.throws(() => deployMigrations(env, () => ({ error: { code: 'ENOENT', message: 'private-sentinel' } })), /could not execute/);
  assert.doesNotMatch(startupFailure('database query', new Error('private-sentinel')), /private-sentinel/);
  assert.match(startupFailure('Lesson table query', { code: 'P2021', message: 'private-sentinel' }), /P2021/);
});

test('startup migrates an empty database before loading application and stops on migration failure', async () => {
  const env = { APP_URL: 'https://coachlab.example', BETTER_AUTH_SECRET: 'test-only-secret-'.repeat(4) };
  const tables = [];
  await startProduction({ ...env }, async () => { tables.push('lessons'); }, async () => {
    assert.deepEqual(tables, ['lessons']);
  });
  let started = false;
  await assert.rejects(startProduction({ ...env }, async () => { throw new StartupCheckError('prisma migrate deploy failed.'); }, async () => { started = true; }), /database configuration and prisma migrate deploy/);
  assert.equal(started, false);
  await assert.rejects(startProduction({ ...env, APP_URL: 'private-sentinel' }), /APP_URL and BETTER_AUTH_SECRET validation/);
  await assert.rejects(startProduction({ ...env, PORT: 'invalid' }), /PORT validation/);
  await assert.rejects(startProduction({ ...env }, async () => {}, async () => { throw new Error('private-sentinel'); }), error => {
    assert.match(error.message, /application module loading/);
    assert.doesNotMatch(error.message, /private-sentinel/);
    return true;
  });
});
