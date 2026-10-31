// Connects authenticated Express routes to lesson storage, media checks and AI services.
import { registerClassRoutes } from './class-route.js';
import { registerChatRoute } from './chat.js';
import { registerVideoSuggestions } from './video-suggestions.js';
import { youtubeQuota as defaultYouTubeQuota } from './youtube-quota.js';
import express from 'express';
import { sqliteLessons, MediaReferenceError } from './lesson-store.js';
import { validateLesson } from './validate-lesson.js';
import { registerAiRoute, createDraftGenerator } from './ai-route.js';
import { validateMediaList } from './media-validate.js';
import { verifyLink as defaultVerify, MediaLinkError } from './media-verify.js';
import { findMedia as defaultFind } from './media-finder.js';
import { sniffMedia } from './media-sniff.js';
import { mediaLimits, uploadTypes } from '../client/src/media.js';
import { disciplines } from '../client/src/lesson-draft.js';
import { serveFrontend } from './web.js';
import { productionApiGuard } from './request-guard.js';

const orphanAgeMs = 24 * 60 * 60 * 1000;
// Shows only a link hostname in user errors, not private query strings.
const hostOf = value => { try { return new URL(value).hostname; } catch { return 'that link'; } };

// Serves authorized upload bytes with safe headers and bounded range handling.
function sendFile(request, response, file) {
  const data = Buffer.from(file.data);
  response.set({ 'Content-Type': file.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-cache', Vary: 'Cookie', 'Accept-Ranges': 'bytes', 'Content-Disposition': 'inline' });
  const range = request.headers.range;
  if (!range) return response.status(200).send(data);
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match && match[1] !== '' ? Number(match[1]) : match && match[2] !== '' ? Math.max(0, data.length - Number(match[2])) : NaN;
  const end = match && match[1] !== '' && match[2] !== '' ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
  if (!match || Number.isNaN(start) || start >= data.length || start > end) return response.status(416).set('Content-Range', `bytes */${data.length}`).end();
  return response.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': String(end - start + 1) }).send(data.subarray(start, end + 1));
}

// Builds the API with authentication required, regardless of the selected database.
export function createApp(database, options = {}) {
  const { verifyLink = defaultVerify, findMedia = defaultFind } = options;
  const logError = options.logError ?? (process.env.NODE_TEST_CONTEXT ? () => {} : error => console.error('CoachLab API error:', error?.name, error?.code ?? ''));
  const { auth, allowedOrigins = [] } = options;
  const researchLibrary = options.researchLibrary;
  if (!auth || typeof auth.getUser !== 'function') throw new Error('An authentication adapter is required; CoachLab never serves lessons without one.');
  const app = express();
  app.disable('x-powered-by');
  if (options.production) {
    // Trust only the nearest hosting proxy when interpreting the client address.
    app.set('trust proxy', 1);
    app.use((request, response, next) => {
      request.headers['x-forwarded-for'] = request.ip;
      next();
    });
  }
  app.use('/api', (request, response, next) => {
    response.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  if (options.production) app.use('/api', productionApiGuard());
  if (auth.handler) app.all('/api/auth/*splat', auth.handler);
  // Bound body size before validation; production also rejects compressed bodies.
  app.use(express.json({ limit: '32kb', inflate: !options.production }));
  const lessons = typeof database.prepare === 'function' ? sqliteLessons(database) : database;
  let suggestions = [];
  let suggesting = false;

  // Validates attachment fields and checks new links before a lesson write.
  async function verifiedMedia(rawMedia) {
    const checked = validateMediaList(rawMedia);
    if (checked.error) return { error: checked.error };
    if (!lessons.media) return { error: 'This database does not support media attachments.' };
    const results = await Promise.allSettled(checked.media.map(item => item.id ? item : verifyLink(item.url)));
    const media = [];
    for (const [index, result] of results.entries()) {
      const item = checked.media[index];
      if (result.status === 'rejected') {
        if (result.reason instanceof MediaLinkError) return { error: `The link to ${hostOf(item.url)} could not be used: ${result.reason.message}` };
        return { error: `CoachLab could not check the link to ${hostOf(item.url)} right now. Try again in a moment.` };
      }
      if (item.id) { media.push(item); continue; }
      const info = result.value;
      media.push({ ...item, kind: info.kind, url: info.url, title: item.title || info.title, credit: item.credit || info.credit || '', source_page: item.source_page || info.source_page || '' });
    }
    return { media };
  }
  // Runs shared lesson and media validation before the selected create or update operation.
  async function saveWithMedia(request, response, save) {
    if (!request.is('application/json')) return response.status(400).json({ error: 'Send Content-Type: application/json.' });
    const hasMedia = request.body && typeof request.body === 'object' && !Array.isArray(request.body) && 'media' in request.body;
    const { media: rawMedia, ...fields } = hasMedia ? request.body : { ...request.body };
    const result = validateLesson(hasMedia ? fields : request.body);
    if (result.error) return response.status(400).json({ error: result.error });
    let media;
    if (hasMedia) {
      const checked = await verifiedMedia(rawMedia);
      if (checked.error) return response.status(400).json({ error: checked.error });
      media = checked.media;
    }
    try {
      return await save(result.lesson, media);
    } catch (error) {
      if (error instanceof MediaReferenceError) return response.status(400).json({ error: error.message });
      throw error;
    }
  }

  // Answers health checks without exposing database contents or requiring a login.
  app.get('/api/health', (request, response) => {
    response.json({ status: 'ok', service: 'CoachLab API' });
  });
  // Publishes feature flags only, not provider credentials or secrets.
  app.get('/api/auth-config', (request, response) => {
    response.json({ google: !!auth.google, mail: auth.mailMode ?? 'none', passwordReset: auth.passwordResetEnabled !== false });
  });
  // Server-to-server import from the Research Agent. Token-guarded, saved under one owner only.
  if (researchLibrary) {
    app.post('/api/import/research-post', async (request, response) => {
      if (!request.is('application/json')) return response.status(400).json({ error: 'Send JSON.' });
      const token = process.env.COACHLAB_IMPORT_TOKEN;
      if (!token || request.headers['x-coachlab-import-token'] !== token) return response.status(401).json({ error: 'Import is not authorized.' });
      const ownerId = process.env.COACHLAB_IMPORT_OWNER_ID;
      if (!ownerId) return response.status(500).json({ error: 'Import owner is not configured on the server.' });
      const body = request.body || {};
      const title = String(body.title || '').trim().slice(0, 300);
      const url = String(body.url || '').trim().slice(0, 2000);
      if (!title || !/^https:\/\//i.test(url)) return response.status(400).json({ error: 'A title and https link are required.' });
      const post = { source_id: url, title, url, summary: String(body.summary || '').trim().slice(0, 4000), transcript: String(body.transcript || '').trim().slice(0, 60000), discipline: String(body.discipline || '').trim().slice(0, 60), drills: String(body.drills || '').trim().slice(0, 8000) };
      const saved = await researchLibrary.add(ownerId, post);
      response.status(saved ? 201 : 200).json({ ok: true, duplicate: !saved });
    });
  }
  app.use('/api', async (request, response, next) => {
    // Reject writes from other sites before trusting a session cookie.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !allowedOrigins.includes(request.headers.origin)) {
      return response.status(403).json({ error: 'This request was blocked for your safety because it did not come from CoachLab.' });
    }
    // Every protected API request needs a real server-side session.
    const user = await auth.getUser(request);
    if (!user) return response.status(401).json({ error: 'Please sign in to continue.' });
    request.user = user;
    next();
  });
  // Uses shared validation and owner-scoped storage for lesson requests.
  app.get('/api/lessons', async (request, response) => {
    response.json(await lessons.list(request.user.id));
  });
  // Uses shared validation and owner-scoped storage for lesson requests.
  app.post('/api/lessons', (request, response) => saveWithMedia(request, response, async (lesson, media) => response.status(201).json(await lessons.create(request.user.id, lesson, media))));
  app.param('id', (request, response, next, value) => {
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) return response.status(400).json({ error: 'Invalid lesson ID.' });
    request.lessonId = Number(value);
    next();
  });
  // Acts only on the signed-in owner's lesson and keeps the existing lesson ID.
  app.put('/api/lessons/:id', (request, response) => saveWithMedia(request, response, async (lesson, media) => {
    const saved = await lessons.update(request.user.id, request.lessonId, lesson, media);
    if (!saved) return response.status(404).json({ error: 'Lesson no longer exists. Your edits have not been saved.' });
    return response.json(saved);
  }));
  // Acts only on the signed-in owner's lesson and keeps the existing lesson ID.
  app.delete('/api/lessons/:id', async (request, response) => {
    if (!await lessons.remove(request.user.id, request.lessonId)) return response.status(404).json({ error: 'Lesson no longer exists.' });
    response.status(204).end();
  });

  // Private Research Library: list, match, and turn a post into a lesson.
  if (researchLibrary) {
    app.get('/api/research-posts', async (request, response) => response.json(await researchLibrary.list(request.user.id)));
    app.get('/api/research-posts/suggest', async (request, response) => {
      const discipline = String(request.query.discipline || '').trim().toLowerCase();
      const terms = String(request.query.q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      const posts = await researchLibrary.list(request.user.id);
      const matches = posts.filter(post => !discipline || post.discipline.toLowerCase() === discipline).map(post => {
        const text = (post.title + ' ' + post.summary + ' ' + post.drills).toLowerCase();
        return { post, score: terms.reduce((n, term) => n + (text.includes(term) ? 1 : 0), 0) };
      }).filter(item => !terms.length || item.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
      response.json(matches.map(item => item.post));
    });
    app.post('/api/lessons/from-post', async (request, response) => {
      const postId = Number(request.body?.postId);
      if (!Number.isInteger(postId) || postId < 1) return response.status(400).json({ error: 'Choose a post.' });
      const posts = await researchLibrary.list(request.user.id);
      const post = posts.find(p => p.id === postId);
      if (!post) return response.status(404).json({ error: 'Post not found.' });
      const valid = ['Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training'];
      const lesson = { title: post.title, discipline: valid.includes(post.discipline) ? post.discipline : 'MMA', skill_level: 'Beginner', goal: '', drills: post.drills, coaching_notes: post.summary, audience: 'Unspecified' };
      response.status(201).json(await lessons.create(request.user.id, lesson, null));
    });
  }

  // Lists attachment metadata for the signed-in coach only.
  app.get('/api/lesson-media', async (request, response) => {
    if (!lessons.media) return response.json([]);
    response.json(await lessons.media.list(request.user.id));
  });
  // Bounds raw uploads and converts parser failures to useful public messages.
  const uploadBody = (request, response, next) => express.raw({ type: () => true, limit: mediaLimits.video + 1024, inflate: !options.production })(request, response, error => {
    if (error) return response.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'That file is too large. Pictures can be up to 6 MB and videos up to 20 MB; use a YouTube link for longer videos.' : 'The upload could not be read.' });
    next();
  });
  // Checks real file bytes, size and type before keeping an owned pending upload.
  app.post('/api/media/upload', uploadBody, async (request, response) => {
    if (!lessons.media) return response.status(501).json({ error: 'This database does not support media attachments.' });
    const declared = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!uploadTypes[declared]) return response.status(415).json({ error: 'Upload a PNG, JPEG, GIF, WebP picture or an MP4 or WebM video.' });
    const data = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (!data.length) return response.status(400).json({ error: 'The file is empty.' });
    // File extensions and browser MIME labels can be false; check the actual bytes.
    const detected = sniffMedia(data);
    if (!detected || detected.kind !== uploadTypes[declared]) return response.status(415).json({ error: 'The file contents do not match a supported picture or video type.' });
    if (data.length > mediaLimits[detected.kind]) return response.status(413).json({ error: `${detected.kind === 'image' ? 'Pictures can be up to 6 MB' : 'Videos can be up to 20 MB; use a YouTube link for longer videos'}.` });
    let name = '';
    try { name = decodeURIComponent(String(request.headers['x-file-name'] || '')); } catch { name = ''; }
    const title = name.split(/[\\/]/).pop().replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, mediaLimits.title);
    Promise.resolve().then(() => lessons.media.purgeOrphans(orphanAgeMs)).catch(() => {});
    response.status(201).json(await lessons.media.addUpload(request.user.id, { kind: detected.kind, mime: detected.mime, title, data }));
  });
  // Serves bytes only after verifying that this coach owns the upload.
  app.get('/api/media/:id/file', async (request, response) => {
    const file = lessons.media ? await lessons.media.getFile(request.user.id, request.lessonId) : null;
    if (!file) return response.status(404).json({ error: 'Media file not found.' });
    sendFile(request, response, file);
  });
  // Allows cleanup of an owned pending upload, not deletion of saved media by URL alone.
  app.delete('/api/media/:id', async (request, response) => {
    if (!lessons.media || !await lessons.media.removeOrphan(request.user.id, request.lessonId)) return response.status(404).json({ error: 'Upload not found or already attached to a lesson.' });
    response.status(204).end();
  });
  // Checks external media on the server so private network addresses remain blocked.
  app.post('/api/media/verify', async (request, response) => {
    if (!request.is('application/json') || typeof request.body?.url !== 'string') return response.status(400).json({ error: 'Send JSON with a url.' });
    try {
      response.json(await verifyLink(request.body.url));
    } catch (error) {
      if (error instanceof MediaLinkError) return response.status(400).json({ error: error.message });
      response.status(502).json({ error: 'CoachLab could not check that link right now. Try again in a moment.' });
    }
  });
  // Bounds section-based media searches and shares real YouTube search quota.
  app.post('/api/media/suggest', async (request, response) => {
    const body = request.body;
    const sections = Array.isArray(body?.sections) ? body.sections : null;
    const valid = request.is('application/json') && disciplines.includes(body?.discipline) && sections && sections.length <= 5 && sections.every(section => section && typeof section.name === 'string' && section.name.length <= 100 && typeof section.instructions === 'string' && section.instructions.length <= 1500 && (section.queries === undefined || (Array.isArray(section.queries) && section.queries.length <= 3 && section.queries.every(query => typeof query === 'string' && query.length <= 80))));
    if (!valid) return response.status(400).json({ error: 'Send a discipline and up to five sections.' });
    const now = Date.now();
    suggestions = suggestions.filter(time => now - time < 86400000);
    if (suggesting || suggestions.length >= 60 || suggestions.filter(time => now - time < 60000).length >= 6) return response.status(429).json({ error: 'Media search limit reached. Try again shortly; you can still add media yourself.' });
    suggestions.push(now);
    suggesting = true;
    try {
      response.json(await findMedia({ discipline: body.discipline, sections }, { reserveSearch: () => (options.youtubeQuota || defaultYouTubeQuota).take(request.user.id) }));
    } catch {
      response.status(502).json({ error: 'CoachLab could not search for media right now. You can still add pictures and videos yourself.' });
    } finally {
      suggesting = false;
    }
  });

  const generate = createDraftGenerator(options);
  registerClassRoutes(app, options.classes, generate);
  registerAiRoute(app, { ...options, generate });
  registerChatRoute(app, options);
  registerVideoSuggestions(app, lessons, options);
  if (options.production) serveFrontend(app, options.frontendDirectory);
  app.use((request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });
  app.use((error, request, response, next) => {
    const status = [400, 413, 415].includes(error.status) ? error.status : 500;
    if (status === 500) logError(error);
    const messages = { 400: 'Request body must contain valid JSON.', 413: 'JSON request must not exceed 32 KB.', 415: 'Unsupported request encoding.', 500: 'Unexpected server error.' };
    response.status(status).json({ error: messages[status] });
  });
  return app;
}
