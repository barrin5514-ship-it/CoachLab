import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffMedia } from './media-sniff.js';
import { youtubeId, renameActivity, mediaPayload, unassignedMedia } from '../client/src/media.js';
import { isPublicAddress, publicLookup, safeFetch, verifyLink, MediaLinkError } from './media-verify.js';
import { validateMediaList } from './media-validate.js';
import { png, webm } from './media-fixtures.js';
import { findMedia, commonsCandidates, cleanQueries, youtubeCandidates } from './media-finder.js';
import { lessonVideoQuery, suggestLessonVideos } from './video-suggestions.js';
import { withApprovedVideo } from '../client/src/media.js';
import { createYouTubeQuota } from './youtube-quota.js';

test('YouTube diagnostics report safe statuses, reasons and result counts without secret error bodies or URLs', async () => {
  const logs = [], diagnostic = (event, fields) => logs.push({ event, ...fields });
  await assert.rejects(youtubeCandidates('inside leg kicks', 'Muay Thai', 'SECRET_KEY', async () => Response.json({ error: { message: 'SECRET_KEY https://private.example', errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 }), 'inside leg kicks', () => {}, diagnostic));
  assert.equal(logs[0].status, 403);
  assert.equal(logs[0].reason, 'quotaExceeded');
  await assert.rejects(youtubeCandidates('jab', 'Boxing', 'SECRET_KEY', async () => { throw new Error('SECRET_KEY'); }, 'jab', () => {}, diagnostic));
  assert.equal(logs.at(-1).reason, 'network_or_timeout');
  await youtubeCandidates('jab', 'Boxing', 'SECRET_KEY', async () => Response.json({ items: [] }), 'jab', () => {}, diagnostic);
  assert.equal(logs.at(-1).returned, 0);
  assert.equal(logs.at(-1).matched, 0);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET_KEY|https:\/\//);
});

test('exact live lesson logs key presence and specific match phrase; missing key differs from zero matches', async () => {
  const lesson = { title: 'Using Leg Kicks to Close the Distance', goal: 'inside leg kicks to close distance', discipline: 'Muay Thai', audience: 'Adults' };
  const logs = [], diagnostic = (event, fields) => logs.push({ event, ...fields });
  const missing = await suggestLessonVideos(lesson, { env: {}, diagnostic });
  assert.match(missing.message, /YouTube search unavailable/);
  assert.equal(logs[0].key_present, false);
  assert.equal(logs[0].match_terms, 'inside leg kicks');
  const empty = await suggestLessonVideos(lesson, { env: { YOUTUBE_API_KEY: 'SECRET_KEY' }, search: async () => [], diagnostic });
  assert.match(empty.message, /No matches found/);
  const fallback = await suggestLessonVideos(lesson, { env: { YOUTUBE_API_KEY: 'SECRET_KEY' }, search: async () => [{ url: 'https://www.youtube.com/watch?v=abcdefghij0', title: 'Inside leg kicks' }], verify: async () => { throw new Error('Render cannot reach oEmbed SECRET_KEY'); }, diagnostic });
  assert.equal(fallback.videos[0].link_only, true);
  assert.equal(logs.at(-1).passed, 0);
  assert.equal(logs.at(-1).link_only, 1);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET_KEY|https:\/\//);
});

test('shared YouTube quota counts actual searches, preserves catalog access and expires after a day', async () => {
  let time = 0, requests = 0;
  const quota = createYouTubeQuota(() => time);
  const fetcher = async () => { requests++; return Response.json({ items: [] }); };
  for (let i = 0; i < 25; i++) await youtubeCandidates('leg kicks', 'Muay Thai', 'fake', fetcher, 'leg kicks', () => quota.take('coach-a'));
  await assert.rejects(youtubeCandidates('leg kicks', 'Muay Thai', 'fake', fetcher, 'leg kicks', () => quota.take('coach-a')), error => error.status === 429);
  assert.equal(requests, 25);
  const catalog = await suggestLessonVideos({ title: 'Jab', discipline: 'Boxing' }, { env: { YOUTUBE_API_KEY: 'fake' }, reserveSearch: () => quota.take('coach-a'), verify: async url => ({ url, kind: 'youtube', title: 'Jab' }) });
  assert.equal(catalog.videos.length, 1);
  assert.equal(requests, 25);
  for (let i = 25; i < 80; i++) await youtubeCandidates('leg kicks', 'Muay Thai', 'fake', fetcher, 'leg kicks', () => quota.take(`coach-${i}`));
  await assert.rejects(youtubeCandidates('leg kicks', 'Muay Thai', 'fake', fetcher, 'leg kicks', () => quota.take('another')), error => error.status === 429);
  assert.equal(requests, 80);
  time += 86400001;
  await youtubeCandidates('leg kicks', 'Muay Thai', 'fake', fetcher, 'leg kicks', () => quota.take('coach-a'));
  assert.equal(requests, 81);
});

test('lesson video queries extract unknown techniques across lesson text and keep audience context', () => {
  const query = lessonVideoQuery({ title: 'Leg kicks', goal: 'Using inside leg kicks to close the distance on an opponent', discipline: 'Muay Thai', audience: 'Adults' });
  assert.deepEqual(query.phrases, ['inside leg kicks', 'close distance']);
  assert.equal(query.technique, 'inside leg kicks close distance');
  assert.equal(query.audience, 'adults');
  for (const field of ['title', 'goal', 'techniques', 'drills', 'coaching_notes']) {
    const result = lessonVideoQuery({ [field]: 'Inside leg kicks', audience: 'Kids' });
    assert.ok(result.phrases.includes('inside leg kicks'));
    assert.equal(result.audience, 'kids non contact');
  }
  assert.equal(lessonVideoQuery({ title: 'Kimura armbar triangle', audience: 'Kids' }), null);
  assert.equal(lessonVideoQuery({ title: 'Chokes and knee strike', audience: 'Kids' }), null);
  assert.equal(lessonVideoQuery({ title: 'the lesson and training' }), null);
  const privateDetails = lessonVideoQuery({ title: 'Jab', coaching_notes: 'person@example.com https://example.com/private 555-123-4567' });
  assert.deepEqual(privateDetails.phrases, ['jab']);
  const long = lessonVideoQuery({ drills: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau' });
  assert.ok(long.phrases.length <= 4);
});

test('video suggestions verify catalog first, avoid YouTube quota when found and never save', async () => {
  let searches = 0;
  const verify = async url => ({ url, kind: 'youtube', title: 'Verified instruction' });
  const result = await suggestLessonVideos({ title: 'Jab', discipline: 'Boxing', audience: 'Adults' }, { env: { YOUTUBE_API_KEY: 'fake' }, verify, search: async () => { searches++; return []; } });
  assert.equal(searches, 0);
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].kind, 'youtube');
  assert.match(result.message, /Save changes/);
});

test('YouTube relevance uses the main technique rather than requiring every goal or audience word in a title', async () => {
  const results = await youtubeCandidates('inside leg kicks close distance drill kids non contact', 'Muay Thai', 'fake', async () => Response.json({ items: [{ id: { videoId: 'abcdefghij0' }, snippet: { title: 'Inside leg kicks tutorial', channelTitle: 'Coach' } }, { id: { videoId: 'abcdefghij1' }, snippet: { title: 'Cooking tutorial' } }] }), 'inside leg kicks');
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Inside leg kicks tutorial');
});

test('video fallback searches once, passes kids context, filters broken links and bounds results', async () => {
  let searches = 0;
  const result = await suggestLessonVideos({ title: 'Jab', discipline: 'Boxing', audience: 'Kids' }, {
    env: { YOUTUBE_API_KEY: 'fake' },
    search: async (query, discipline) => { searches++; assert.equal(query, 'jab drill kids non contact'); assert.equal(discipline, 'Boxing'); return Array.from({ length: 8 }, (_, i) => ({ url: `https://www.youtube.com/watch?v=abcdefghij${i}`, title: 'Jab drill' })); },
    verify: async url => { if (url.endsWith('0')) throw new Error('private error'); return { url, kind: 'youtube', title: 'Jab drill' }; },
  });
  assert.equal(searches, 1);
  assert.equal(result.videos.length, 5);
  assert.equal(result.videos.filter(item => item.link_only).length, 1);
  const empty = await suggestLessonVideos({ title: 'Jab', discipline: 'Boxing' }, { env: {}, verify: async () => { throw new Error('blocked'); } });
  assert.equal(empty.videos.length, 1);
  assert.equal(empty.videos[0].link_only, true);
  assert.match(empty.message, /unconfirmed playback/);
});

test('video approval creates an editable copy, preserves saved attachments and prevents duplicate additions', () => {
  const existing = [{ id: 1, url: 'https://www.youtube.com/watch?v=abcdefghij0' }];
  const video = { url: 'https://www.youtube.com/watch?v=abcdefghij1', title: 'Drill' };
  const approved = withApprovedVideo(existing, video);
  assert.equal(existing.length, 1);
  assert.equal(approved.length, 2);
  assert.equal(approved[1].origin, 'suggested');
  assert.equal(withApprovedVideo(approved, video).length, 2);
  assert.equal(withApprovedVideo(existing).length, 1);
  assert.throws(() => withApprovedVideo(Array.from({ length: 12 }, () => existing[0]), video), /maximum/);
});


test('file signatures identify supported pictures and videos and reject everything else', () => {
  assert.deepEqual(sniffMedia(png), { kind: 'image', mime: 'image/png' });
  assert.deepEqual(sniffMedia(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])), { kind: 'image', mime: 'image/jpeg' });
  assert.deepEqual(sniffMedia(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)])), { kind: 'image', mime: 'image/gif' });
  assert.deepEqual(sniffMedia(Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBP'), Buffer.alloc(32)])), { kind: 'image', mime: 'image/webp' });
  assert.deepEqual(sniffMedia(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(32)])), { kind: 'video', mime: 'video/mp4' });
  assert.deepEqual(sniffMedia(webm), { kind: 'video', mime: 'video/webm' });
  assert.equal(sniffMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniffMedia(Buffer.from('<!doctype html><html></html>')), null);
  assert.equal(sniffMedia(Buffer.alloc(4)), null);
  assert.equal(sniffMedia(null), null);
});

test('YouTube links in every common form resolve to the same 11 character ID', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [`https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=30s`, `https://m.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?si=x`, `https://www.youtube.com/embed/${id}`, `https://www.youtube-nocookie.com/embed/${id}`, `https://www.youtube.com/shorts/${id}`, `  https://www.youtube.com/live/${id}  `]) assert.equal(youtubeId(link), id, link);
  for (const link of ['https://www.youtube.com/watch?v=short', 'https://example.com/watch?v=' + id, 'https://notyoutube.com/embed/' + id, 'javascript:alert(1)', 'not a link', '', null]) assert.equal(youtubeId(link), null, String(link));
});

test('private, loopback and link-local network addresses are never public', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-address']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.equal(isPublicAddress(address), true, address);
  await new Promise(resolve => publicLookup('localhost', {}, error => { assert.ok(error instanceof MediaLinkError); resolve(); }));
});

test('safeFetch accepts only plain https, follows a few redirects and rechecks every hop', async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push(url.href);
    assert.equal(options.method, 'GET');
    if (url.pathname === '/start') return { status: 302, headers: { location: '/next' }, body: Buffer.alloc(0) };
    if (url.pathname === '/to-http') return { status: 302, headers: { location: 'http://example.com/plain' }, body: Buffer.alloc(0) };
    if (url.pathname === '/loop') return { status: 302, headers: { location: '/loop' }, body: Buffer.alloc(0) };
    return { status: 200, headers: {}, body: Buffer.from('ok') };
  };
  const result = await safeFetch('https://example.com/start', { request });
  assert.equal(result.url, 'https://example.com/next');
  assert.deepEqual(calls, ['https://example.com/start', 'https://example.com/next']);
  for (const bad of ['http://example.com/a', 'ftp://example.com/a', 'https://example.com:8443/a', 'https://user:pass@example.com/a', 'nonsense', 'https://example.com/to-http', 'https://example.com/loop']) await assert.rejects(safeFetch(bad, { request }), MediaLinkError, bad);
});

test('verifyLink confirms YouTube through oEmbed and images or videos by their real file contents', async () => {
  const reply = (status, body, headers = {}) => async () => ({ status, headers, body: Buffer.from(body) });
  const ok = await verifyLink('https://youtu.be/dQw4w9WgXcQ', { fetcher: reply(200, JSON.stringify({ title: 'Jab basics', author_name: 'Coach Dan' })) });
  assert.deepEqual(ok, { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Jab basics', credit: 'YouTube — Coach Dan', source_page: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  await assert.rejects(verifyLink('https://youtu.be/dQw4w9WgXcQ', { fetcher: reply(404, '') }), /does not exist or is private/);
  await assert.rejects(verifyLink('https://youtu.be/dQw4w9WgXcQ', { fetcher: reply(401, '') }), /does not allow embedding/);
  await assert.rejects(verifyLink('https://youtu.be/dQw4w9WgXcQ', { fetcher: reply(500, '') }), /could not confirm/);
  const image = await verifyLink('https://cdn.example.com/photos/Double-leg_setup.png', { fetcher: reply(200, png, { 'content-type': 'image/png' }) });
  assert.deepEqual(image, { kind: 'image', url: 'https://cdn.example.com/photos/Double-leg_setup.png', title: 'Double leg setup', credit: '', source_page: '' });
  assert.equal((await verifyLink('https://cdn.example.com/clip.webm', { fetcher: reply(206, webm, { 'content-range': 'bytes 0-67/68' }) })).kind, 'video');
  await assert.rejects(verifyLink('https://example.com/page', { fetcher: reply(200, '<html></html>', { 'content-type': 'text/html; charset=utf-8' }) }), /web page, not a picture or video/);
  await assert.rejects(verifyLink('https://example.com/logo.svg', { fetcher: reply(200, '<svg xmlns="http://www.w3.org/2000/svg"/>', { 'content-type': 'image/svg+xml' }) }), /not a supported picture/);
  await assert.rejects(verifyLink('https://example.com/missing.png', { fetcher: reply(404, 'no') }), /status 404/);
  await assert.rejects(verifyLink('https://example.com/huge.png', { fetcher: reply(200, png, { 'content-length': String(100 * 1024 * 1024) }) }), /very large/);
  for (const bad of ['', '   ', 'not a link', 'http://example.com/a.png', 'x'.repeat(2100)]) await assert.rejects(verifyLink(bad, { fetcher: reply(200, png) }), MediaLinkError, bad);
});

test('attachment lists accept saved IDs and new links only, with bounded text', () => {
  const good = validateMediaList([{ id: 3, title: ' Jab ', activity: 'Warm-up — 5 minutes' }, { url: ' https://youtu.be/dQw4w9WgXcQ ', title: '', activity: '', origin: 'suggested', credit: 'YouTube', source_page: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }]);
  assert.deepEqual(good.media, [{ id: 3, title: 'Jab', activity: 'Warm-up — 5 minutes' }, { url: 'https://youtu.be/dQw4w9WgXcQ', origin: 'suggested', title: '', activity: '', credit: 'YouTube', source_page: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }]);
  for (const bad of ['x', {}, [null], [{ id: 0 }], [{ id: 1.5 }], [{ id: 1 }, { id: 1 }], [{ id: 1, url: 'https://a.com/x.png' }], [{ url: '' }], [{ url: 'https://a.com/x.png', origin: 'upload' }], [{ url: 'https://a.com/x.png', kind: 'video' }], [{ url: 'https://a.com/x.png', title: 'x'.repeat(121) }], [{ url: 'https://a.com/x.png', source_page: 'javascript:alert(1)' }], Array.from({ length: 13 }, (_, id) => ({ id: id + 1 }))]) assert.ok(validateMediaList(bad).error, JSON.stringify(bad).slice(0, 60));
  assert.deepEqual(validateMediaList([]).media, []);
});

test('activity helpers keep attachments with the right activity when headings change', () => {
  const media = [{ id: 1, activity: 'Warm-up — 10 minutes' }, { id: 2, activity: 'Drill — 5 minutes' }, { id: 3, activity: '' }];
  assert.deepEqual(renameActivity(media, 'Warm-up — 10 minutes', 'Warm-up — 12 minutes').map(item => item.activity), ['Warm-up — 12 minutes', 'Drill — 5 minutes', '']);
  assert.equal(renameActivity(media, '', 'New'), media);
  assert.deepEqual(unassignedMedia(media, ['Drill — 5 minutes']).map(item => item.id), [1, 3]);
  assert.deepEqual(mediaPayload([{ id: 4, title: 'A', activity: 'x', url: 'ignored' }, { origin: 'link', url: 'https://a.com/x.png', title: 'B' }]), [{ id: 4, title: 'A', activity: 'x' }, { url: 'https://a.com/x.png', origin: 'link', title: 'B', activity: '', credit: '', source_page: '' }]);
});

const commonsReply = pages => async () => Response.json({ query: { pages } });
const page = (title, mime, extra = {}) => ({ title, imageinfo: [{ url: `https://upload.wikimedia.org/${title}`, thumburl: `https://upload.wikimedia.org/thumb/${title}`, descriptionurl: `https://commons.wikimedia.org/wiki/${title}`, mime, extmetadata: { Artist: { value: '<a href="x">Jane Coach</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, ImageDescription: { value: 'A wrestler shoots a double leg takedown' }, ...extra } }] });

test('Commons search keeps only supported file types that match the technique and carries credit', async () => {
  const results = await commonsCandidates('double leg takedown', commonsReply([page('File:Double_leg_takedown.jpg', 'image/jpeg'), page('File:Double_leg.svg', 'image/svg+xml'), page('File:Random_beach.jpg', 'image/jpeg', { ImageDescription: { value: 'Beach' } }), page('File:Clip.ogv', 'video/ogg')]));
  const images = results.filter(item => item.url.includes('/thumb/'));
  assert.equal(images.length, 1);
  assert.equal(images[0].title, 'Double leg takedown');
  assert.equal(images[0].credit, 'Wikimedia Commons — Jane Coach, CC BY-SA 4.0');
  assert.match(images[0].source_page, /^https:\/\/commons\.wikimedia\.org\//);
  await assert.rejects(commonsCandidates('x', async () => new Response('', { status: 500 })));
  assert.deepEqual(cleanQueries(['  knee   cut  ', 'a', 'x'.repeat(81), 7, 'b'.repeat(5), 'third one']), ['knee cut', 'bbbbb']);
});

test('finder returns only verified media matched to the section that asked for it and never repeats a link', async () => {
  const verified = [];
  const verify = async url => { verified.push(url); if (url.includes('broken')) throw new MediaLinkError('gone'); return { kind: url.includes('watch') ? 'youtube' : 'image', url, title: 'Checked', credit: '', source_page: '' }; };
  const fetcher = async url => Response.json({ query: { pages: url.includes('filetype%3Abitmap') ? [page('File:Double_leg_takedown.jpg', 'image/jpeg'), page('File:Double_leg_broken.jpg', 'image/jpeg')] : [] } });
  const sections = [
    { name: 'Warm-up', instructions: 'Jog lightly.', queries: [] },
    { name: 'Technique teaching', instructions: 'Teach the double leg takedown.', queries: ['double leg takedown'] },
    { name: 'Progressive drills', instructions: 'Repeat the double leg takedown.', queries: ['double leg takedown'] },
  ];
  const result = await findMedia({ discipline: 'Wrestling', sections }, { fetcher, verify, env: {} });
  assert.ok(result.media.length >= 2);
  assert.ok(result.media.every(item => item.origin === 'suggested' && ['Technique teaching', 'Progressive drills'].includes(item.activity)));
  assert.equal(new Set(result.media.map(item => item.url)).size, result.media.length);
  assert.ok(result.media.every(item => !item.url.includes('broken')));
  assert.ok(!result.media.some(item => item.activity === 'Warm-up'));
  assert.ok(result.media.some(item => item.credit.startsWith('Wikimedia Commons') || item.credit.includes('David Avellan')));
  assert.ok(result.notes.every(note => typeof note === 'string'));
});

test('catalog media is matched on the technique the section asked for, not on passing mentions in its instructions', async () => {
  const verify = async url => ({ kind: url.includes('watch') ? 'youtube' : 'image', url, title: 'ok', credit: '', source_page: '' });
  const fetcher = async () => Response.json({ query: { pages: [] } });
  const passing = { name: 'Technique teaching', instructions: 'Warm up the jab, then teach the stance and roundhouse kick.', queries: ['lead roundhouse kick technique'] };
  assert.deepEqual((await findMedia({ discipline: 'Muay Thai', sections: [passing] }, { fetcher, verify, env: {} })).media, []);
  const asked = await findMedia({ discipline: 'Muay Thai', sections: [{ ...passing, queries: ['jab'] }] }, { fetcher, verify, env: {} });
  assert.ok(asked.media.length >= 1 && asked.media.every(item => item.activity === 'Technique teaching'));
});

test('finder uses the optional YouTube key only on the server and drops irrelevant titles', async () => {
  const seen = [];
  const fetcher = async (url, options) => {
    seen.push([url, options.headers['x-goog-api-key']]);
    if (url.includes('googleapis.com')) return Response.json({ items: [{ id: { videoId: 'AAAAAAAAAAA' }, snippet: { title: 'Pad work for beginners', channelTitle: 'Gym' } }, { id: { videoId: 'BBBBBBBBBBB' }, snippet: { title: 'Knee cut half guard pass tutorial', channelTitle: 'Coach' } }] });
    return Response.json({ query: { pages: [] } });
  };
  const verify = async url => ({ kind: 'youtube', url, title: 'ok', credit: '', source_page: '' });
  const result = await findMedia({ discipline: 'Brazilian Jiu-Jitsu', sections: [{ name: 'Technique teaching', instructions: 'Teach it.', queries: ['half guard pass'] }] }, { fetcher, verify, env: { YOUTUBE_API_KEY: 'test-key-value' } });
  assert.ok(result.media.some(item => item.url.endsWith('BBBBBBBBBBB')));
  assert.ok(!result.media.some(item => item.url.endsWith('AAAAAAAAAAA')));
  assert.ok(seen.some(([url, key]) => url.includes('googleapis.com') && key === 'test-key-value' && !url.includes('test-key-value')));
});
