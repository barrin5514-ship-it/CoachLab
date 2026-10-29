import { catalogCandidates, youtubeCandidates } from './media-finder.js';
import { verifyLink } from './media-verify.js';
import { youtubeId } from '../client/src/media.js';
import { youtubeQuota as defaultQuota, YouTubeQuotaError } from './youtube-quota.js';

const techniques = ['jab', 'cross', 'hook', 'uppercut', 'footwork', 'slip', 'parry', 'roundhouse', 'teep', 'clinch', 'knee strike', 'elbow strike', 'double leg', 'single leg', 'sprawl', 'pummel', 'breakfall', 'shrimp', 'bridge', 'guard pass', 'knee cut', 'half guard', 'kimura', 'armbar', 'triangle', 'squat', 'lunge', 'deadlift', 'push up', 'pull up', 'plank', 'row', 'balance', 'mobility'];
const filler = new Set('a an the and or to of for with from using use used on in at by is are be this that lesson class training goal objective techniques technique activity activities section sections cues coaching notes minutes minute drills drill practice slowly carefully please learn teach demonstrate common mistakes easier harder option avoid no not opponent students student coach'.split(' '));
export function lessonVideoQuery(lesson) {
  const fields = [lesson.title, lesson.goal, lesson.techniques, lesson.drills, lesson.coaching_notes];
  const ranked = new Map();
  for (const [index, field] of fields.entries()) {
    const text = String(field || '').slice(0, 16000).toLowerCase().replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+|\b\d[\d ()+-]{7,}\d\b/g, ' ').replace(/\b(?:named|name is)\s+[a-z]+(?:\s+[a-z]+)?/g, ' ').replace(/[-–—]/g, ' ');
    for (const sentence of text.split(/[\n.!?;:,]+/)) {
      let words = [];
      const keep = () => {
        if (!words.length) return;
        const phrase = words.slice(0, 4).join(' ');
        const score = (index === 0 ? 12 : index === 1 ? 9 : 5) + words.length + (techniques.some(name => phrase.includes(name)) ? 3 : 0);
        ranked.set(phrase, Math.max(ranked.get(phrase) || 0, score));
        words = [];
      };
      for (const word of sentence.match(/[a-z]+/g) || []) { if (['a', 'an', 'the'].includes(word)) continue; if (filler.has(word) || word.length < 2) keep(); else { words.push(word); if (words.length === 4) keep(); } }
      keep();
    }
  }
  const eligible = [...ranked].filter(([phrase]) => lesson.audience !== 'Kids' || !/\b(kimuras?|armbars?|triangles?|chokes?|submissions?|sparring|clinch|elbows?|head|contact|knee strike|heel hook|kneebar)\b/.test(phrase));
  const phrases = eligible.filter(([phrase]) => !eligible.some(([other]) => other !== phrase && (' ' + other + ' ').includes(' ' + phrase + ' '))).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([phrase]) => phrase);
  if (!phrases.length) return null;
  return { phrases, technique: phrases.slice(0, 2).join(' '), audience: lesson.audience === 'Kids' ? 'kids non contact' : lesson.audience === 'Adults' ? 'adults' : 'beginners' };
}

export async function suggestLessonVideos(lesson, { env = process.env, verify = verifyLink, search, reserveSearch } = {}) {
  const query = lessonVideoQuery(lesson);
  if (!query) return { videos: [], message: 'No useful technique details found. Add a clear title or activity description, then save and try again. You can also paste a video link in Edit lesson.' };
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
    const find = search || ((text, discipline, key) => youtubeCandidates(text, discipline, key, fetch, query.phrases[0], reserveSearch));
    await check(await find(`${query.technique} drill ${query.audience}`, lesson.discipline, env.YOUTUBE_API_KEY));
  }
  return { videos: videos.slice(0, 5), message: videos.length ? 'Preview first: relevance and age suitability need coach review. Add opens the editor; Save changes keeps the video. If playback is blocked, use Watch on YouTube or choose another video.' : 'No playable matching videos found, or YouTube search is unavailable. Try later or paste a link in Edit lesson.' };
}

export function registerVideoSuggestions(app, lessons, { videoFinder = suggestLessonVideos, now = Date.now, youtubeQuota = defaultQuota } = {}) {
  const users = new Map();
  let busy = false;
  app.post('/api/lessons/:id/videos', async (request, response) => {
    const lesson = (await lessons.list(request.user.id)).find(item => item.id === request.lessonId);
    if (!lesson) return response.status(404).json({ error: 'Lesson not found.' });
    const time = now();
    for (const [id, times] of users) { const recent = times.filter(start => time - start < 60000); if (recent.length) users.set(id, recent); else users.delete(id); }
    const times = users.get(request.user.id) || [];
    if (busy || times.length >= 5 || (!users.has(request.user.id) && users.size >= 128)) return response.status(429).json({ error: 'Video search is busy or five requests per minute were used. Try shortly; you can still paste a video link.' });
    users.set(request.user.id, [...times, time]); busy = true;
    try { response.json(await videoFinder(lesson, { reserveSearch: () => youtubeQuota.take(request.user.id) })); }
    catch (error) { response.status(error instanceof YouTubeQuotaError ? 429 : 502).json({ error: error instanceof YouTubeQuotaError ? error.message : 'Video search is unavailable. Try later or paste a link in Edit lesson.' }); }
    finally { busy = false; }
  });
}
