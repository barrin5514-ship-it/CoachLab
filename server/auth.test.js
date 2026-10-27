import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { createApp } from './app.js';
import { migrate } from './migrations.js';
import { createAuth, attemptLimiter } from './auth.js';
import { memoryMailer } from './mailer.js';
import { passwordProblem, validateEmail, validateName } from '../client/src/password-policy.js';
import { png } from './media-fixtures.js';
import { cookieClient } from './test-auth.js';

const origin = 'http://coachlab.test';
const goodPassword = 'violet-harbor-ladder-92';

async function fixture(t, extra = {}) {
  const database = new Database(':memory:');
  migrate(database);
  const mailer = memoryMailer();
  const auth = createAuth({ database, secret: randomBytes(32).toString('hex'), baseURL: origin, trustedOrigins: [origin], mailer, ...extra });
  await auth.prepare();
  const server = createApp(database, { auth, allowedOrigins: [origin], verifyLink: async url => ({ kind: 'image', url, title: 'Checked', credit: '', source_page: '' }) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); database.close(); });
  const client = cookieClient(base, origin);
  return { base, database, mailer, auth, client };
}

const register = (api, email, password = goodPassword, name = 'Coach') => api('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password } });
const signIn = (api, email, password = goodPassword) => api('/api/auth/sign-in/email', { method: 'POST', body: { email, password } });
async function signedIn(f, email, ip) {
  const api = f.client(ip);
  assert.equal((await register(api, email)).status, 200);
  assert.equal((await signIn(api, email)).status, 200);
  return api;
}

test('password and profile rules reject weak, common and personal passwords with clear reasons', () => {
  assert.equal(passwordProblem(goodPassword, 'a@example.com'), null);
  for (const [password, email, expected] of [['short1', '', /at least 10/], ['x'.repeat(129), '', /at most 128/], ['password123', '', /too common/], ['aaaaaaaaaaaa', '', /mix of characters/], ['12345678901', '', /mix of characters/], ['mysterycoach-2026', 'mysterycoach@example.com', /email name/], [42, '', /Enter a password/]]) assert.match(passwordProblem(password, email), expected, String(password));
  assert.equal(validateEmail('coach@example.com'), null);
  for (const bad of ['', 'nope', 'a@b', 'a b@example.com', '<x>@example.com', 'a@example.com<script>']) assert.ok(validateEmail(bad), bad);
  assert.equal(validateName('Ana Silva'), null);
  for (const bad of ['', '   ', 'x'.repeat(81), '<b>Ana</b>', 'Ana\u0007']) assert.ok(validateName(bad), JSON.stringify(bad));
});

test('the server refuses to start authentication without a long random secret', () => {
  const settings = { database: new Database(':memory:'), baseURL: origin, trustedOrigins: [origin], mailer: memoryMailer() };
  assert.throws(() => createAuth({ ...settings, secret: undefined }), /secret/);
  assert.throws(() => createAuth({ ...settings, secret: 'too short' }), /secret/);
  assert.throws(() => createApp(new Database(':memory:'), {}), /authentication adapter is required/);
});

test('production authentication marks its session cookie Secure behind HTTPS', async t => {
  const f = await fixture(t, { env: { NODE_ENV: 'production' } });
  const api = f.client();
  await register(api, 'production-cookie@example.com');
  const response = await signIn(api, 'production-cookie@example.com');
  assert.equal(response.status, 200);
  assert.ok(response.setCookie.some(cookie => /; Secure(?:;|$)/i.test(cookie)));
});

test('registration validates input, hides whether an email already exists and never stores a plain password', async t => {
  const f = await fixture(t);
  const api = f.client();
  for (const [body, expected] of [[{ name: 'Ana', email: 'ana@example.com', password: 'short' }, /at least 10/], [{ name: 'Ana', email: 'nope', password: goodPassword }, /valid email/], [{ name: '', email: 'ana@example.com', password: goodPassword }, /Enter your name/], [{ name: 'Ana', email: 'ana@example.com', password: 'password123' }, /too common/]]) {
    const response = await api('/api/auth/sign-up/email', { method: 'POST', body });
    assert.equal(response.status, 400);
    assert.match(response.json.message, expected);
  }
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM user').get().n, 0);
  const first = await register(api, 'Ana@Example.com');
  assert.equal(first.status, 200);
  assert.equal(first.setCookie.length, 0);
  const again = await register(f.client('203.0.113.11'), 'ana@example.com', 'another-long-password-7');
  assert.equal(again.status, 200);
  assert.deepEqual(Object.keys(again.json.user).sort(), Object.keys(first.json.user).sort());
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM user').get().n, 1);
  assert.deepEqual(f.mailer.outbox, [{ kind: 'existing', to: 'ana@example.com' }]);
  const account = f.database.prepare("SELECT password FROM account WHERE providerId = 'credential'").get();
  assert.ok(account.password && !account.password.includes(goodPassword) && /^[0-9a-f]+:[0-9a-f]+$/.test(account.password));
  assert.equal(f.database.prepare('SELECT email FROM user').get().email, 'ana@example.com');
});

test('sign in uses one error for wrong passwords and unknown emails, sets a safe session cookie and survives refresh', async t => {
  const f = await fixture(t);
  await register(f.client(), 'coach@example.com');
  const api = f.client();
  const wrong = await signIn(api, 'coach@example.com', 'wrong-password-123');
  const unknown = await signIn(api, 'nobody@example.com', 'wrong-password-123');
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.json, unknown.json);
  assert.equal(wrong.json.message, 'Invalid email or password');
  assert.equal((await signIn(api, 'not-an-email', 'whatever-123456')).status, 401);
  const ok = await signIn(api, 'COACH@example.com');
  assert.equal(ok.status, 200);
  const cookie = ok.setCookie.find(line => line.startsWith('coachlab.session_token='));
  assert.ok(cookie && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie) && /Path=\//.test(cookie) && /Max-Age=604800/.test(cookie));
  assert.ok(!/Secure/i.test(cookie), 'plain http local development cannot use Secure cookies');
  assert.equal(ok.text.includes(goodPassword), false);
  for (let refresh = 0; refresh < 3; refresh++) {
    const session = await api('/api/auth/get-session');
    assert.equal(session.json.user.email, 'coach@example.com');
    assert.equal((await api('/api/lessons')).status, 200);
  }
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM session').get().n, 1);
});

test('repeated wrong passwords lock one account for a while even from different addresses, and IP rate limits stop floods', async t => {
  const f = await fixture(t);
  await register(f.client(), 'target@example.com');
  for (let attempt = 0; attempt < 8; attempt++) assert.equal((await signIn(f.client(`198.51.100.${attempt + 1}`), 'target@example.com', 'wrong-password-123')).status, 401);
  const locked = await signIn(f.client('198.51.100.99'), 'target@example.com', goodPassword);
  assert.equal(locked.status, 429);
  assert.match(locked.json.message, /Too many sign-in attempts/);
  const flood = f.client('198.51.100.200');
  const statuses = [];
  for (let attempt = 0; attempt < 12; attempt++) statuses.push((await signIn(flood, `nobody${attempt}@example.com`, 'wrong-password-123')).status);
  assert.ok(statuses.includes(429), statuses.join());
  const limiter = attemptLimiter({ max: 2, windowMs: 1000, now: (() => { let time = 0; return () => time; })() });
  limiter.hit('k'); limiter.hit('k');
  assert.equal(limiter.blocked('k'), true);
  limiter.clear('k');
  assert.equal(limiter.blocked('k'), false);
});

test('protected routes reject anonymous users, logout ends the session on the server and old cookies stop working', async t => {
  const f = await fixture(t);
  const anonymous = f.client();
  for (const [method, path, body] of [['GET', '/api/lessons'], ['POST', '/api/lessons', { title: 'x', discipline: 'Boxing' }], ['PUT', '/api/lessons/1', { title: 'x', discipline: 'Boxing' }], ['DELETE', '/api/lessons/1'], ['GET', '/api/lesson-media'], ['GET', '/api/media/1/file'], ['DELETE', '/api/media/1'], ['POST', '/api/media/verify', { url: 'https://example.com/a.png' }], ['POST', '/api/media/suggest', { discipline: 'Boxing', sections: [] }], ['POST', '/api/ai/lesson-draft', {}], ['GET', '/api/nothing-here']]) {
    const response = await anonymous(path, { method, body });
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal(response.json.error, 'Please sign in to continue.');
  }
  assert.equal((await anonymous('/api/health')).status, 200);
  assert.deepEqual((await anonymous('/api/auth-config')).json, { google: false, mail: 'memory' });
  const api = await signedIn(f, 'coach@example.com');
  const staleCookie = [...api.jar].map(([name, value]) => `${name}=${value}`).join('; ');
  assert.equal((await api('/api/lessons')).status, 200);
  assert.equal((await api('/api/auth/sign-out', { method: 'POST', body: {} })).status, 200);
  assert.equal((await api('/api/lessons')).status, 401);
  const replay = await f.client()('/api/lessons', { headers: { cookie: staleCookie } });
  assert.equal(replay.status, 401);
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM session').get().n, 0);
  const forged = await f.client()('/api/lessons', { headers: { cookie: 'coachlab.session_token=forged.value' } });
  assert.equal(forged.status, 401);
});

test('cross-site requests are blocked and private responses are never cached', async t => {
  const f = await fixture(t);
  const api = await signedIn(f, 'coach@example.com');
  for (const sent of [null, 'http://evil.example', 'null']) {
    const response = await api('/api/lessons', { method: 'POST', origin: sent, body: { title: 'Planted', discipline: 'Boxing' } });
    assert.equal(response.status, 403, String(sent));
  }
  assert.equal((await api('/api/lessons', { method: 'DELETE', origin: 'http://evil.example' })).status, 403);
  assert.equal((await api('/api/auth/sign-out', { method: 'POST', body: {}, origin: 'http://evil.example' })).status, 403);
  assert.equal((await api('/api/lessons')).json.length, 0);
  const lessons = await api('/api/lessons');
  assert.equal(lessons.headers.get('cache-control'), 'no-store');
  assert.equal(lessons.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(lessons.headers.get('x-powered-by'), null);
  const created = await api('/api/lessons', { method: 'POST', body: { title: 'Mine', discipline: 'Boxing' } });
  assert.equal(created.status, 201);
});

test('password reset gives the same answer for every email, sends one single-use link, and ends old sessions', async t => {
  const f = await fixture(t);
  const api = await signedIn(f, 'coach@example.com');
  const other = f.client('203.0.113.50');
  const known = await other('/api/auth/request-password-reset', { method: 'POST', body: { email: 'coach@example.com', redirectTo: '/reset-password' } });
  const unknown = await other('/api/auth/request-password-reset', { method: 'POST', body: { email: 'nobody@example.com', redirectTo: '/reset-password' } });
  assert.equal(known.status, 200);
  assert.deepEqual(known.json, unknown.json);
  assert.equal(f.mailer.outbox.filter(mail => mail.kind === 'reset').length, 1);
  const link = new URL(f.mailer.outbox.find(mail => mail.kind === 'reset').url);
  assert.equal(link.origin, origin);
  const opened = await other(link.pathname + link.search, { redirect: 'manual' });
  assert.equal(opened.status, 302);
  const token = new URL(opened.headers.get('location'), origin).searchParams.get('token');
  assert.ok(token && token.length > 10);
  assert.equal((await other('/api/auth/reset-password', { method: 'POST', body: { newPassword: 'short', token } })).status, 400);
  assert.equal((await other('/api/auth/reset-password', { method: 'POST', body: { newPassword: 'password123', token } })).status, 400);
  assert.equal((await other('/api/auth/reset-password', { method: 'POST', body: { newPassword: 'blue-lantern-orchard-55', token: 'invalid-token' } })).status, 400);
  assert.equal((await other('/api/auth/reset-password', { method: 'POST', body: { newPassword: 'blue-lantern-orchard-55', token } })).status, 200);
  assert.equal((await other('/api/auth/reset-password', { method: 'POST', body: { newPassword: 'another-new-password-9', token } })).status, 400);
  assert.equal((await api('/api/lessons')).status, 401, 'sessions from before the reset must end');
  assert.equal((await signIn(f.client('203.0.113.51'), 'coach@example.com', goodPassword)).status, 401);
  assert.equal((await signIn(f.client('203.0.113.52'), 'coach@example.com', 'blue-lantern-orchard-55')).status, 200);
});

test('password reset links cannot be requested over and over to flood one inbox', async t => {
  const f = await fixture(t);
  await register(f.client(), 'coach@example.com');
  for (let request = 0; request < 5; request++) await f.client(`203.0.113.${60 + request}`)('/api/auth/request-password-reset', { method: 'POST', body: { email: 'coach@example.com', redirectTo: '/reset-password' } });
  assert.equal(f.mailer.outbox.filter(mail => mail.kind === 'reset').length, 3);
});

test('each coach sees only their own lessons and media; guesses return 404 and never reveal another coach', async t => {
  const f = await fixture(t);
  const a = await signedIn(f, 'a@example.com', '203.0.113.21');
  const b = await signedIn(f, 'b@example.com', '203.0.113.22');
  const upload = await (await a('/api/media/upload', { method: 'POST', raw: true, body: png, headers: { 'content-type': 'image/png', 'x-file-name': 'secret.png' } })).json;
  assert.ok(upload.id);
  const lesson = (await a('/api/lessons', { method: 'POST', body: { title: 'A private plan', discipline: 'Boxing', drills: 'Warm-up — 5 minutes\nJog', media: [{ id: upload.id, title: 'A picture', activity: 'Warm-up — 5 minutes' }, { url: 'https://example.com/a.png', title: 'A link' }] } })).json;
  assert.ok(lesson.id);
  const orphan = (await a('/api/media/upload', { method: 'POST', raw: true, body: png, headers: { 'content-type': 'image/png', 'x-file-name': 'unsaved.png' } })).json;
  assert.equal((await a('/api/lessons')).json.length, 1);
  assert.equal((await a('/api/lesson-media')).json.length, 2);
  assert.equal((await a(`/api/media/${upload.id}/file`)).status, 200);
  assert.deepEqual((await b('/api/lessons')).json, []);
  assert.deepEqual((await b('/api/lesson-media')).json, []);
  for (const id of [upload.id, orphan.id]) {
    assert.equal((await b(`/api/media/${id}/file`)).status, 404);
    assert.equal((await b(`/api/media/${id}`, { method: 'DELETE' })).status, 404);
  }
  assert.equal((await b(`/api/lessons/${lesson.id}`, { method: 'PUT', body: { title: 'Hijacked', discipline: 'MMA', media: [] } })).status, 404);
  assert.equal((await b(`/api/lessons/${lesson.id}`, { method: 'DELETE' })).status, 404);
  const stolen = await b('/api/lessons', { method: 'POST', body: { title: 'Steal media', discipline: 'MMA', media: [{ id: upload.id }] } });
  assert.equal(stolen.status, 400);
  const stolenOrphan = await b('/api/lessons', { method: 'POST', body: { title: 'Steal upload', discipline: 'MMA', media: [{ id: orphan.id }] } });
  assert.equal(stolenOrphan.status, 400);
  const own = (await b('/api/lessons', { method: 'POST', body: { title: 'B plan', discipline: 'Wrestling' } })).json;
  assert.equal((await b(`/api/lessons/${own.id}`, { method: 'PUT', body: { title: 'B plan 2', discipline: 'Wrestling', media: [{ id: upload.id }] } })).status, 400);
  assert.equal((await b('/api/lessons')).json.map(item => item.title).join(), 'B plan');
  const survivors = (await a('/api/lessons')).json;
  assert.equal(survivors[0].title, 'A private plan');
  assert.equal((await a('/api/lesson-media')).json.length, 2);
  assert.equal((await a(`/api/media/${orphan.id}`, { method: 'DELETE' })).status, 204);
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM lessons WHERE owner_id IS NULL').get().n, 0);
  assert.equal((await a(`/api/lessons/${lesson.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await b('/api/lessons')).json.length, 1);
});

test('lessons that existed before accounts have no owner, stay untouched in the database and are invisible to every coach', async t => {
  const f = await fixture(t);
  f.database.prepare("INSERT INTO lessons (title, discipline, drills) VALUES ('Old lesson', 'Boxing', 'Warm-up — 5 minutes')").run();
  f.database.prepare("INSERT INTO lesson_media (kind, origin, url, title) VALUES ('youtube', 'link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Old video')").run();
  const api = await signedIn(f, 'new@example.com');
  assert.deepEqual((await api('/api/lessons')).json, []);
  assert.deepEqual((await api('/api/lesson-media')).json, []);
  assert.equal((await api('/api/lessons/1', { method: 'DELETE' })).status, 404);
  assert.equal((await api('/api/lessons/1', { method: 'PUT', body: { title: 'Taken', discipline: 'MMA' } })).status, 404);
  assert.equal(f.database.prepare('SELECT title FROM lessons WHERE id = 1').get().title, 'Old lesson');
  assert.equal(f.database.prepare('SELECT owner_id FROM lessons WHERE id = 1').get().owner_id, null);
});

test('Google sign-in is offered only when its credentials are configured on the server', async t => {
  const without = await fixture(t);
  assert.equal((await without.client()('/api/auth-config')).json.google, false);
  const withGoogle = await fixture(t, { env: { GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'client-secret-value' } });
  assert.equal((await withGoogle.client()('/api/auth-config')).json.google, true);
  const start = await withGoogle.client()('/api/auth/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: '/' } });
  assert.equal(start.status, 200);
  assert.match(start.json.url, /^https:\/\/accounts\.google\.com\//);
  assert.ok(!start.text.includes('client-secret-value'));
  const refused = await without.client()('/api/auth/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: '/' } });
  assert.ok(refused.status >= 400);
});
