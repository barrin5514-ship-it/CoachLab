import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { productionDatabaseSettings } from './production-database.js';
import { StartupCheckError, prismaFailureReason } from './startup-errors.js';

export function deployMigrations(env = process.env, run = spawnSync) {
  productionDatabaseSettings(env);
  const cli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
  const config = fileURLToPath(new URL('../prisma.production.config.js', import.meta.url));
  const result = run(process.execPath, [cli, 'migrate', 'deploy', '--config', config], { env, stdio: 'pipe', timeout: 300000, maxBuffer: 1048576 });
  if (result.error?.code === 'ETIMEDOUT') throw new StartupCheckError('prisma migrate deploy exceeded the five-minute startup timeout.');
  if (result.error) throw new StartupCheckError('prisma migrate deploy could not execute or exceeded the captured output limit.');
  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    const code = output.match(/\bP\d{4}\b/)?.[0];
    throw new StartupCheckError(`prisma migrate deploy failed. ${prismaFailureReason(code)}`);
  }
  console.log('Production migrations completed.');
}
