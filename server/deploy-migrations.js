import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { productionDatabaseSettings } from './production-database.js';

export function deployMigrations(env = process.env, run = spawnSync) {
  productionDatabaseSettings(env);
  const cli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
  const config = fileURLToPath(new URL('../prisma.production.config.js', import.meta.url));
  const result = run(process.execPath, [cli, 'migrate', 'deploy', '--config', config], { env, stdio: 'pipe', timeout: 300000, maxBuffer: 1048576 });
  if (result.error || result.status !== 0) throw new Error('Production migration did not complete. Startup stopped; inspect migration status securely before retrying.');
  console.log('Production migrations completed.');
}
