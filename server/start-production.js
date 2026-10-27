import { deployMigrations } from './deploy-migrations.js';

process.env.NODE_ENV = 'production';
try {
  deployMigrations();
  await import('./index.js');
} catch {
  console.error('Production startup stopped. Verify production settings and migration status securely. No development fallback was attempted.');
  process.exitCode = 1;
}
