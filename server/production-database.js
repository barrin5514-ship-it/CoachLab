import { StartupCheckError } from './startup-errors.js';

export function productionDatabaseSettings(env = process.env) {
  if (env.NODE_ENV !== 'production') throw new StartupCheckError('NODE_ENV must be production.');
  if (env.COACHLAB_DB_ENV !== 'production') throw new StartupCheckError('COACHLAB_DB_ENV must be production.');
  if (env.COACHLAB_DATABASE && env.COACHLAB_DATABASE !== 'postgresql') throw new StartupCheckError('COACHLAB_DATABASE must be unset or postgresql in production.');
  const urls = ['DATABASE_URL', 'DIRECT_URL'].map(name => {
    let url;
    try { url = new URL(env[name]); } catch { throw new StartupCheckError(`${name} is missing or is not a valid URL.`); }
    if (url.protocol !== 'postgresql:') throw new StartupCheckError(`${name} must use the postgresql protocol.`);
    if (!url.hostname.endsWith('.neon.tech')) throw new StartupCheckError(`${name} must use a Neon hostname.`);
    if (!url.username || !url.password) throw new StartupCheckError(`${name} requires a database username and password.`);
    if (url.hash) throw new StartupCheckError(`${name} must not contain a URL fragment.`);
    if (!['require', 'verify-full'].includes(url.searchParams.get('sslmode'))) throw new StartupCheckError(`${name} requires sslmode=require or sslmode=verify-full.`);
    if ([...url.searchParams.keys()].some(key => !['sslmode', 'channel_binding'].includes(key))) throw new StartupCheckError(`${name} contains unsupported query parameters; only sslmode and channel_binding are allowed.`);
    return url;
  });
  const [pooled, direct] = urls;
  if (!pooled.hostname.includes('-pooler.')) throw new StartupCheckError('DATABASE_URL must use a pooled hostname containing -pooler.');
  if (direct.hostname.includes('-pooler.')) throw new StartupCheckError('DIRECT_URL must use a direct hostname without -pooler.');
  for (const field of ['hostname', 'pathname', 'username', 'password', 'port']) {
    const pooledValue = field === 'hostname' ? pooled.hostname.replace('-pooler.', '.') : pooled[field];
    if (pooledValue !== direct[field]) throw new StartupCheckError(`DATABASE_URL and DIRECT_URL do not match on ${field}.`);
  }
  if (direct.hostname !== env.PRODUCTION_DB_HOST) throw new StartupCheckError('PRODUCTION_DB_HOST does not match DIRECT_URL host. Use the direct hostname only.');
  let database;
  try { database = decodeURIComponent(direct.pathname.slice(1)); } catch { throw new StartupCheckError('DIRECT_URL database name has invalid percent encoding.'); }
  if (!database || database.includes('/')) throw new StartupCheckError('DIRECT_URL must contain one database name without a trailing slash.');
  if (database !== env.PRODUCTION_DB_NAME) throw new StartupCheckError('PRODUCTION_DB_NAME does not match DIRECT_URL database name.');
  if (env.COACHLAB_DEV_EXPECTED_HOST?.replace('-pooler.', '.') === direct.hostname) throw new StartupCheckError('Production must not use COACHLAB_DEV_EXPECTED_HOST.');
  direct.searchParams.set('sslmode', 'verify-full');
  pooled.search = '';
  return { pooled: pooled.href, direct: direct.href };
}
