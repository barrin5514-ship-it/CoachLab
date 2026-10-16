import { mediaLimits } from '../client/src/media.js';

const text = (value, limit) => value === undefined || value === null ? '' : typeof value === 'string' && value.length <= limit ? value.trim() : null;
const linkFields = ['url', 'origin', 'title', 'activity', 'credit', 'source_page'];
const savedFields = ['id', 'title', 'activity'];

export function validateMediaList(list) {
  if (!Array.isArray(list)) return { error: 'media must be a list of attachments.' };
  if (list.length > mediaLimits.perLesson) return { error: `A lesson can have at most ${mediaLimits.perLesson} pictures and videos.` };
  const media = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: 'Each attachment must be an object.' };
    const title = text(item.title, mediaLimits.title);
    const activity = text(item.activity, mediaLimits.activity);
    if (title === null || activity === null) return { error: `Attachment titles must be at most ${mediaLimits.title} characters and activities at most ${mediaLimits.activity}.` };
    if (item.id !== undefined) {
      if (Object.keys(item).some(key => !savedFields.includes(key))) return { error: 'Saved attachments may only change title and activity.' };
      if (!Number.isInteger(item.id) || item.id < 1 || item.id > 2147483647 || seen.has(item.id)) return { error: 'Attachment IDs must be unique positive whole numbers.' };
      seen.add(item.id);
      media.push({ id: item.id, title, activity });
      continue;
    }
    if (Object.keys(item).some(key => !linkFields.includes(key))) return { error: 'The attachment contains unsupported fields.' };
    if (typeof item.url !== 'string' || !item.url.trim() || item.url.length > mediaLimits.url) return { error: 'Each new attachment needs a link.' };
    if (!['link', 'suggested'].includes(item.origin ?? 'link')) return { error: 'Attachment origin must be link or suggested.' };
    const credit = text(item.credit, 300);
    const sourcePage = text(item.source_page, mediaLimits.url);
    if (credit === null || sourcePage === null) return { error: 'Attachment credit or source page is too long.' };
    if (sourcePage && !/^https:\/\//i.test(sourcePage)) return { error: 'Attachment source pages must be https links.' };
    media.push({ url: item.url.trim(), origin: item.origin ?? 'link', title, activity, credit, source_page: sourcePage });
  }
  return { media };
}
