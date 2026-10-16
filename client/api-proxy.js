import http from 'node:http';

// Vite's built-in proxy stalls on downloads over about 1 MB, so /api is forwarded with plain piped streams instead.
export function apiProxy(port) {
  return {
    name: 'coachlab-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api', (request, response) => {
        const upstream = http.request({ host: '127.0.0.1', port, method: request.method, path: request.originalUrl, headers: { ...request.headers, host: `127.0.0.1:${port}`, 'x-forwarded-for': request.socket.remoteAddress } }, answer => {
          response.writeHead(answer.statusCode, answer.headers);
          answer.pipe(response);
        });
        upstream.on('error', () => {
          if (response.headersSent) return response.destroy();
          response.writeHead(502, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'The CoachLab backend is not reachable.' }));
        });
        response.on('close', () => upstream.destroy());
        request.pipe(upstream);
      });
    },
  };
}
