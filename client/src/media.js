export const mediaLimits = { image: 6 * 1024 * 1024, video: 20 * 1024 * 1024, perLesson: 12, title: 120, activity: 200, url: 2000 };
export const uploadTypes = { 'image/png': 'image', 'image/jpeg': 'image', 'image/gif': 'image', 'image/webp': 'image', 'video/mp4': 'video', 'video/webm': 'video' };

export function youtubeId(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, part] = url.pathname.split('/');
    id = kind === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live', 'v'].includes(kind) ? part : null;
  }
  return /^[\w-]{11}$/.test(id || '') ? id : null;
}

export const attachmentSrc = item => item.origin === 'upload' ? `/api/media/${item.id}/file` : item.url;
export const headingOf = text => (text || '').split('\n')[0].trim();
export const sameActivity = (item, heading) => (item.activity || '').trim() === (heading || '').trim();

export function renameActivity(media, from, to) {
  const source = (from || '').trim();
  if (!source || source === (to || '').trim()) return media;
  return media.map(item => sameActivity(item, source) ? { ...item, activity: to.trim() } : item);
}

export function mediaPayload(media) {
  return media.map(item => item.id
    ? { id: item.id, title: item.title, activity: item.activity || '' }
    : { url: item.url, origin: item.origin === 'suggested' ? 'suggested' : 'link', title: item.title, activity: item.activity || '', credit: item.credit || '', source_page: item.source_page || '' });
}

export function unassignedMedia(media, headings) {
  const known = new Set(headings.map(heading => heading.trim()).filter(Boolean));
  return media.filter(item => !(item.activity || '').trim() || !known.has(item.activity.trim()));
}

export const formatSize = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

let keyCounter = 0;
export const newKey = () => `new-${++keyCounter}`;
export const mediaKey = item => item.id ?? item.clientKey;
export const originLabel = item => item.origin === 'upload' ? 'Uploaded file' : item.origin === 'suggested' ? 'Suggested by CoachLab · link checked' : 'Your link · checked';
export const safeLink = value => typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;

export function groupMedia(media, blocks) {
  const headings = blocks.map(headingOf);
  const byBlock = new Map();
  const rest = [];
  for (const item of media) {
    const index = (item.activity || '').trim() ? headings.findIndex(heading => heading && sameActivity(item, heading)) : -1;
    if (index < 0) rest.push(item);
    else byBlock.set(index, [...(byBlock.get(index) || []), item]);
  }
  return { byBlock, rest };
}

export async function uploadFile(file) {
  const response = await fetch('/api/media/upload', { method: 'POST', headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
  const data = await response.json().catch(() => ({}));
  if (response.status !== 201) throw new Error(data.error || 'The upload failed. Check the connection and try again.');
  return data;
}

export async function checkLink(url) {
  const response = await fetch('/api/media/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The link could not be checked.');
  return data;
}

export const discardUpload = item => item.pending && item.id ? fetch(`/api/media/${item.id}`, { method: 'DELETE' }).catch(() => {}) : undefined;
