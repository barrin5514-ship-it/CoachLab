// Launches guarded production startup and reports only safe error details.
import { startProduction } from './production-startup.js';
import { StartupCheckError, startupFailure } from './startup-errors.js';

try {
  await startProduction();
} catch (error) {
  console.error(error instanceof StartupCheckError ? error.message : startupFailure('startup module', error));
  process.exitCode = 1;
}
