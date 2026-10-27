import { deployMigrations } from './deploy-migrations.js';
import { productionSecuritySettings } from './production-security.js';
import { listenerSettings } from './web.js';

process.env.NODE_ENV = 'production';
try {
  productionSecuritySettings();
  listenerSettings();
  deployMigrations();
  await import('./index.js');
} catch {
  console.error('Production startup stopped. Verify production settings and migration status securely. No development fallback was attempted.');
  process.exitCode = 1;
}
