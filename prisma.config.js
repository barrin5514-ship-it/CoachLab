// Keeps routine Prisma generation and validation offline; it does not choose a live database.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
});
