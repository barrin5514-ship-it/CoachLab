import { catalogCandidates, youtubeCandidates } from './media-finder.js';
import { verifyLink } from './media-verify.js';
import { youtubeId } from '../client/src/media.js';

const techniques = ['jab', 'cross', 'hook', 'uppercut', 'footwork', 'slip', 'parry', 'roundhouse', 'teep', 'clinch', 'knee strike', 'elbow strike', 'double leg', 'single leg', 'sprawl', 'pummel', 'breakfall', 'shrimp', 'bridge', 'guard pass', 'knee cut', 'half guard', 'kimura', 'armbar', 'triangle', 'squat', 'lunge', 'deadlift', 'push up', 'pull up', 'plank', 'row', 'balance', 'mobility'];
export function lessonVideoQuery(lesson) {
  const text = [lesson.title, lesson.goal, lesson.drills].join(' ').toLowerCase().replace(/[-–—]/g, ' ');
  const names = techniques.filter(name => new RegExp(`\\b${name}s?\\b`).test(text));
  const safe = lesson.audience === 'Kids' ? names.filter(name => !['kimura', 'armbar', 'triangle', 'clinch', 'knee strike', 'elbow strike'].includes(name)) : names;
  if (!safe.length) return null;
  return { technique: safe.slice(0, 2).join(' '), audience: lesson.audience === 'Kids' ? 'kids non contact' : lesson.audience === 'Adults' ? 'adults' : 'beginners' };
}

export async function suggestLessonVideos(lesson, { env = process.env, verify = verifyLink, search = youtubeCandidates } = {}) {
  const query = lessonVideoQuery(lesson);
  if (!query) return { videos: [], message: 'No recognized technique found. Add a clear technique name such as jab, double-leg, knee-cut or squat, then save and try again. You can also paste a video link in Edit lesson.' };
  const videos = [];
  const check = async candidates => {
    for (const candidate of candidates.slice(0, 5)) {
      if (!youtubeId(candidate.url) || videos.some(item => youtubeId(item.url) === youtubeId(candidate.url))) continue;
      try {
        const info = await verify(candidate.url);
        if (info.kind === 'youtube') videos.push({ ...info, origin: 'suggested', title: info.title || candidate.title, activity: '', credit: info.credit || candidate.credit, source_page: candidate.source_page });
      } catch { /* Unavailable or blocked videos are omitted. */ }
    }
  };
  const curated = catalogCandidates(lesson.discipline, {}, [query.technique]).filter(item => youtubeId(item.url));
  if (lesson.audience !== 'Kids') await check(curated);
  if (!videos.length && env.YOUTUBE_API_KEY) {
    await check(await search(`${query.technique} drill ${query.audience}`, lesson.discipline, env.YOUTUBE_API_KEY));
  }
  return { videos: videos.slice(0, 5), message: videos.length ? 'Preview first: relevance and age suitability need coach review. Add opens the editor; Save changes keeps the video. If playback is blocked, use Watch on YouTube or choose another video.' : 'No playable matching videos found, or YouTube search is unavailable. Try later or paste a link in Edit lesson.' };
}

export function registerVideoSuggestions(app, lessons, { videoFinder = suggestLessonVideos, now = Date.now } = {}) {
  const users = new Map();
  let attempts = [];
  let busy = false;
  app.post('/api/lessons/:id/videos', async (request, response) => {
    const lesson = (await lessons.list(request.user.id)).find(item => item.id === request.lessonId);
    if (!lesson) return response.status(404).json({ error: 'Lesson not found.' });
    const time = now();
    for (const [id, times] of users) { const recent = times.filter(start => time - start < 86400000); if (recent.length) users.set(id, recent); else users.delete(id); }
    const times = users.get(request.user.id) || [];
    attempts = attempts.filter(start => time - start < 86400000);
    if (busy || attempts.length >= 10 || times.length >= 5 || times.filter(start => time - start < 60000).length >= 3 || (!users.has(request.user.id) && users.size >= 128)) return response.status(429).json({ error: 'Video suggestion limit reached or search is busy. Try later; you can still paste a video link.' });
    users.set(request.user.id, [...times, time]); attempts.push(time); busy = true;
    try { response.json(await videoFinder(lesson)); }
    catch { response.status(502).json({ error: 'Video search is unavailable. Try later or paste a link in Edit lesson.' }); }
    finally { busy = false; }
  });
}
