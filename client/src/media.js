// Shares attachment limits, IDs and editing helpers between forms and server checks.
export const mediaLimits = { image: 6 * 1024 * 1024, video: 20 * 1024 * 1024, perLesson: 12, title: 120, activity: 200, url: 2000 };
export const uploadTypes = { 'image/png': 'image', 'image/jpeg': 'image', 'image/gif': 'image', 'image/webp': 'image', 'video/mp4': 'video', 'video/webm': 'video' };

// Extracts a valid YouTube ID so different URL styles count as the same video.
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

// Uses the protected file route for uploads instead of exposing stored bytes directly.
export const attachmentSrc = item => item.origin === 'upload' ? `/api/media/${item.id}/file` : item.url;
// Uses the first line as the activity heading shared by media and editing.
export const headingOf = text => (text || '').split('\n')[0].trim();
// Compares trimmed headings so harmless spacing does not detach media.
export const sameActivity = (item, heading) => (item.activity || '').trim() === (heading || '').trim();

// Moves attachment labels with a renamed activity rather than losing the association.
export function renameActivity(media, from, to) {
  const source = (from || '').trim();
  if (!source || source === (to || '').trim()) return media;
  return media.map(item => sameActivity(item, source) ? { ...item, activity: to.trim() } : item);
}

// Sends only supported attachment fields, using saved IDs when available.
export function mediaPayload(media) {
  return media.map(item => item.id
    ? { id: item.id, title: item.title, activity: item.activity || '' }
    : { url: item.url, origin: item.origin === 'suggested' ? 'suggested' : 'link', title: item.title, activity: item.activity || '', credit: item.credit || '', source_page: item.source_page || '' });
}

// Keeps media visible even when its old activity heading has been removed.
export function unassignedMedia(media, headings) {
  const known = new Set(headings.map(heading => heading.trim()).filter(Boolean));
  return media.filter(item => !(item.activity || '').trim() || !known.has(item.activity.trim()));
}

// Turns byte limits into readable sizes for the coach.
export const formatSize = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

let keyCounter = 0;
// Gives unsaved attachments stable temporary keys until the server assigns an ID.
export const newKey = () => `new-${++keyCounter}`;
// Prefers a saved ID but still supports attachments that exist only in the editor.
export const mediaKey = item => item.id ?? item.clientKey;
// Copies attachments, skips duplicate video IDs and enforces the shared limit.
export function withApprovedVideo(media, video) {
  if (!video || media.some(item => youtubeId(item.url) === youtubeId(video.url))) return [...media];
  if (media.length >= mediaLimits.perLesson) throw new Error('This lesson already has the maximum number of attachments. Remove one in Edit lesson first.');
  return [...media, { ...video, activity: '', origin: 'suggested' }];
}
// Adds a reviewed batch atomically in memory; duplicates and unverified links do not get added.
export function withApprovedVideos(media, videos = []) {
  return videos.reduce((result, video) => video.link_only ? result : withApprovedVideo(result, video), [...media]);
}
// Explains where the attachment came from so the coach can judge its source.
export const originLabel = item => item.origin === 'upload' ? 'Uploaded file' : item.origin === 'suggested' ? 'Suggested by CoachLab · link checked' : 'Your link · checked';
// Allows only HTTPS source links for clickable external references.
export const safeLink = value => typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;

// Places media under the first matching activity and keeps unmatched items visible.
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

// Sends file bytes to the server for independent type and size checks.
export async function uploadFile(file) {
  const response = await fetch('/api/media/upload', { method: 'POST', headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
  const data = await response.json().catch(() => ({}));
  if (response.status !== 201) throw new Error(data.error || 'The upload failed. Check the connection and try again.');
  return data;
}

// Requests server-side link verification before trusting a pasted address.
export async function checkLink(url) {
  const response = await fetch('/api/media/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The link could not be checked.');
  return data;
}

// Cleans up only temporary uploads, not media already attached to a lesson.
export const discardUpload = item => item.pending && item.id ? fetch(`/api/media/${item.id}`, { method: 'DELETE' }).catch(() => {}) : undefined;

// Fetches fresh attachment metadata so edits start from the saved state.
export async function fetchMedia(signal) {
  const response = await fetch('/api/lesson-media', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load media.');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected media response.');
  return data;
}
