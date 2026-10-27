export function productionSecuritySettings(env = process.env) {
  let url;
  try { url = new URL(env.APP_URL); } catch { throw new Error('APP_URL must be the public HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || ['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('APP_URL must be the public HTTPS origin.');
  if (typeof env.BETTER_AUTH_SECRET !== 'string' || env.BETTER_AUTH_SECRET.length < 32) throw new Error('A production authentication secret of at least 32 characters is required.');
  return { publicUrl: url.origin, allowedOrigins: [url.origin] };
}
