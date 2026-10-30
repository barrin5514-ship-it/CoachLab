// Supplies the checked direct production connection only to the deployment migration command.
import { defineConfig } from 'prisma/config';
import { productionDatabaseSettings } from './server/production-database.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: productionDatabaseSettings().direct },
});
