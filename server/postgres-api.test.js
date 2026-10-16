import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { png } from './media-fixtures.js';
import { testOptions, authedFetch as fetch } from './test-auth.js';
import pg from 'pg';
import { createApp } from './app.js';
import { prismaLessons } from './lesson-store.js';
import { createDevelopmentClient } from './prisma-development.js';
import { disciplines, sections, details, toLesson } from '../client/src/lesson-draft.js';

export const mockDraft = { title: 'Integration draft', objectives: 'Practice controlled movement.', ...Object.fromEntries(details.map(key => [key, 'Mock guidance for integration testing.'])), sections: sections.map(name => ({ name, minutes: 12, instructions: 'Demonstrate, then practice under supervision.' })) };

test('PostgreSQL API: six disciplines, mocked AI approval, committed persistence and safe failures', { skip: process.env.COACHLAB_RUN_POSTGRES_TESTS !== 'verified-development', timeout: 120000 }, async t => {
  const env = process.env;
  assert.equal(env.COACHLAB_DEV_PROJECT_ID, 'rapid-firefly-98778665');
  assert.equal(env.COACHLAB_DEV_BRANCH_ID, 'br-flat-fog-b5t1m0vy');
  const schema = 'coachlab_test_' + randomUUID().replaceAll('-', '');
  let client = createDevelopmentClient(env, schema);
  let direct;
  try { direct = new URL(env.COACHLAB_DEV_DIRECT_URL); } catch { throw new Error('Invalid direct configuration.'); }
  assert.ok(direct.hostname.startsWith('ep-long-bird-b50l2nhb.') && direct.hostname === env.COACHLAB_DEV_EXPECTED_HOST.replace('-pooler.', '.'));
  assert.equal(direct.pathname, '/neondb');
  assert.ok(['require', 'verify-full'].includes(direct.searchParams.get('sslmode')));
  direct.search = '';
  const admin = new pg.Client({ connectionString: direct.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  let server, url, created = false;
  const stop = async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await client.$disconnect();
  };
  const start = async () => {
    client = createDevelopmentClient(env, schema);
    server = createApp(prismaLessons(client), { ...testOptions, provider: async () => structuredClone(mockDraft), verifyLink: async link => ({ kind: link.includes('youtu') ? 'youtube' : 'image', url: link, title: 'Checked', credit: '', source_page: '' }) }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    url = `http://127.0.0.1:${server.address().port}`;
  };
  const get = async () => (await fetch(url + '/api/lessons')).json();
  const post = (route, body) => fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    await assert.rejects(client.lesson.count(), error => error.code === 'P2021' && JSON.stringify(error.meta).includes(schema));
    await client.$disconnect();
    await admin.connect();
    assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name, 'neondb');
    const before = JSON.stringify((await admin.query('SELECT * FROM public.lessons ORDER BY id')).rows);
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await admin.query('BEGIN');
    await admin.query(`SET LOCAL search_path TO "${schema}"`);
    for (const name of readdirSync(new URL('../prisma/migrations/', import.meta.url), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
      const sql = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
      await admin.query(sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
    }
    await admin.query("INSERT INTO auth_users (id, name, email) VALUES ('user-a', 'Coach A', 'a@example.com'), ('user-b', 'Coach B', 'b@example.com')");
    await admin.query('COMMIT');
    await start();
    assert.deepEqual(await get(), []);
    for (const discipline of disciplines) {
      const response = await post('/api/lessons', { title: `Integration ${discipline}`, discipline });
      assert.equal(response.status, 201);
      const saved = await response.json();
      assert.ok(Number.isInteger(saved.id));
      assert.equal(saved.created_at, new Date(saved.created_at).toISOString());
      assert.equal(saved.discipline, discipline);
    }
    const request = { discipline: 'Brazilian Jiu-Jitsu', skill_level: 'Beginner', duration_minutes: 60, students: 2, objective: 'Controlled practice', techniques: 'Basic positions', equipment: 'Mats', privacy_confirmed: true };
    const generated = await post('/api/ai/lesson-draft', request);
    assert.equal(generated.status, 200);
    const draft = (await generated.json()).draft;
    assert.equal((await get()).length, 6);
    draft.objectives = 'Edited and approved integration objective.';
    const approved = toLesson(draft, request);
    const savedResponse = await post('/api/lessons', approved);
    assert.equal(savedResponse.status, 201);
    const saved = await savedResponse.json();
    assert.deepEqual(saved, { ...approved, id: saved.id, created_at: saved.created_at });
    const changed = { ...approved, title: 'Updated integration lesson', drills: 'Reordered activity two\n\nActivity one' };
    const update = await fetch(url + '/api/lessons/' + saved.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changed) });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), { ...changed, id: saved.id, created_at: saved.created_at });
    const upload = await (await fetch(url + '/api/media/upload', { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-File-Name': 'pg-test.png' }, body: png })).json();
    const withMedia = await post('/api/lessons', { ...changed, title: 'Media persistence', media: [{ id: upload.id, title: 'Stored picture', activity: 'Activity one' }, { url: 'https://example.com/pic.png', title: 'Linked picture' }] });
    assert.equal(withMedia.status, 201);
    const mediaLesson = await withMedia.json();
    const mediaRows = async () => (await fetch(url + '/api/lesson-media')).json();
    assert.deepEqual((await mediaRows()).map(item => [item.origin, item.title, item.lesson_id]), [['upload', 'Stored picture', mediaLesson.id], ['link', 'Linked picture', mediaLesson.id]]);
    const snapshot = await get();
    assert.equal(snapshot.length, 8);
    await stop();
    await start();
    assert.deepEqual(await get(), snapshot);
    assert.deepEqual((await mediaRows()).map(item => item.title), ['Stored picture', 'Linked picture']);
    assert.deepEqual(Buffer.from(await (await fetch(`${url}/api/media/${upload.id}/file`)).arrayBuffer()), png);
    assert.equal((await fetch(`${url}/api/media/${upload.id}/file`, { headers: { Range: 'bytes=0-3' } })).status, 206);
    const kept = await fetch(url + '/api/lessons/' + mediaLesson.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...changed, title: 'Media persistence', media: [{ id: upload.id, title: 'Renamed picture', activity: '' }] }) });
    assert.equal(kept.status, 200);
    assert.deepEqual((await mediaRows()).map(item => item.title), ['Renamed picture']);
    assert.equal((await post('/api/lessons', { ...changed, media: [{ id: 99999999 }] })).status, 400);
    assert.equal((await fetch(url + '/api/lessons/' + mediaLesson.id, { method: 'DELETE' })).status, 204);
    assert.deepEqual(await mediaRows(), []);
    assert.equal((await fetch(`${url}/api/media/${upload.id}/file`)).status, 404);
    assert.equal((await admin.query(`SELECT count(*)::int AS n FROM "${schema}".lesson_media`)).rows[0].n, 0);
    assert.equal((await post('/api/lessons', { title: '', discipline: 'Boxing' })).status, 400);
    assert.equal((await get()).length, 7);
    assert.equal((await fetch(url + '/api/lessons/' + saved.id, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(url + '/api/lessons/' + saved.id, { method: 'DELETE' })).status, 404);
    await stop(); await start();
    assert.equal((await get()).length, 6);
    assert.ok(!(await get()).some(row => row.id === saved.id));
    await stop();
    server = createApp({ list: async () => { throw new Error('private database detail'); }, create: async () => { throw new Error('private database detail'); } }, testOptions).listen(0, '127.0.0.1');
    await once(server, 'listening');
    url = `http://127.0.0.1:${server.address().port}`;
    for (const response of [await fetch(url + '/api/lessons'), await post('/api/lessons', { title: 'Failure probe', discipline: 'Boxing' })]) {
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'Unexpected server error.' });
    }
    assert.equal(JSON.stringify((await admin.query('SELECT * FROM public.lessons ORDER BY id')).rows), before);
    t.diagnostic('Six disciplines and mocked approval saved; committed rows survived server/client recreation; public table unchanged.');
  } catch (error) {
    throw new Error('PostgreSQL integration failed: ' + (/^[A-Z0-9_]+$/.test(error.code || '') ? error.code : error.name));
  } finally {
    await stop();
    await admin.query('ROLLBACK').catch(() => {});
    if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});
