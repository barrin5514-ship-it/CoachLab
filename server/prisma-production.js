import { PrismaClient } from './generated-runtime/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { productionDatabaseSettings } from './production-database.js';

export function createProductionClient(env = process.env) {
  const { pooled } = productionDatabaseSettings(env);
  const adapter = new PrismaPg({ connectionString: pooled, ssl: { rejectUnauthorized: true }, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, statement_timeout: 15000 });
  return new PrismaClient({ adapter });
}
