import { PrismaClient } from './generated-runtime/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

export function createDevelopmentClient(env = process.env, schema = 'public') {
  if (env.COACHLAB_DB_ENV !== 'development') throw new Error('Explicit development environment required.');
  if (schema !== 'public' && !/^coachlab_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsupported database schema.');
  let url;
  try { url = new URL(env.COACHLAB_DEV_DATABASE_URL); } catch { throw new Error('Development database configuration is missing or invalid.'); }
  if (url.protocol !== 'postgresql:' || !url.hostname.endsWith('.neon.tech') || !url.hostname.includes('-pooler.')) throw new Error('A pooled Neon PostgreSQL development connection is required.');
  if (url.hostname !== env.COACHLAB_DEV_EXPECTED_HOST || decodeURIComponent(url.pathname.slice(1)) !== env.COACHLAB_DEV_EXPECTED_DATABASE) throw new Error('Development database does not match the explicit expected target.');
  if (!url.username || !url.password || !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error('Authenticated TLS connection required.');
  if ([...url.searchParams.keys()].some(key => !['sslmode', 'channel_binding'].includes(key))) throw new Error('Unsupported connection options.');
  url.search = '';
  const adapter = new PrismaPg({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, statement_timeout: 15000 }, { schema });
  return new PrismaClient({ adapter });
}
