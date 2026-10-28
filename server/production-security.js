import { StartupCheckError } from './startup-errors.js';
export function productionSecuritySettings(env = process.env) {
  let url;
  try { url = new URL(env.APP_URL); } catch { throw new StartupCheckError('APP_URL must be the public HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || ['localhost', '127.0.0.1'].includes(url.hostname)) throw new StartupCheckError('APP_URL must be the public HTTPS origin.');
  if (typeof env.BETTER_AUTH_SECRET !== 'string' || env.BETTER_AUTH_SECRET.length < 32) throw new StartupCheckError('BETTER_AUTH_SECRET must contain at least 32 characters.');
  return { publicUrl: url.origin, allowedOrigins: [url.origin] };
}
