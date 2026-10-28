import { deployMigrations } from './deploy-migrations.js';
import { productionSecuritySettings } from './production-security.js';
import { listenerSettings } from './web.js';
import { StartupCheckError, startupFailure } from './startup-errors.js';

export async function startProduction(env = process.env, migrate = deployMigrations, start = () => import('./index.js')) {
  env.NODE_ENV = 'production';
  let stage = 'APP_URL and BETTER_AUTH_SECRET validation';
  try {
    productionSecuritySettings(env);
    stage = 'PORT validation';
    listenerSettings(env);
    stage = 'database configuration and prisma migrate deploy';
    await migrate(env);
    stage = 'application module loading';
    await start();
  } catch (error) {
    throw new StartupCheckError(startupFailure(stage, error));
  }
}
