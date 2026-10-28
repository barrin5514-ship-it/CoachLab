import { StartupCheckError } from './startup-errors.js';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export function listenerSettings(env = process.env) {
  if (env.NODE_ENV !== 'production') return { port: 3001, host: '127.0.0.1' };
  const port = Number(env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new StartupCheckError('Invalid production PORT.');
  return { port, host: '0.0.0.0' };
}

export function serveFrontend(app, directory = fileURLToPath(new URL('../client/dist/', import.meta.url))) {
  const index = join(directory, 'index.html');
  if (!existsSync(index)) throw new StartupCheckError('Build the React application before starting production.');
  app.use('/api', (request, response) => response.status(404).json({ error: 'Route not found.' }));
  app.use(express.static(directory, { index: false }));
  app.get('/{*path}', (request, response, next) => {
    if (request.path.startsWith('/assets/') || !request.accepts('html')) return next();
    response.set('Cache-Control', 'no-cache').sendFile(index);
  });
}
