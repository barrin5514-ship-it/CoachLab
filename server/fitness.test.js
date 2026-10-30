// Exercises Fitness without real credentials, provider calls or production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { fitnessClassTypes, fitnessFormats, validateFitness, fitnessFields } from '../client/src/fitness.js';
import { disciplines, newDisciplines, sections, details, validateRequest, toLesson } from '../client/src/lesson-draft.js';
import { filterLessons } from '../client/src/lesson-view.js';
import { validateLesson } from './validate-lesson.js';
import { generateDraft } from './ai-provider.js';
import { suggestLessonVideos } from './video-suggestions.js';
import { prismaLessons } from './lesson-store.js';
import { createApp } from './app.js';
import { testOptions, authedFetch } from './test-auth.js';

const base = { title: 'Generic fitness lesson', discipline: 'Fitness', skill_level: 'Beginner', duration_minutes: 60, students: 4, privacy_confirmed: true, audience: 'Adults' };
const migration = '20261029000100_add_fitness';
// Applies real PostgreSQL SQL only inside a disposable in-memory engine.
test('Fitness migration preserves all old disciplines, IDs and timestamps and accepts nullable class fields', async () => {
  const db = new PGlite();
  try {
    const root = new URL('../prisma/migrations/', import.meta.url);
    for (const name of readdirSync(root).filter(name => /^\d/.test(name) && name < migration).sort()) await db.exec(readFileSync(new URL(name + '/migration.sql', root), 'utf8'));
    for (const discipline of disciplines.filter(value => value !== 'Fitness')) await db.query('INSERT INTO lessons (title, discipline, created_at) VALUES ($1, $2, $3)', ['Legacy ' + discipline, discipline, '2026-01-01T00:00:00.000Z']);
    const before = (await db.query('SELECT * FROM lessons ORDER BY id')).rows;
    const sql = readFileSync(new URL(migration + '/migration.sql', root), 'utf8');
    assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|TRUNCATE|UPDATE lessons/i);
    await db.exec(sql);
    const after = (await db.query('SELECT * FROM lessons ORDER BY id')).rows;
    assert.deepEqual(after.map(({ class_type, class_type_other, class_format, ...row }) => row), before);
    assert.ok(after.every(row => row.class_type === null && row.class_type_other === null && row.class_format === null));
    for (const type of fitnessClassTypes) for (const format of fitnessFormats) await db.query('INSERT INTO lessons (title, discipline, class_type, class_type_other, class_format) VALUES ($1, $2, $3, $4, $5)', ['Fitness test', 'Fitness', type, type === 'Other' ? 'Balance class' : null, format]);
    await db.query('INSERT INTO lessons (title, discipline) VALUES ($1, $2)', ['Optional metadata', 'Fitness']);
    for (const [column, value] of [['discipline', 'Unknown'], ['class_type', 'Invalid'], ['class_format', 'Crowd'], ['class_type_other', 'x'.repeat(41)]]) await assert.rejects(db.query(`UPDATE lessons SET ${column} = $1 WHERE id = 1`, [value]));
    const legacy = after.find(row => row.discipline === 'Personal Training');
    await db.query('UPDATE lessons SET title = $1 WHERE id = $2', ['Edited legacy lesson', legacy.id]);
    const saved = (await db.query('SELECT * FROM lessons WHERE id = $1', [legacy.id])).rows[0];
    assert.equal(saved.discipline, 'Personal Training');
    assert.deepEqual(saved.created_at, legacy.created_at);
    assert.equal(saved.title, 'Edited legacy lesson');
  } finally { await db.close(); }
});

test('Fitness validates optional fields, every class/format, Other text and legacy values', () => {
  assert.ok(!newDisciplines.includes('Personal Training') && newDisciplines.includes('Fitness'));
  assert.equal(validateFitness(base), null);
  for (const class_type of fitnessClassTypes) for (const class_format of fitnessFormats) {
    const value = { ...base, class_type, class_format, class_type_other: class_type === 'Other' ? ' Balance class ' : '' };
    const { title, ...request } = value;
    assert.equal(validateRequest(request), null);
    const { students, privacy_confirmed, ...lesson } = value;
    assert.equal(validateLesson(lesson).error, undefined);
  }
  for (const patch of [{ class_type: 'Invalid' }, { class_format: 'Crowd' }, { class_type: 'Other' }, { class_type: 'Other', class_type_other: ' ' }, { class_type: 'Other', class_type_other: 'x'.repeat(41) }, { class_type: 'Other', class_type_other: 'two\nlines' }, { class_type: 'Yoga', class_type_other: 'Hidden text' }, { class_type: 1 }, { class_format: {} }]) assert.ok(validateFitness({ ...base, ...patch }));
  assert.equal(validateLesson({ title: 'Old plan', discipline: 'Personal Training' }).lesson.discipline, 'Personal Training');
  assert.ok(validateLesson({ title: 'Old plan', discipline: 'Personal Training', class_type: 'Yoga' }).error);
  assert.deepEqual(fitnessFields({ discipline: 'Boxing', class_type: 'Yoga' }), { class_type: null, class_type_other: null, class_format: null });
});

test('Fitness AI sends class type and format with non-contact, equipment, audience and five-section rules', async () => {
  const draft = { title: 'Mock fitness class', objectives: 'Practice balance', ...Object.fromEntries(details.map(key => [key, 'Generic test guidance'])), sections: sections.map(name => ({ name, minutes: 12, instructions: '1. Demonstrate slowly.\n2. Practice with control.', common_mistakes: 'Rushing', easier: 'Slow down', harder: 'Add coordination' })) };
  for (const class_type of fitnessClassTypes) {
    const request = { ...base, class_type, class_type_other: class_type === 'Other' ? 'Balance flow' : '', class_format: 'Group class', audience: 'Kids' };
    const answer = await generateDraft(request, { env: { GEMINI_API_KEY: 'fake' }, fetcher: async (url, options) => {
      const body = JSON.parse(options.body), prompt = body.systemInstruction.parts[0].text;
      for (const phrase of ['NO-CONTACT', 'low-impact', 'beginner pacing', 'music/tempo', 'rebounders', 'bikes', 'mats', 'whole room', 'One-on-one', 'five timed sections', 'no head contact', 'no submissions or chokes', 'No medical claims']) assert.ok(prompt.includes(phrase), phrase);
      const data = JSON.parse(body.contents[0].parts[0].text);
      assert.equal(data.class_type, class_type); assert.equal(data.class_format, 'Group class');
      assert.equal(body.generationConfig.responseJsonSchema.properties.sections.minItems, 5);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }] });
    } });
    const lesson = toLesson(answer, request);
    assert.equal(lesson.class_type, class_type); assert.equal(lesson.class_format, 'Group class');
    assert.equal(validateLesson(lesson).error, undefined);
  }
});

test('Fitness video search keeps class type, format, beginner and kids/non-contact context', async () => {
  for (const class_type of ['Rebounding (mini trampoline)', 'Cardio kickboxing', 'Boxing fitness (non-contact)', 'Other']) {
    const lesson = { ...base, title: 'Balance drills', class_type, class_type_other: class_type === 'Other' ? 'Balance flow' : '', class_format: 'Group class', audience: 'Kids' };
    let calls = 0;
    await suggestLessonVideos(lesson, { env: { YOUTUBE_API_KEY: 'fake' }, diagnostic: () => {}, search: async query => {
      calls++; assert.ok(query.includes(class_type === 'Other' ? 'balance flow' : class_type));
      assert.match(query, /Beginner/); assert.match(query, /Group class/); assert.match(query, /kids non contact/);
      if (/boxing/i.test(class_type)) assert.match(query, /non contact/);
      return [];
    } });
    assert.equal(calls, 1);
  }
});

// The Prisma double tests API wiring and exact fields; SQL execution is tested separately above.
test('Prisma lesson API preserves legacy IDs and saves Fitness metadata without duplicates', async t => {
  const rows = [{ id: 1, title: 'Legacy plan', discipline: 'Personal Training', owner_id: 'user-a', created_at: new Date('2026-01-01Z') }];
  const model = {
    findMany: async ({ where }) => rows.filter(row => row.owner_id === where.owner_id),
    create: async ({ data }) => { const row = { ...data, id: rows.length + 1, created_at: new Date() }; rows.push(row); return row; },
    update: async ({ where, data }) => { const row = rows.find(row => row.id === where.id && row.owner_id === where.owner_id); if (!row) throw { code: 'P2025' }; Object.assign(row, data); return row; },
  };
  const client = { lesson: model, $transaction: work => work(client) };
  const server = createApp(prismaLessons(client), testOptions).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const save = (route, method, body) => authedFetch(url + route, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await (await authedFetch(url + '/api/lessons')).json())[0].discipline, 'Personal Training');
  const old = await save('/api/lessons/1', 'PUT', { title: 'Edited old plan', discipline: 'Personal Training' });
  assert.equal(old.status, 200); assert.equal((await old.json()).id, 1);
  const input = { title: 'Fitness plan', discipline: 'Fitness', class_type: 'Other', class_type_other: 'Balance flow', class_format: 'Small group' };
  const created = await save('/api/lessons', 'POST', input); assert.equal(created.status, 201);
  const lesson = await created.json(); assert.equal(lesson.class_type_other, 'Balance flow');
  const updated = await save('/api/lessons/' + lesson.id, 'PUT', { ...input, class_format: 'Group class' });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).id, lesson.id); assert.equal(rows.length, 2);
  assert.equal((await save('/api/lessons', 'POST', { ...input, class_type_other: 'x'.repeat(41) })).status, 400);
  assert.equal((await save('/api/lessons/' + lesson.id, 'PUT', { title: 'Changed discipline', discipline: 'Boxing' })).status, 200);
  assert.equal(rows[1].class_type, null);
  assert.equal(rows[0].created_at.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('Fitness controls and cards render while legacy edit options and dashboard filtering remain available', async () => {
  const { transformWithOxc } = await import('vite');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const folder = mkdtempSync(path.join(tmpdir(), 'coachlab-fitness-ui-'));
  try {
    for (const name of readdirSync(new URL('../client/src/', import.meta.url)).filter(name => name.endsWith('.jsx'))) {
      const source = readFileSync(new URL('../client/src/' + name, import.meta.url), 'utf8');
      const transformed = await transformWithOxc(source, name, { jsx: { runtime: 'classic' } });
      const code = transformed.code.replace(/(['"])(\.\/[^'"]+)\1/g, (whole, quote, relative) => quote + (relative.endsWith('.jsx') ? pathToFileURL(path.join(folder, relative.replace(/\.jsx$/, '.mjs'))).href : new URL('../client/src/' + relative, import.meta.url).href) + quote).replace(/from ["']react["']/g, 'from ' + JSON.stringify(import.meta.resolve('react')));
      writeFileSync(path.join(folder, name.replace(/\.jsx$/, '.mjs')), code);
    }
    const render = async (name, props) => renderToStaticMarkup(React.createElement((await import(pathToFileURL(path.join(folder, name + '.mjs')).href)).default, props));
    assert.equal(await render('FitnessFields', { value: { discipline: 'Boxing' } }), '');
    const controls = await render('FitnessFields', { value: { ...base, class_type: 'Other', class_type_other: 'Balance flow' } });
    assert.match(controls, /maxLength="40"/i); assert.match(controls, /Other class type/); assert.match(controls, /Group class/);
    assert.doesNotMatch(await render('FitnessFields', { value: { ...base, class_type: 'Yoga' } }), /Other class type/);
    const newForm = await render('LessonForm', {}); assert.match(newForm, /Fitness/); assert.doesNotMatch(newForm, /<option[^>]*>Personal Training/);
    const legacy = { ...base, id: 1, discipline: 'Personal Training', created_at: '2026-01-01Z' };
    assert.match(await render('LessonForm', { lesson: legacy }), /<option[^>]*selected[^>]*>Personal Training/);
    assert.doesNotMatch(await render('AiLessonForm', {}), /<option[^>]*>Personal Training/);
    const fitness = { ...base, id: 2, class_type: 'Other', class_type_other: 'Balance flow', class_format: 'Group class', created_at: '2026-01-01Z' };
    assert.match(await render('LessonCard', { lesson: fitness }), /Balance flow/);
    assert.match(await render('LessonCard', { lesson: legacy }), /Personal Training/);
    assert.deepEqual(filterLessons([legacy, fitness], 'All', 'Fitness', 'Other'), [fitness]);
    assert.deepEqual(filterLessons([legacy, fitness], 'All', 'Fitness', 'Yoga'), []);
    assert.deepEqual(filterLessons([legacy, fitness], 'All', 'Personal Training'), [legacy]);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
