// Runs real PostgreSQL SQL through a small Prisma-tag adapter, never a remote database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { prismaClasses } from './class-store.js';
import { createApp } from './app.js';
import { testOptions, authedFetch } from './test-auth.js';
import { defaultLevels, validateClass, validateLevels, validClassDate } from '../client/src/classes.js';
// Tagged-template values stay separate from SQL text, matching Prisma's parameterized call interface.
function adapter(db) {
  const query = (strings, values) => db.query(strings.reduce((sql, part, index) => sql + (index ? '$' + index : '') + part, ''), values);
  return { $queryRaw: async (strings, ...values) => (await query(strings, values)).rows, $executeRaw: async (strings, ...values) => (await query(strings, values)).affectedRows, $transaction: work => db.transaction(tx => work(adapter(tx))) };
}
const input = { name: 'Kids Boxing Tue/Thu', discipline: 'Boxing', audience: 'Kids', days: ['Tuesday', 'Thursday'], days_per_week: 2, goal: 'Practice basics', current_level: 'level-0' };
test('class rules cover days, audiences, editable defaults and calendar dates', () => {
  assert.equal(validateClass(input), null);
  for (const patch of [{ days_per_week: 3 }, { days: ['Tuesday', 'Tuesday'] }, { audience: 'Unspecified' }, { name: '' }, { owner_id: 'user-b' }]) assert.ok(validateClass({ ...input, ...patch }));
  assert.deepEqual(defaultLevels('Brazilian Jiu-Jitsu', 'Kids').map(level => level.name), ['White', 'Grey', 'Yellow', 'Orange', 'Green']);
  assert.deepEqual(defaultLevels('Brazilian Jiu-Jitsu', 'Adults').map(level => level.name), ['White', 'Blue', 'Purple', 'Brown', 'Black']);
  assert.equal(validateLevels(defaultLevels('Fitness', 'Adults')), null);
  assert.ok(validateLevels([{ id: 'x', name: 'Okay', skills: ['x'.repeat(201)] }]));
  assert.ok(!validClassDate('2026-02-30')); assert.ok(validClassDate('2026-10-30')); assert.ok(validClassDate(null));
});
test('class API isolates coaches, preserves lessons, edits ladders, archives and links transactionally', async t => {
  const db = new PGlite(); t.after(() => db.close());
  const root = new URL('../prisma/migrations/', import.meta.url);
  const folders = readdirSync(root).filter(name => /^\d/.test(name)).sort();
  for (const name of folders.filter(name => !name.includes('create_classes'))) await db.exec(readFileSync(new URL(name + '/migration.sql', root), 'utf8'));
  await db.query("INSERT INTO auth_users (id, name, email) VALUES ('user-a','A','a@example.com'),('user-b','B','b@example.com')");
  await db.query("INSERT INTO lessons (title, discipline, owner_id) VALUES ('Original', 'Personal Training', 'user-a'),('Other coach', 'Boxing', 'user-b')");
  const original = (await db.query('SELECT * FROM lessons ORDER BY id')).rows;
  const sql = readFileSync(new URL('20261030000100_create_classes/migration.sql', root), 'utf8');
  assert.doesNotMatch(sql, /ALTER TABLE|DROP TABLE|UPDATE lessons|DELETE FROM/i); await db.exec(sql);
  assert.deepEqual((await db.query('SELECT * FROM lessons ORDER BY id')).rows, original);
  const store = prismaClasses(adapter(db));
  const server = createApp({ list: async owner => (await db.query('SELECT * FROM lessons WHERE owner_id=$1', [owner])).rows }, { ...testOptions, classes: store }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async (route, method = 'GET', body, user = 'user-a') => {
    const response = await authedFetch('http://127.0.0.1:' + server.address().port + '/api/' + route, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': user }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  assert.equal((await call('classes', 'GET', null, 'anonymous')).status, 401);
  assert.equal((await call('classes', 'POST', { ...input, days_per_week: 5 })).status, 400);
  const first = await call('classes', 'POST', input); assert.equal(first.status, 201);
  const second = await call('classes', 'POST', { ...input, name: 'Second group', current_level: 'level-1' }); assert.equal(second.status, 201);
  const foreign = await call('classes', 'POST', input, 'user-b'); assert.equal(foreign.status, 201);
  assert.equal((await call('classes', 'GET', null, 'user-b')).data.length, 1);
  assert.equal((await call('classes/' + first.data.id, 'PUT', input, 'user-b')).status, 404);
  assert.equal((await call('classes/' + first.data.id, 'PATCH', { archived: true }, 'user-b')).status, 404);
  const edited = await call('classes/' + first.data.id, 'PUT', { ...input, name: 'Updated group' }); assert.equal(edited.data.name, 'Updated group');
  const ladder = (await call('class-ladder?discipline=Boxing&audience=Kids')).data;
  const levels = ladder.levels.map((level, index) => ({ ...level, name: index === 0 ? 'Foundations' : level.name })); levels.reverse(); levels.push({ id: 'extra', name: 'Coach review', skills: ['Explain safe practice'] });
  const saved = await call('class-ladder', 'PUT', { discipline: 'Boxing', audience: 'Kids', levels, revision: ladder.revision }); assert.equal(saved.status, 200);
  assert.equal((await call('class-ladder?discipline=Boxing&audience=Kids', 'GET', null, 'user-b')).data.levels[0].name, 'Beginner');
  assert.equal((await call('class-ladder', 'PUT', { discipline: 'Boxing', audience: 'Kids', levels, revision: ladder.revision })).status, 409);
  assert.equal((await call('class-ladder', 'PUT', { discipline: 'Boxing', audience: 'Kids', levels: levels.filter(level => level.id !== 'level-0'), revision: saved.data.revision })).status, 409);
  assert.equal((await call('class-ladder', 'PUT', { discipline: 'Boxing', audience: 'Kids', levels: levels.filter(level => level.id !== 'extra'), revision: saved.data.revision })).status, 200);
  const assign = { class_ids: [first.data.id, second.data.id], lesson_id: 1, scheduled_date: '2026-10-30' };
  assert.equal((await call('class-assignments', 'POST', { ...assign, scheduled_date: null })).status, 200);
  const blankReload = (await call('classes')).data;
  assert.ok(blankReload.every(row => row.assignments[0].lesson_id === 1 && row.assignments[0].scheduled_date === null));
  assert.equal((await call('class-assignments', 'POST', assign)).status, 200);
  assert.equal((await call('class-assignments', 'POST', assign)).status, 200);
  let classes = (await call('classes')).data; assert.ok(classes.every(row => row.assignments.length === 1));
  assert.equal(classes.find(row => row.id === first.data.id).current_level, 'level-0'); assert.equal(classes.find(row => row.id === second.data.id).current_level, 'level-1');
  assert.equal(classes[0].assignments[0].scheduled_date, '2026-10-30');
  assert.equal((await call('class-assignments', 'POST', { ...assign, lesson_id: 2 })).status, 404);
  assert.equal((await call('class-assignments', 'POST', { ...assign, class_ids: [first.data.id, foreign.data.id], scheduled_date: null })).status, 404);
  assert.equal((await call('classes')).data[0].assignments[0].scheduled_date, '2026-10-30');
  assert.equal((await call('classes/' + first.data.id + '/lessons/1', 'DELETE', null, 'user-b')).status, 404);
  assert.equal((await call('classes/' + first.data.id + '/lessons/1', 'DELETE')).status, 204);
  assert.equal((await call('classes/' + second.data.id, 'PATCH', { archived: true })).data.archived, true);
  assert.equal((await call('class-assignments', 'POST', assign)).status, 409);
  assert.equal((await call('classes/' + second.data.id, 'PATCH', { archived: false })).status, 200);
  assert.deepEqual((await db.query('SELECT * FROM lessons ORDER BY id')).rows, original);
  assert.equal((await call('lessons')).data[0].discipline, 'Personal Training');
  await db.query("UPDATE lessons SET title='Edited old lesson' WHERE id=1"); assert.equal((await call('lessons')).data[0].title, 'Edited old lesson');
  await db.query('DELETE FROM lessons WHERE id=1'); assert.equal((await db.query('SELECT * FROM class_lessons')).rows.length, 0);
});

// Exercise actual selection handlers with React state slots and a fake API, without browser access.
test('Add to class waits for explicit multi-selection, sends one link request and preserves failed choices', async () => {
  const { transformWithOxc } = await import('vite');
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../client/src/AssignLesson.jsx', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function');
  const { code } = await transformWithOxc(source, 'AssignLesson.jsx', { jsx: { runtime: 'classic' } });
  const slots = []; let cursor = 0, writes = 0, sent, fail = true;
  const useState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; };
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
  const Component = runInNewContext(code + '; AssignLesson;', { React, useState, classApi: async (path, method, body) => { if (method === 'POST') { writes++; sent = body; if (fail) throw new Error('Retry later'); return {}; } return [{ id: 'one', name: 'First group' }, { id: 'two', name: 'Second group' }, { id: 'old', name: 'Archived', archived: true }]; } });
  const render = () => { cursor = 0; return Component({ lessonId: 9 }); };
  const all = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(all) : [node, ...node.children.flatMap(all)];
  await all(render()).find(node => node.type === 'button').props.onClick();
  const boxes = all(render()).filter(node => node.type === 'input' && node.props.type === 'checkbox'); assert.equal(boxes.length, 2);
  for (const box of boxes) box.props.onChange({ target: { checked: true } });
  assert.equal(writes, 0);
  await all(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(writes, 1); assert.equal(sent.lesson_id, 9); assert.equal(sent.scheduled_date, null); assert.equal(sent.class_ids.join(','), 'one,two');
  assert.equal(all(render()).filter(node => node.type === 'input' && node.props.checked).length, 2);
  assert.ok(all(render()).some(node => node.props.role === 'status' && node.children.includes('Retry later')));
  all(render()).find(node => node.props.type === 'date').props.onChange({ target: { value: '2026-11-03' } });
  fail = false; await all(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(sent.scheduled_date, '2026-11-03');
  assert.equal(all(render()).some(node => node.type === 'form'), false);
});

// Exercise the class-page form, including native-validation failures that previously blocked submit silently.
test('class page submits blank/dates, reloads assignments and displays errors beside the form', async () => {
  const { transformWithOxc } = await import('vite');
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../client/src/ClassesPage.jsx', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function');
  const { code } = await transformWithOxc(source, 'ClassesPage.jsx', { jsx: { runtime: 'classic' } });
  const slots = []; let cursor = 0, sent, writes = 0, failure = '', omitLink = false;
  const group = { id: 'one', name: 'Kids Boxing Class', days: ['Tuesday'], levels: [], assignments: [] };
  slots[0] = [group];
  const useState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; };
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
  const Component = runInNewContext(code + '; ClassesPage;', { React, useState, useEffect() {}, classApi: async (path, method, body) => {
    if (method === 'POST') { writes++; sent = body; if (failure) throw new Error(failure); if (!omitLink) group.assignments = [{ lesson_id: body.lesson_id, title: 'Boxing fundamentals', scheduled_date: body.scheduled_date }]; return { assigned: 1 }; }
    return [structuredClone(group)];
  } });
  const render = () => { cursor = 0; return Component({ lessons: [{ id: 7, title: 'Boxing fundamentals' }], lessonsLoading: false, lessonsError: '' }); };
  const all = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(all) : [node, ...node.children.flatMap(all)];
  all(render()).find(node => node.type === 'button' && node.props['aria-pressed'] === false).props.onClick();
  all(render()).find(node => node.type === 'select').props.onChange({ target: { value: '7' } });
  const submit = valid => all(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { checkValidity: () => valid } });
  assert.equal(all(render()).find(node => node.type === 'form').props.noValidate, true);
  await submit(false); assert.equal(writes, 0);
  assert.ok(all(all(render()).find(node => node.type === 'form')).some(node => node.props.role === 'alert'));
  await submit(true); assert.equal(sent.lesson_id, 7); assert.equal(sent.scheduled_date, null);
  assert.equal(slots[0][0].assignments[0].lesson_id, 7);
  assert.ok(all(render()).some(node => node.props.item?.title === 'Boxing fundamentals'));
  assert.ok(all(render()).some(node => node.props.role === 'status' && node.children.includes('Lesson added to this class. The original is unchanged.')));
  all(render()).find(node => node.props.type === 'date').props.onChange({ target: { value: '2026-11-03' } });
  await submit(true); assert.equal(sent.scheduled_date, '2026-11-03'); assert.equal(slots[0][0].assignments[0].scheduled_date, '2026-11-03');
  failure = 'Please sign in to continue.'; await submit(true);
  assert.ok(all(all(render()).find(node => node.type === 'form')).some(node => node.props.role === 'alert' && node.children.includes(failure)));
  assert.equal(all(render()).find(node => node.type === 'select').props.value, '7');
  failure = ''; omitLink = true; group.assignments = []; await submit(true);
  assert.ok(all(render()).some(node => node.props.role === 'alert' && node.children.some(text => typeof text === 'string' && text.includes('not returned'))));
});

// Network/proxy failures must become useful messages rather than JSON parser text or endless waiting.
test('class API reports network, timeout, unreadable and server errors safely', async t => {
  const { classApi } = await import('../client/src/class-api.js');
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => { throw new TypeError('network'); };
  await assert.rejects(classApi('classes'), /Could not reach CoachLab/);
  globalThis.fetch = async () => ({ status: 502, ok: false, json: async () => { throw new SyntaxError('private proxy text'); } });
  await assert.rejects(classApi('classes'), /unreadable response/);
  globalThis.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: 'Please sign in to continue.' }) });
  await assert.rejects(classApi('classes'), /Please sign in/);
  const timeout = AbortSignal.timeout; t.after(() => { AbortSignal.timeout = timeout; });
  AbortSignal.timeout = ms => { assert.equal(ms, 20000); return AbortSignal.abort(); };
  globalThis.fetch = async () => { throw new Error('aborted'); };
  await assert.rejects(classApi('classes'), /took too long/);
});
