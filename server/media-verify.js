// Checks public HTTPS media safely so a supplied URL cannot reach private server addresses.
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { sniffMedia } from './media-sniff.js';
import { youtubeId, mediaLimits } from '../client/src/media.js';

export class MediaLinkError extends Error {}

// Rejects private and reserved addresses so media URLs cannot probe internal services.
export function isPublicAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !(lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith('ff'));
  }
  return false;
}

// Checks every resolved address before allowing the outbound connection.
export function publicLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    // Reject the whole DNS answer if any resolved address could point into a private network.
    if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) return callback(new MediaLinkError('The link points to a private or unsupported network address.'));
    const wantsAll = options && options.all;
    return wantsAll ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family);
  });
}

// Bounds each HTTPS response and converts network failures to safe link errors.
function requestOnce(url, { method, headers, maxBytes, timeout, lookup }) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method, headers, lookup, timeout, agent: false }, response => {
      const chunks = [];
      let bytes = 0;
      let truncated = false;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (bytes - maxBytes))));
          truncated = true;
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      // Completes the bounded response with collected bytes, even after a truncated stream closes.
      const finish = () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks), truncated });
      response.on('end', finish);
      response.on('close', finish);
      response.on('error', () => finish());
    });
    request.on('timeout', () => request.destroy(new MediaLinkError('The website took too long to answer.')));
    request.on('error', error => reject(error instanceof MediaLinkError ? error : new MediaLinkError('The website could not be reached.')));
    request.end();
  });
}

// Rechecks every redirect and permits only public standard HTTPS destinations.
export async function safeFetch(value, { method = 'GET', headers = {}, maxBytes = 65536, timeout = 8000, lookup = publicLookup, request = requestOnce } = {}) {
  let url;
  // Follow only a few redirects and repeat the destination checks at every hop.
  for (let hop = 0; hop < 4; hop++) {
    try { url = new URL(hop === 0 ? value : url.location); } catch { throw new MediaLinkError('That is not a valid web address.'); }
    if (url.protocol !== 'https:') throw new MediaLinkError('Links must start with https:// so they stay private and secure.');
    if (url.port && url.port !== '443') throw new MediaLinkError('Only standard secure web addresses are allowed.');
    if (url.username || url.password) throw new MediaLinkError('Links containing a user name or password are not allowed.');
    const result = await request(url, { method, headers: { 'user-agent': 'CoachLab-link-check/1.0', ...headers }, maxBytes, timeout, lookup });
    if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location) {
      url = { location: new URL(result.headers.location, url).href };
      continue;
    }
    return { ...result, url: url.href };
  }
  throw new MediaLinkError('The link redirects too many times.');
}

// Bounds publisher-supplied titles before they reach the UI.
const cleanTitle = text => String(text || '').replace(/\s+/g, ' ').trim().slice(0, mediaLimits.title);

// Uses YouTube oEmbed or real file bytes; a plausible-looking URL alone is not proof.
export async function verifyLink(input, { fetcher = safeFetch } = {}) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new MediaLinkError('Paste a link first.');
  if (raw.length > mediaLimits.url) throw new MediaLinkError('That link is too long.');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new MediaLinkError('That is not a valid web address.'); }
  const id = youtubeId(raw);
  if (id) {
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const result = await fetcher(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { maxBytes: 32768 });
    if (result.status === 404 || result.status === 400) throw new MediaLinkError('YouTube says this video does not exist or is private.');
    if (result.status === 401 || result.status === 403) throw new MediaLinkError('The owner of this YouTube video does not allow embedding. Choose another video.');
    if (result.status !== 200) throw new MediaLinkError('YouTube could not confirm this video right now. Try again later.');
    let info;
    try { info = JSON.parse(result.body.toString('utf8')); } catch { throw new MediaLinkError('YouTube returned an unreadable answer.'); }
    return { kind: 'youtube', url: watch, title: cleanTitle(info.title), credit: cleanTitle(info.author_name ? `YouTube — ${info.author_name}` : 'YouTube'), source_page: watch };
  }
  if (parsed.protocol !== 'https:') throw new MediaLinkError('Links must start with https:// so they stay private and secure.');
  const result = await fetcher(raw, { headers: { range: 'bytes=0-65535', accept: 'image/*,video/*;q=0.9' }, maxBytes: 65536 });
  if (![200, 206].includes(result.status)) throw new MediaLinkError(`The website answered with status ${result.status}, so the link cannot be used.`);
  const detected = sniffMedia(result.body);
  const declared = String(result.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!detected) {
    if (declared.startsWith('text/html')) throw new MediaLinkError('This link opens a web page, not a picture or video. Paste the direct picture address or a YouTube link.');
    throw new MediaLinkError('This link is not a supported picture (PNG, JPEG, GIF, WebP) or video (MP4, WebM).');
  }
  const total = Number(String(result.headers['content-range'] || '').split('/')[1] || result.headers['content-length'] || 0);
  if (total > mediaLimits[detected.kind] * 4) throw new MediaLinkError('That file is very large. Use a smaller file or a YouTube link.');
  const name = decodeURIComponent(parsed.pathname.split('/').pop() || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ');
  return { kind: detected.kind, url: raw, title: cleanTitle(name), credit: '', source_page: '' };
}
