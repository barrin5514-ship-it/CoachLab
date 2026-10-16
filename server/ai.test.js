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
import { generateDraft } from './ai-provider.js';
import { disciplines, sections, details, validateRequest, validateDraft, toLesson } from '../client/src/lesson-draft.js';

const request = { discipline: 'Brazilian Jiu-Jitsu', skill_level: 'Beginner', duration_minutes: 60, students: 2, objective: 'Kimura fundamentals', techniques: 'Kimura grip', equipment: 'Mats', privacy_confirmed: true };
const draft = { title: 'Mock Kimura lesson', objectives: 'Practice controlled positioning.', ...Object.fromEntries(details.map(key => [key, 'Mock coaching guidance for testing.'])), sections: sections.map(name => ({ name, minutes: 12, instructions: '1. Demonstrate slowly.\n2. Rehearse under coach supervision.' })) };
const env = { GEMINI_API_KEY: 'mock-test-value', AI_MODEL: 'gemini-3.5-flash-lite' };
const envelope = value => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });

test('contract accepts six disciplines and rejects invalid inputs and incomplete or mistimed drafts', () => {
  for (const discipline of disciplines) assert.equal(validateRequest({ ...request, discipline }), null);
  for (const change of [{ discipline: 'Other' }, { skill_level: 'Expert' }, { duration_minutes: 0 }, { duration_minutes: 60.5 }, { students: 101 }, { objective: null }, { techniques: 'x'.repeat(501) }, { privacy_confirmed: false }, { athlete: 'private' }]) assert.ok(validateRequest({ ...request, ...change }));
  assert.equal(validateRequest({ ...request, objective: '', techniques: '', equipment: '' }), null);
  assert.ok(validateRequest(null));
  assert.equal(validateDraft(draft, request), null);
  for (const change of [{ title: '' }, { safety: '' }, { sections: [] }, { sections: draft.sections.map(section => ({ ...section, minutes: 11 })) }, { sections: [null, ...draft.sections.slice(1)] }]) assert.ok(validateDraft({ ...draft, ...change }, request));
  const edited = structuredClone(draft);
  edited.sections[1].instructions = 'Edited teaching steps';
  assert.match(toLesson(edited, request).drills, /Edited teaching steps/);
  assert.match(toLesson(edited, request).coaching_notes, /reviewed and approved/);
});

test('mocked Gemini transport uses server header, JSON schema and bounded output', async () => {
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
    assert.ok(!options.body.includes(env.GEMINI_API_KEY));
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.maxOutputTokens, 8192);
    return Response.json(envelope(draft));
  };
  assert.deepEqual(await generateDraft(request, { env, fetcher }), draft);
});

test('provider configuration, HTTP failures, truncation, oversized output and timeout produce safe errors', async () => {
  await assert.rejects(generateDraft(request, { env: {} }), error => error.status === 503);
  await assert.rejects(generateDraft(request, { env: { ...env, AI_PROVIDER: 'unknown' } }), error => error.status === 503);
  for (const response of [new Response('private upstream text', { status: 500 }), new Response('x'.repeat(65537)), Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), new Response('not JSON')]) {
    await assert.rejects(generateDraft(request, { env, fetcher: async () => response }), error => error.status === 502 && !error.message.includes('private'));
  }
  await assert.rejects(generateDraft(request, { env, fetcher: async () => new Response('', { status: 429 }) }), error => error.status === 429);
  const fetcher = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('private transport detail')), { once: true }));
  await assert.rejects(generateDraft(request, { env, fetcher, timeout: 5 }), error => error.status === 504);
});

test('AI API generates without saving; approved mapped lesson persists; limits and failures leave manual API usable', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'coachlab-ai-'));
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith('coachlab-ai-'));
  const filename = path.join(directory, 'test.sqlite');
  let database = new Database(filename);
  migrate(database);
  let mode = 'ok';
  let time = 0;
  let release;
  const provider = async () => {
    if (mode === 'fail') throw new Error('SECRET upstream details');
    if (mode === 'invalid') return { ...draft, safety: '' };
    if (mode === 'slow') await new Promise(resolve => { release = resolve; });
    return structuredClone(draft);
  };
  const server = createApp(database, { provider, now: () => time, ...testOptions }).listen(0, '127.0.0.1');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); database.close(); rmSync(directory, { recursive: true, force: true }); });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const generate = body => post('/api/ai/lesson-draft', body);
  assert.equal((await generate({ ...request, privacy_confirmed: false })).status, 400);
  for (const discipline of disciplines) {
    time += 60001;
    const response = await generate({ ...request, discipline });
    assert.equal(response.status, 200);
    assert.equal(validateDraft((await response.json()).draft, request), null);
  }
  assert.deepEqual(await (await fetch(base + '/api/lessons')).json(), []);
  assert.equal((await post('/api/lessons', toLesson(draft, request))).status, 201);
  const check = new Database(filename, { readonly: true });
  assert.equal(check.prepare('SELECT title FROM lessons').get().title, draft.title);
  check.close();
  mode = 'fail';
  const failed = await generate(request);
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes('SECRET'));
  mode = 'invalid';
  assert.equal((await generate(request)).status, 502);
  assert.equal((await generate(request)).status, 429);
  assert.equal((await post('/api/lessons', { title: 'Manual during outage', discipline: 'Boxing' })).status, 201);
  time += 60001;
  mode = 'slow';
  const pending = generate(request);
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await generate(request)).status, 429);
  release();
  assert.equal((await pending).status, 200);
  mode = 'ok';
  for (let attempt = 0; attempt < 11; attempt++) { time += 60001; assert.equal((await generate(request)).status, 200); }
  time += 60001;
  assert.equal((await generate(request)).status, 429);
  time += 86400000;
  assert.equal((await generate(request)).status, 200);
  database.close();
  database = new Database(filename);
  assert.equal(database.prepare('SELECT title FROM lessons ORDER BY id').all()[0].title, draft.title);
});
