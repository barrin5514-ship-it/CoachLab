export function productionApiGuard({ now = Date.now, limit = 120, maxClients = 1024 } = {}) {
  const clients = new Map();
  const windowMs = 60000;
  return (request, response, next) => {
    if (request.method === 'GET' && request.path === '/health') return next();
    const time = now();
    for (const [key, entry] of clients) if (entry.until <= time) clients.delete(key);
    const key = request.ip || request.socket.remoteAddress;
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= maxClients) return response.set('Retry-After', '60').status(503).json({ error: 'The server is busy. Please try again shortly.' });
      entry = { count: 0, until: time + windowMs };
      clients.set(key, entry);
    }
    entry.count++;
    if (entry.count > limit) return response.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - time) / 1000)))).status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    const encoding = String(request.headers['content-encoding'] || 'identity').trim().toLowerCase();
    if (encoding !== 'identity') return response.status(415).json({ error: 'Compressed request bodies are not supported. Send an uncompressed request.' });
    next();
  };
}
