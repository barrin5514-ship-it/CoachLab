// Creates a TLS-verified production pool after the production target checks pass.
import { PrismaClient } from './generated-runtime/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { productionDatabaseSettings } from './production-database.js';

// Uses validated production settings with a limited TLS-verified connection pool.
export function createProductionClient(env = process.env) {
  const { pooled } = productionDatabaseSettings(env);
  // Keep pool size and query waits bounded for this small hosted service.
  const adapter = new PrismaPg({ connectionString: pooled, ssl: { rejectUnauthorized: true }, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, statement_timeout: 15000 });
  return new PrismaClient({ adapter });
}
