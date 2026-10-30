// Checks postgres auth behavior with controlled fixtures; read each test name for its expected outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { memoryMailer } from './mailer.js';
import { prismaLessons } from './lesson-store.js';
import { prismaClaimStore, claimLessons } from './claim.js';
import { createDevelopmentClient } from './prisma-development.js';
import { cookieClient } from './test-auth.js';
import { png } from './media-fixtures.js';

const origin = 'http://coachlab.test';
const password = 'violet-harbor-ladder-92';

test('PostgreSQL accounts: real Better Auth through Prisma, private lessons and media, claiming old lessons, reset and logout', { skip: process.env.COACHLAB_RUN_POSTGRES_TESTS !== 'verified-development', timeout: 240000 }, async t => {
  const env = process.env;
  assert.equal(env.COACHLAB_DEV_PROJECT_ID, 'rapid-firefly-98778665');
  assert.equal(env.COACHLAB_DEV_BRANCH_ID, 'br-flat-fog-b5t1m0vy');
  const schema = 'coachlab_test_' + randomUUID().replaceAll('-', '');
  const direct = new URL(env.COACHLAB_DEV_DIRECT_URL);
  assert.ok(direct.hostname.startsWith('ep-long-bird-b50l2nhb.') && direct.hostname === env.COACHLAB_DEV_EXPECTED_HOST.replace('-pooler.', '.'));
  assert.equal(direct.pathname, '/neondb');
  direct.search = '';
  const admin = new pg.Client({ connectionString: direct.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  const backupRoot = mkdtempSync(path.join(tmpdir(), 'coachlab-pgclaim-'));
  let client, server, created = false;
  try {
    await admin.connect();
    assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name, 'neondb');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await admin.query('BEGIN');
    await admin.query(`SET LOCAL search_path TO "${schema}"`);
    for (const name of readdirSync(new URL('../prisma/migrations/', import.meta.url), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
      await admin.query(readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8').replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
    }
    await admin.query("INSERT INTO lessons (title, discipline, drills) VALUES ('Lesson from before accounts', 'Boxing', 'Warm-up — 5 minutes')");
    await admin.query("INSERT INTO lesson_media (lesson_id, kind, origin, url, title) VALUES (1, 'youtube', 'link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Old video')");
    await admin.query('COMMIT');
    client = createDevelopmentClient(env, schema);
    const mailer = memoryMailer();
    const auth = createAuth({ prisma: client, secret: randomBytes(32).toString('hex'), baseURL: origin, trustedOrigins: [origin], mailer });
    server = createApp(prismaLessons(client), { auth, allowedOrigins: [origin], verifyLink: async url => ({ kind: 'image', url, title: 'Checked', credit: '', source_page: '' }) }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const clientFor = cookieClient(base, origin);
    // Registers and signs in a separate test coach to check account isolation.
    const join = async (email, ip) => {
      const api = clientFor(ip);
      assert.equal((await api('/api/auth/sign-up/email', { method: 'POST', body: { name: 'Coach', email, password } })).status, 200);
      assert.equal((await api('/api/auth/sign-in/email', { method: 'POST', body: { email, password } })).status, 200);
      return api;
    };
    const a = await join('a@example.com', '203.0.113.31');
    const b = await join('b@example.com', '203.0.113.32');
    assert.equal((await clientFor('203.0.113.33')('/api/lessons')).status, 401);
    assert.equal((await a('/api/auth/get-session')).json.user.email, 'a@example.com');
    assert.deepEqual((await a('/api/lessons')).json, [], 'a lesson from before accounts must stay hidden');
    const stored = (await admin.query(`SELECT a.password FROM "${schema}".auth_accounts a JOIN "${schema}".auth_users u ON u.id = a.user_id WHERE u.email = 'a@example.com'`)).rows[0].password;
    assert.ok(!stored.includes(password) && /^[0-9a-f]+:[0-9a-f]+$/.test(stored));
    assert.equal((await admin.query(`SELECT count(*)::int AS n FROM "${schema}".auth_sessions`)).rows[0].n, 2);
    const upload = (await a('/api/media/upload', { method: 'POST', raw: true, body: png, headers: { 'content-type': 'image/png', 'x-file-name': 'private.png' } })).json;
    const lesson = (await a('/api/lessons', { method: 'POST', body: { title: 'A private plan', discipline: 'Boxing', media: [{ id: upload.id, title: 'Mine' }, { url: 'https://example.com/a.png', title: 'Link' }] } })).json;
    assert.equal(Object.keys(lesson).join(), 'id,title,discipline,skill_level,duration_minutes,goal,drills,coaching_notes,created_at');
    assert.equal((await a('/api/lesson-media')).json.length, 2);
    assert.deepEqual((await b('/api/lessons')).json, []);
    assert.deepEqual((await b('/api/lesson-media')).json, []);
    assert.equal((await b(`/api/media/${upload.id}/file`)).status, 404);
    assert.equal((await b(`/api/lessons/${lesson.id}`, { method: 'PUT', body: { title: 'Hijack', discipline: 'MMA', media: [] } })).status, 404);
    assert.equal((await b(`/api/lessons/${lesson.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await b('/api/lessons', { method: 'POST', body: { title: 'Steal', discipline: 'MMA', media: [{ id: upload.id }] } })).status, 400);
    assert.equal((await a(`/api/media/${upload.id}/file`)).status, 200);
    assert.equal((await a('/api/lessons', { method: 'POST', origin: 'http://evil.example', body: { title: 'x', discipline: 'MMA' } })).status, 403);
    const store = prismaClaimStore(client);
    const dry = await claimLessons({ store, email: 'b@example.com', allUnclaimed: true, backupRoot });
    assert.equal(dry.dryRun, true);
    assert.deepEqual((await b('/api/lessons')).json, []);
    await assert.rejects(claimLessons({ store, email: 'b@example.com', lessonIds: [lesson.id], confirm: true, backupRoot }), /not found among unclaimed/);
    const claimed = await claimLessons({ store, email: 'b@example.com', allUnclaimed: true, confirm: true, backupRoot });
    assert.deepEqual({ claimed: claimed.claimed, media: claimed.media }, { claimed: 1, media: 1 });
    assert.equal((await b('/api/lessons')).json[0].title, 'Lesson from before accounts');
    assert.equal((await b('/api/lesson-media')).json.length, 1);
    assert.equal((await a('/api/lessons')).json.length, 1);
    const reset = clientFor('203.0.113.34');
    assert.equal((await reset('/api/auth/request-password-reset', { method: 'POST', body: { email: 'a@example.com', redirectTo: '/reset-password' } })).status, 200);
    const link = new URL(mailer.outbox.find(mail => mail.kind === 'reset').url);
    const token = new URL((await reset(link.pathname + link.search, { redirect: 'manual' })).headers.get('location'), origin).searchParams.get('token');
    assert.equal((await reset('/api/auth/reset-password', { method: 'POST', body: { newPassword: 'blue-lantern-orchard-55', token } })).status, 200);
    assert.equal((await a('/api/lessons')).status, 401, 'reset must end old sessions');
    assert.equal((await clientFor('203.0.113.35')('/api/auth/sign-in/email', { method: 'POST', body: { email: 'a@example.com', password: 'blue-lantern-orchard-55' } })).status, 200);
    assert.equal((await b('/api/auth/sign-out', { method: 'POST', body: {} })).status, 200);
    assert.equal((await b('/api/lessons')).status, 401);
    assert.ok((await admin.query(`SELECT count(*)::int AS n FROM "${schema}".auth_rate_limits`)).rows[0].n > 0, 'rate limits are stored in the database');
    t.diagnostic('Real Better Auth on PostgreSQL: isolation, claiming, reset and logout verified in a disposable schema.');
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await client?.$disconnect();
    await admin.query('ROLLBACK').catch(() => {});
    if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    rmSync(backupRoot, { recursive: true, force: true });
  }
});
