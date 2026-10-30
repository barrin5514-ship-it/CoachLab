// Checks media api behavior with controlled fixtures; read each test name for its expected outcome.
import { createYouTubeQuota } from './youtube-quota.js';
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
import { MediaLinkError } from './media-verify.js';
import { png, webm } from './media-fixtures.js';

const ytLink = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

test('lesson video suggestions require ownership, respect quotas, and attach only through an approved save', async t => {
  let time = 0, calls = 0;
  const video = { url: ytLink, kind: 'youtube', title: 'Jab', origin: 'suggested', activity: '' };
  const state = await fixture(t, { now: () => time, youtubeQuota: createYouTubeQuota(() => time), videoFinder: async (lesson, { reserveSearch }) => { reserveSearch(); calls++; return { videos: [video], message: 'Preview first' }; } });
  const body = { title: 'Jab class', discipline: 'Boxing', drills: 'Jab — 10 minutes\nPractice slowly.' };
  const lesson = await (await state.json('/api/lessons', 'POST', body)).json();
  const url = `${state.url}/api/lessons/${lesson.id}/videos`;
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-test-user': 'anonymous' } })).status, 401);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-test-user': 'user-b' } })).status, 404);
  assert.equal((await fetch(url, { method: 'POST', headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal(calls, 0);
  for (let i = 0; i < 5; i++) assert.equal((await fetch(url, { method: 'POST' })).status, 200);
  assert.deepEqual(await state.media(), []);
  assert.equal((await fetch(url, { method: 'POST' })).status, 429);
  time += 60001;
  for (let i = 0; i < 20; i++) { time += 60001; assert.equal((await fetch(url, { method: 'POST' })).status, 200); }
  assert.equal((await fetch(url, { method: 'POST' })).status, 429);
  time += 86400001;
  assert.equal((await fetch(url, { method: 'POST' })).status, 200);
  const { kind, ...attachment } = video;
  assert.equal((await state.json(`/api/lessons/${lesson.id}`, 'PUT', { ...body, media: [attachment] })).status, 200);
  assert.equal((await state.media()).length, 1);
  await state.stop(); await state.start();
  assert.equal((await state.media()).length, 1);
});

test('video search failure is safe and still consumes the daily allowance', async t => {
  let time = 0;
  const state = await fixture(t, { now: () => time, youtubeQuota: createYouTubeQuota(() => time), videoFinder: async (lesson, { reserveSearch }) => { reserveSearch(); throw new Error('SECRET search failure'); } });
  const lesson = await (await state.json('/api/lessons', 'POST', { title: 'Jab', discipline: 'Boxing' })).json();
  const url = `${state.url}/api/lessons/${lesson.id}/videos`;
  for (let i = 0; i < 25; i++) { const response = await fetch(url, { method: 'POST' }); assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /SECRET/); time += 60001; }
  assert.equal((await fetch(url, { method: 'POST' })).status, 429);
});

test('old activity search and lesson suggestions share one user allowance while catalog-only requests remain available', async t => {
  let time = 0, calls = 0;
  const quota = createYouTubeQuota(() => time);
  const state = await fixture(t, { now: () => time, youtubeQuota: quota, videoFinder: async (lesson, { reserveSearch }) => { reserveSearch(); calls++; return { videos: [] }; }, findMedia: async (body, { reserveSearch }) => { for (let i = 0; i < 25; i++) reserveSearch(); return { media: [], notes: [] }; } });
  const old = await state.json('/api/media/suggest', 'POST', { discipline: 'Boxing', sections: [{ name: 'Jab', instructions: 'Practice', queries: ['jab'] }] });
  assert.equal(old.status, 200);
  const lesson = await (await state.json('/api/lessons', 'POST', { title: 'Leg kicks', discipline: 'Muay Thai' })).json();
  assert.equal((await state.json(`/api/lessons/${lesson.id}/videos`, 'POST', {})).status, 429);
  assert.equal(calls, 0);
});

test('video suggestions enforce one in-flight search and eighty YouTube searches per server day', async t => {
  let time = 0, release;
  const store = { list: async () => [{ id: 1, title: 'Jab', discipline: 'Boxing' }] };
  const server = createApp(store, { ...testOptions, auth: { getUser: async request => ({ id: request.headers['x-test-user'] || 'a' }) }, now: () => time, youtubeQuota: createYouTubeQuota(() => time), videoFinder: (lesson, { reserveSearch }) => { reserveSearch(); return new Promise(resolve => { release = resolve; }); } }).listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  // Sends a request to the isolated test server with the required test headers.
  const post = user => fetch(`http://127.0.0.1:${server.address().port}/api/lessons/1/videos`, { method: 'POST', headers: { 'x-test-user': user } });
  for (let i = 0; i < 80; i++) {
    release = null;
    const pending = post(`coach-${i}`);
    while (!release) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await post('busy-coach')).status, 429);
    release({ videos: [], message: 'No results' });
    assert.equal((await pending).status, 200);
  }
  assert.equal((await post('another-coach')).status, 429);
  time += 86400001;
  release = null;
  const next = post('another-coach');
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  release({ videos: [], message: 'No results' });
  assert.equal((await next).status, 200);
});
// Supplies fake link verification so tests do not depend on external media sites.
const verifyLink = async url => {
  if (url.includes('broken')) throw new MediaLinkError('The website answered with status 404, so the link cannot be used.');
  if (url.includes('offline')) throw new Error('private transport detail');
  return url.includes('youtu') ? { kind: 'youtube', url: ytLink, title: 'Checked video', credit: 'YouTube — Coach', source_page: ytLink } : { kind: 'image', url, title: 'Checked picture', credit: '', source_page: '' };
};

// Prepares isolated test resources and cleanup so real lesson data is not used.
async function fixture(t, extra = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'coachlab-media-'));
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
  const state = { filename: path.join(directory, 'test.sqlite') };
  state.stop = async () => {
    if (state.server?.listening) await new Promise(resolve => state.server.close(resolve));
    if (state.database?.open) state.database.close();
  };
  t.after(async () => { await state.stop(); rmSync(directory, { recursive: true, force: true }); });
  state.start = async () => {
    state.database = new Database(state.filename);
    migrate(state.database);
    state.server = createApp(state.database, { verifyLink, ...testOptions, ...extra }).listen(0, '127.0.0.1');
    await once(state.server, 'listening');
    state.url = `http://127.0.0.1:${state.server.address().port}`;
  };
  await state.start();
  state.json = (route, method, body) => fetch(state.url + route, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  state.upload = (data, type = 'image/png', name = 'Jab-setup.png') => fetch(state.url + '/api/media/upload', { method: 'POST', headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(name) }, body: data });
  state.media = async () => (await fetch(state.url + '/api/lesson-media')).json();
  return state;
}

test('uploads are checked by content, stored in the database, served with range support and never trusted as pages', async t => {
  const state = await fixture(t);
  const response = await state.upload(png);
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.deepEqual({ kind: saved.kind, origin: saved.origin, mime: saved.mime, title: saved.title, size_bytes: saved.size_bytes, lesson_id: saved.lesson_id }, { kind: 'image', origin: 'upload', mime: 'image/png', title: 'Jab setup', size_bytes: png.length, lesson_id: null });
  assert.ok(!('data' in saved));
  const file = await fetch(`${state.url}/api/media/${saved.id}/file`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/png');
  assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(file.headers.get('cache-control'), 'private, no-cache');
  assert.match(file.headers.get('content-security-policy'), /sandbox/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
  const partial = await fetch(`${state.url}/api/media/${saved.id}/file`, { headers: { Range: 'bytes=0-7' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), `bytes 0-7/${png.length}`);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), png.subarray(0, 8));
  assert.equal((await fetch(`${state.url}/api/media/${saved.id}/file`, { headers: { Range: 'bytes=9999-' } })).status, 416);
  const video = await (await state.upload(webm, 'video/webm', 'clip.webm')).json();
  assert.equal(video.kind, 'video');
  for (const [body, type, status] of [[Buffer.alloc(0), 'image/png', 400], [png, 'text/html', 415], [png, 'video/mp4', 415], [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/png', 415], [Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]), 'image/png', 413], [Buffer.concat([webm, Buffer.alloc(21 * 1024 * 1024)]), 'video/webm', 413]]) {
    const result = await state.upload(body, type);
    assert.equal(result.status, status, type);
    assert.equal(typeof (await result.json()).error, 'string');
  }
  assert.equal((await fetch(`${state.url}/api/media/99999/file`)).status, 404);
  assert.deepEqual(await state.media(), []);
  assert.equal((await fetch(`${state.url}/api/media/${saved.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${state.url}/api/media/${saved.id}`, { method: 'DELETE' })).status, 404);
  assert.equal((await fetch(`${state.url}/api/media/${saved.id}/file`)).status, 404);
});

test('lessons keep their original fields plus audience while attachments save, reorder, edit, survive restart and disappear with the lesson', async t => {
  const state = await fixture(t);
  const upload = await (await state.upload(png)).json();
  const body = { title: 'Media lesson', discipline: 'Boxing', drills: 'Warm-up — 5 minutes\nJog\n\nJab — 10 minutes\nSnap', media: [{ id: upload.id, title: 'My photo', activity: 'Jab — 10 minutes' }, { url: 'https://youtu.be/dQw4w9WgXcQ', origin: 'link', title: '', activity: 'Warm-up — 5 minutes' }, { url: 'https://example.com/pic.png', origin: 'suggested', title: 'Suggested picture', activity: '', credit: 'Wikimedia Commons — Jane', source_page: 'https://commons.wikimedia.org/wiki/File:Pic.png' }] };
  const created = await state.json('/api/lessons', 'POST', body);
  assert.equal(created.status, 201);
  const lesson = await created.json();
  assert.deepEqual(Object.keys(lesson), ['id', 'title', 'discipline', 'skill_level', 'duration_minutes', 'goal', 'drills', 'coaching_notes', 'created_at', 'audience']);
  const attached = await state.media();
  assert.deepEqual(attached.map(item => [item.kind, item.origin, item.title, item.activity, item.position, item.lesson_id]), [['image', 'upload', 'My photo', 'Jab — 10 minutes', 0, lesson.id], ['youtube', 'link', 'Checked video', 'Warm-up — 5 minutes', 1, lesson.id], ['image', 'suggested', 'Suggested picture', '', 2, lesson.id]]);
  assert.equal(attached[1].url, ytLink);
  assert.equal(attached[1].credit, 'YouTube — Coach');
  assert.equal(attached[2].credit, 'Wikimedia Commons — Jane');
  assert.equal((await state.json(`/api/lessons/${lesson.id}`, 'PUT', { ...body, media: undefined, title: 'Renamed' })).status, 200);
  assert.equal((await state.media()).length, 3);
  const [first, second, third] = attached;
  const edited = await state.json(`/api/lessons/${lesson.id}`, 'PUT', { ...body, title: 'Renamed again', media: [{ id: third.id, title: 'Moved first', activity: 'Jab — 10 minutes' }, { id: first.id, title: 'Photo renamed', activity: 'Jab — 10 minutes' }] });
  assert.equal(edited.status, 200);
  assert.deepEqual((await state.media()).map(item => [item.id, item.title, item.position]), [[third.id, 'Moved first', 0], [first.id, 'Photo renamed', 1]]);
  assert.equal((await fetch(`${state.url}/api/media/${second.id}/file`)).status, 404);
  await state.stop(); await state.start();
  assert.deepEqual((await state.media()).map(item => item.id), [third.id, first.id]);
  assert.deepEqual(Buffer.from(await (await fetch(`${state.url}/api/media/${first.id}/file`)).arrayBuffer()), png);
  assert.equal((await state.json(`/api/lessons/${lesson.id}`, 'PUT', { ...body, media: [] })).status, 200);
  assert.deepEqual(await state.media(), []);
  const again = await (await state.json('/api/lessons', 'POST', { title: 'Second', discipline: 'MMA', media: [{ url: 'https://example.com/a.png', title: 'A' }] })).json();
  assert.equal((await state.media()).length, 1);
  assert.equal((await fetch(`${state.url}/api/lessons/${again.id}`, { method: 'DELETE' })).status, 204);
  assert.deepEqual(await state.media(), []);
  assert.equal(state.database.prepare('SELECT count(*) AS n FROM lesson_media').get().n, 0);
});

test('links that fail verification or attachments that do not exist stop the save and leave data unchanged', async t => {
  const state = await fixture(t);
  const lesson = await (await state.json('/api/lessons', 'POST', { title: 'Safe', discipline: 'Boxing' })).json();
  const orphan = await (await state.upload(png)).json();
  const broken = await state.json('/api/lessons', 'POST', { title: 'Nope', discipline: 'Boxing', media: [{ url: 'https://example.com/broken.png', title: 'x' }] });
  assert.equal(broken.status, 400);
  assert.match((await broken.json()).error, /example\.com could not be used: .*404/);
  const offline = await state.json('/api/lessons', 'POST', { title: 'Nope', discipline: 'Boxing', media: [{ url: 'https://example.com/offline.png' }] });
  assert.equal(offline.status, 400);
  const message = (await offline.json()).error;
  assert.match(message, /could not check the link/);
  assert.ok(!message.includes('private'));
  assert.equal((await state.json(`/api/lessons/${lesson.id}`, 'PUT', { title: 'Safe', discipline: 'Boxing', media: [{ id: 424242 }] })).status, 400);
  const other = await (await state.json('/api/lessons', 'POST', { title: 'Other', discipline: 'MMA', media: [{ id: orphan.id }] })).json();
  assert.equal((await state.json(`/api/lessons/${lesson.id}`, 'PUT', { title: 'Safe', discipline: 'Boxing', media: [{ id: orphan.id }] })).status, 400);
  assert.deepEqual((await state.media()).map(item => item.lesson_id), [other.id]);
  for (const bad of [{ media: 'x' }, { media: [{ url: 'https://example.com/a.png', kind: 'video' }] }, { media: [{ id: 1, url: 'https://example.com/a.png' }] }]) assert.equal((await state.json('/api/lessons', 'POST', { title: 'Bad', discipline: 'Boxing', ...bad })).status, 400);
  assert.equal(state.database.prepare('SELECT count(*) AS n FROM lessons').get().n, 2);
  assert.equal((await state.json('/api/lessons/99999', 'PUT', { title: 'Missing', discipline: 'Boxing', media: [] })).status, 404);
});

test('verify and suggest routes validate input, hide failures and limit searches', async t => {
  let calls = 0;
  // Returns fake search results so the route can be tested without external quota.
  const findMedia = async ({ discipline, sections }) => { calls += 1; return { media: [{ origin: 'suggested', kind: 'youtube', url: ytLink, title: 'Found', activity: sections[0].name, credit: 'YouTube', source_page: ytLink }], notes: [discipline] }; };
  const state = await fixture(t, { findMedia });
  const ok = await state.json('/api/media/verify', 'POST', { url: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).kind, 'youtube');
  const broken = await state.json('/api/media/verify', 'POST', { url: 'https://example.com/broken.png' });
  assert.equal(broken.status, 400);
  assert.match((await broken.json()).error, /404/);
  const offline = await state.json('/api/media/verify', 'POST', { url: 'https://example.com/offline.png' });
  assert.equal(offline.status, 502);
  assert.ok(!(await offline.json()).error.includes('private'));
  assert.equal((await state.json('/api/media/verify', 'POST', { url: 5 })).status, 400);
  const sections = [{ name: 'Technique teaching', instructions: 'Teach.', queries: ['jab'] }];
  for (const bad of [{}, { discipline: 'Chess', sections }, { discipline: 'Boxing', sections: 'x' }, { discipline: 'Boxing', sections: [{ name: 1, instructions: '' }] }, { discipline: 'Boxing', sections: [{ name: 'a', instructions: 'x'.repeat(1501) }] }, { discipline: 'Boxing', sections: [{ name: 'a', instructions: '', queries: ['x', 'y', 'z', 'w'] }] }]) assert.equal((await state.json('/api/media/suggest', 'POST', bad)).status, 400);
  const found = await state.json('/api/media/suggest', 'POST', { discipline: 'Boxing', sections });
  assert.equal(found.status, 200);
  assert.equal((await found.json()).media[0].activity, 'Technique teaching');
  for (let index = 0; index < 5; index++) await (await state.json('/api/media/suggest', 'POST', { discipline: 'Boxing', sections })).text();
  assert.equal((await state.json('/api/media/suggest', 'POST', { discipline: 'Boxing', sections })).status, 429);
  assert.equal(calls, 6);
});

test('suggest failures return a friendly message and old unattached uploads are purged', async t => {
  const state = await fixture(t, { findMedia: async () => { throw new Error('private search detail'); } });
  const failed = await state.json('/api/media/suggest', 'POST', { discipline: 'Boxing', sections: [{ name: 'A', instructions: '' }] });
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.json()).error.includes('private'));
  const old = await (await state.upload(png)).json();
  state.database.prepare("UPDATE lesson_media SET created_at='2020-01-01T00:00:00.000Z' WHERE id=?").run(old.id);
  const fresh = await (await state.upload(png)).json();
  assert.equal((await fetch(`${state.url}/api/media/${old.id}/file`)).status, 404);
  assert.equal((await fetch(`${state.url}/api/media/${fresh.id}/file`)).status, 200);
});
