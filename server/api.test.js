import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createApp } from './app.js';
import { migrate } from './migrations.js';
import { testOptions, authedFetch as fetch } from './test-auth.js';

async function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'coachlab-api-'));
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith('coachlab-api-'));
  const state = { filename: path.join(directory, 'test.sqlite') };
  state.stop = async () => {
    if (state.server?.listening) await new Promise(resolve => state.server.close(resolve));
    if (state.database?.open) state.database.close();
  };
  t.after(async () => {
    await state.stop();
    rmSync(directory, { recursive: true, force: true });
  });
  state.start = async () => {
    state.database = new Database(state.filename);
    migrate(state.database);
    state.server = createApp(state.database, testOptions).listen(0, '127.0.0.1');
    await once(state.server, 'listening');
    state.url = `http://127.0.0.1:${state.server.address().port}`;
  };
  await state.start();
  return state;
}

function post(state, body) {
  return fetch(`${state.url}/api/lessons`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('GET starts empty and health remains available', async t => {
  const state = await fixture(t);
  const response = await fetch(`${state.url}/api/lessons`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  const health = await fetch(`${state.url}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'CoachLab API' });
});

test('POST saves actual SQLite data, GET orders it, and reopening preserves it', async t => {
  const state = await fixture(t);
  const input = { title: "  Coach's jab; DROP TABLE lessons; --  ", discipline: 'Boxing', skill_level: 'Intermediate', duration_minutes: 45, goal: 'Accuracy', drills: 'Practice jabs', coaching_notes: 'Keep guard up' };
  const response = await post(state, input);
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.ok(Number.isInteger(saved.id) && saved.id > 0);
  assert.ok(Number.isFinite(Date.parse(saved.created_at)));
  assert.deepEqual(saved, { ...input, audience: 'Unspecified', title: input.title.trim(), id: saved.id, created_at: saved.created_at });
  const { owner_id: owner, ...stored } = state.database.prepare('SELECT * FROM lessons WHERE id = ?').get(saved.id);
  assert.equal(owner, 'user-a');
  assert.deepEqual(stored, saved);
  const secondResponse = await post(state, { title: 'Second lesson', discipline: 'MMA' });
  assert.equal(secondResponse.status, 201);
  const second = await secondResponse.json();
  assert.equal(second.skill_level, 'Beginner');
  assert.equal(second.duration_minutes, null);
  assert.equal(second.goal, '');
  const expected = [second, saved];
  assert.deepEqual(await (await fetch(`${state.url}/api/lessons`)).json(), expected);
  await state.stop();
  await state.start();
  assert.deepEqual(await (await fetch(`${state.url}/api/lessons`)).json(), expected);
  assert.equal(state.database.prepare('SELECT count(*) AS count FROM lessons').get().count, 2);
});

test('invalid lesson inputs return 400 without saving records', async t => {
  const state = await fixture(t);
  const invalid = [{}, { title: '' }, { title: ' \t\n' }, { title: 42 }, { discipline: 'Unknown' }, { discipline: null }, { skill_level: 'Expert' }, { skill_level: null }, { duration_minutes: -1 }, { duration_minutes: 0 }, { duration_minutes: 1.5 }, { duration_minutes: '45' }, { duration_minutes: 1441 }, { goal: null }, { drills: [] }, { coaching_notes: {} }, { id: 123 }];
  for (const [index, fields] of invalid.entries()) {
    await t.test(`invalid case ${index + 1}`, async () => {
      const base = index === 0 ? {} : { title: 'Valid', discipline: 'Boxing' };
      const response = await post(state, { ...base, ...fields });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, 'string');
    });
  }
  for (const [field, limit] of Object.entries({ title: 200, goal: 2000, drills: 10000, coaching_notes: 10000 })) {
    const response = await post(state, { title: 'Valid', discipline: 'Boxing', [field]: 'x'.repeat(limit + 1) });
    assert.equal(response.status, 400);
    await response.json();
  }
  assert.equal(state.database.prepare('SELECT count(*) AS count FROM lessons').get().count, 0);
});

test('malformed JSON, non-object bodies, wrong media type, and oversized bodies fail safely', async t => {
  const state = await fixture(t);
  for (const [body, contentType, status] of [['{broken', 'application/json', 400], ['null', 'application/json', 400], ['[]', 'application/json', 400], ['42', 'application/json', 400], ['{}', 'text/plain', 400], [JSON.stringify({ title: 'x'.repeat(40000) }), 'application/json', 413]]) {
    const response = await fetch(`${state.url}/api/lessons`, { method: 'POST', headers: { 'Content-Type': contentType }, body });
    assert.equal(response.status, status);
    const data = await response.json();
    assert.deepEqual(Object.keys(data), ['error']);
    assert.ok(!/SyntaxError|stack|node_modules|SQLITE/.test(data.error));
  }
  assert.equal(state.database.prepare('SELECT count(*) AS count FROM lessons').get().count, 0);
});

test('database failures return generic 500 errors for both routes', async t => {
  const state = await fixture(t);
  state.database.close();
  for (const response of [await fetch(`${state.url}/api/lessons`), await post(state, { title: 'Valid', discipline: 'Boxing' })]) {
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unexpected server error.' });
  }
});

test('fresh database is migrated before app creation without changing the schema', async t => {
  const state = await fixture(t);
  assert.deepEqual(state.database.prepare('SELECT version FROM schema_migrations').all(), [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }]);
  assert.equal(state.database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const unknown = await fetch(`${state.url}/missing`);
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: 'Route not found.' });
});

test('update preserves identity without duplicates; delete persists; invalid and missing IDs fail safely', async t => {
  const state = await fixture(t);
  const original = await (await post(state, { title: 'Original', discipline: 'Boxing' })).json();
  const other = await (await post(state, { title: 'Keep this', discipline: 'MMA' })).json();
  const put = (id, body) => fetch(`${state.url}/api/lessons/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const edited = { title: 'Edited', discipline: 'Wrestling', skill_level: 'Advanced', duration_minutes: 30, goal: 'New goal', drills: 'Second activity\n\nFirst activity', coaching_notes: 'Modified safety' };
  const response = await put(original.id, edited);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...edited, audience: 'Unspecified', id: original.id, created_at: original.created_at });
  assert.equal((await put(original.id, { ...edited, title: '' })).status, 400);
  for (const id of ['0', '-1', '1.5', '2147483648', 'abc']) {
    assert.equal((await put(id, edited)).status, 400);
    assert.equal((await fetch(`${state.url}/api/lessons/${id}`, { method: 'DELETE' })).status, 400);
  }
  assert.equal((await put(2147483647, edited)).status, 404);
  await state.stop(); await state.start();
  assert.equal(state.database.prepare('SELECT count(*) AS n FROM lessons').get().n, 2);
  assert.equal(state.database.prepare('SELECT title FROM lessons WHERE id=?').get(original.id).title, 'Edited');
  assert.equal((await fetch(`${state.url}/api/lessons/${original.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${state.url}/api/lessons/${original.id}`, { method: 'DELETE' })).status, 404);
  await state.stop(); await state.start();
  assert.deepEqual(await (await fetch(`${state.url}/api/lessons`)).json(), [other]);
});

test('audience defaults for old clients, validates values and survives update and restart', async t => {
  const state = await fixture(t);
  const legacy = await (await post(state, { title: 'Generic class', discipline: 'Boxing' })).json();
  assert.equal(legacy.audience, 'Unspecified');
  for (const audience of ['Kids', 'Adults', 'Unspecified']) {
    const input = { title: 'Generic class', discipline: 'Boxing', audience };
    const response = await post(state, input);
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.audience, audience);
    const updated = await fetch(`${state.url}/api/lessons/${created.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, audience: 'Adults' }) });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).audience, 'Adults');
  }
  for (const audience of ['Teen', '', null, 7, {}]) assert.equal((await post(state, { title: 'Generic', discipline: 'Boxing', audience })).status, 400);
  const before = await (await fetch(`${state.url}/api/lessons`)).json();
  await state.stop();
  await state.start();
  assert.deepEqual(await (await fetch(`${state.url}/api/lessons`)).json(), before);
});
