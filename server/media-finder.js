import { mediaCatalog } from '../client/src/lesson-media.js';
import { youtubeId } from '../client/src/media.js';
import { verifyLink } from './media-verify.js';

const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'drill', 'drills', 'basic', 'basics', 'how', 'technique', 'exercise']);
const significant = text => [...new Set(String(text).toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter(word => !stopWords.has(word));
const strip = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const relevant = (query, text, share) => {
  const words = significant(query);
  if (!words.length) return false;
  const haystack = text.toLowerCase();
  return words.filter(word => haystack.includes(word)).length >= Math.max(1, Math.ceil(words.length * share));
};
const jsonFrom = async (fetcher, url, headers = {}) => {
  const response = await fetcher(url, { headers: { 'user-agent': 'CoachLab/1.0 (local coaching lesson planner)', accept: 'application/json', ...headers }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('search unavailable');
  return response.json();
};

export const cleanQueries = queries => (Array.isArray(queries) ? queries : []).filter(query => typeof query === 'string').map(query => query.replace(/\s+/g, ' ').trim()).filter(query => query.length >= 3 && query.length <= 80).slice(0, 2);

export function catalogCandidates(discipline, section, queries) {
  const text = queries.length ? queries.join(' ') : '';
  return mediaCatalog.filter(item => item.disciplines.includes(discipline) && item.terms.test(text)).flatMap(item => [
    { url: item.image, title: item.title, credit: item.credit, source_page: item.source, rank: 0 },
    ...(item.video ? [{ url: `https://www.youtube.com/watch?v=${youtubeId(item.video)}`, title: item.title, credit: item.credit, source_page: item.source, rank: 0 }] : []),
  ]);
}

export async function commonsCandidates(query, fetcher = fetch) {
  const found = [];
  for (const [filter, mimes] of [['bitmap', ['image/jpeg', 'image/png', 'image/webp', 'image/gif']], ['video', ['video/webm', 'video/mp4']]]) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${query} filetype:${filter}`)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=800&format=json&formatversion=2`;
    const data = await jsonFrom(fetcher, url);
    for (const page of data.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (!info || !mimes.includes(info.mime)) continue;
      const meta = info.extmetadata || {};
      const description = strip(meta.ImageDescription?.value);
      if (!relevant(query, `${page.title} ${description}`, 0.67)) continue;
      const artist = strip(meta.Artist?.value).slice(0, 100);
      const license = strip(meta.LicenseShortName?.value).slice(0, 40);
      found.push({ url: filter === 'bitmap' ? info.thumburl || info.url : info.url, title: page.title.replace(/^File:/, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').slice(0, 120), credit: `Wikimedia Commons${artist ? ` — ${artist}` : ''}${license ? `, ${license}` : ''}`.slice(0, 300), source_page: info.descriptionurl, rank: 2 });
    }
  }
  return found;
}

export async function youtubeCandidates(query, discipline, key, fetcher = fetch) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict&maxResults=5&q=${encodeURIComponent(`${query} ${discipline}`)}`;
  const data = await jsonFrom(fetcher, url, { 'x-goog-api-key': key });
  return (data.items || []).filter(item => item.id?.videoId && relevant(query, item.snippet?.title || '', 0.5)).map(item => ({ url: `https://www.youtube.com/watch?v=${item.id.videoId}`, title: strip(item.snippet.title).slice(0, 120), credit: `YouTube — ${strip(item.snippet.channelTitle).slice(0, 100)}`, source_page: `https://www.youtube.com/watch?v=${item.id.videoId}`, rank: 1 }));
}

export async function findMedia({ discipline, sections }, { fetcher = fetch, verify = verifyLink, env = process.env } = {}) {
  const key = (env.YOUTUBE_API_KEY || '').trim();
  const perSection = await Promise.all(sections.map(async section => {
    const queries = cleanQueries(section.queries);
    const candidates = catalogCandidates(discipline, section, queries);
    for (const query of queries) {
      const sources = [commonsCandidates(query, fetcher)];
      if (key) sources.push(youtubeCandidates(query, discipline, key, fetcher));
      for (const result of await Promise.allSettled(sources)) if (result.status === 'fulfilled') candidates.push(...result.value);
    }
    candidates.sort((a, b) => a.rank - b.rank);
    const checked = await Promise.allSettled(candidates.slice(0, 8).map(candidate => verify(candidate.url).then(info => ({ candidate, info }))));
    return { section, verified: checked.filter(result => result.status === 'fulfilled').map(result => result.value), tried: queries.length > 0 || candidates.length > 0 };
  }));
  const used = new Set();
  const media = [];
  const notes = [];
  for (const { section, verified, tried } of perSection) {
    const picked = { image: 0, video: 0 };
    for (const { candidate, info } of verified) {
      const slot = info.kind === 'image' ? 'image' : 'video';
      if (picked[slot] >= 1 || used.has(info.url) || media.length >= 8) continue;
      picked[slot] += 1;
      used.add(info.url);
      media.push({ origin: 'suggested', kind: info.kind, url: info.url, title: (candidate.title || info.title).slice(0, 120), activity: section.name, credit: candidate.credit || info.credit || '', source_page: candidate.source_page || info.source_page || '' });
    }
    if (tried && !picked.image && !picked.video) notes.push(`No verified picture or video was found for ${section.name}.`);
  }
  return { media, notes };
}
