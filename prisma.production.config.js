import { defineConfig } from 'prisma/config';
import { productionDatabaseSettings } from './server/production-database.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: productionDatabaseSettings().direct },
});
