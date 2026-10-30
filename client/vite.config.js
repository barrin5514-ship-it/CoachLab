// Configures the development browser server and the production React build.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { apiProxy } from './api-proxy.js';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [apiProxy(3001)],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
