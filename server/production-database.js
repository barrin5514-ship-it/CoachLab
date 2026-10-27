export function productionDatabaseSettings(env = process.env) {
  if (env.NODE_ENV !== 'production' || env.COACHLAB_DB_ENV !== 'production') throw new Error('Explicit production database environment required.');
  if (env.COACHLAB_DATABASE && env.COACHLAB_DATABASE !== 'postgresql') throw new Error('Production requires PostgreSQL.');
  let pooled;
  let direct;
  try { pooled = new URL(env.DATABASE_URL); direct = new URL(env.DIRECT_URL); } catch { throw new Error('Production database configuration is missing or invalid.'); }
  for (const url of [pooled, direct]) {
    if (url.protocol !== 'postgresql:' || !url.hostname.endsWith('.neon.tech') || !url.username || !url.password || url.hash) throw new Error('Authenticated Neon PostgreSQL connections required.');
    if (!['require', 'verify-full'].includes(url.searchParams.get('sslmode')) || [...url.searchParams.keys()].some(key => !['sslmode', 'channel_binding'].includes(key))) throw new Error('Production database requires verified TLS and supported connection options.');
  }
  if (!pooled.hostname.includes('-pooler.') || direct.hostname.includes('-pooler.')) throw new Error('Use pooled application and direct migration connections.');
  if (pooled.hostname.replace('-pooler.', '.') !== direct.hostname || pooled.pathname !== direct.pathname || pooled.username !== direct.username || pooled.password !== direct.password || pooled.port !== direct.port) throw new Error('Production connections must target the same database and role.');
  if (direct.hostname !== env.PRODUCTION_DB_HOST || decodeURIComponent(direct.pathname.slice(1)) !== env.PRODUCTION_DB_NAME) throw new Error('Production target does not match the expected host and database.');
  if (env.COACHLAB_DEV_EXPECTED_HOST?.replace('-pooler.', '.') === direct.hostname) throw new Error('Production must not use the configured development endpoint.');
  direct.searchParams.set('sslmode', 'verify-full');
  pooled.search = '';
  return { pooled: pooled.href, direct: direct.href };
}
