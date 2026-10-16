// Test-only helpers. The real application always uses server/auth.js (Better Auth); these fakes let the older lesson and media tests run as a signed-in coach without a login round trip.
export const TEST_ORIGIN = 'http://coachlab.test';
export const testUsers = {
  'user-a': { id: 'user-a', email: 'a@example.com', name: 'Coach A' },
  'user-b': { id: 'user-b', email: 'b@example.com', name: 'Coach B' },
};

export const testAuth = {
  google: false,
  mailMode: 'memory',
  async getUser(request) {
    const requested = request.headers['x-test-user'];
    if (requested === 'anonymous') return null;
    return testUsers[requested || 'user-a'] ?? null;
  },
};

export const testOptions = { auth: testAuth, allowedOrigins: [TEST_ORIGIN] };

export function authedFetch(url, options = {}) {
  return globalThis.fetch(url, { ...options, headers: { origin: TEST_ORIGIN, ...options.headers } });
}

// A tiny browser stand-in: it remembers cookies, sends the Origin header and returns parsed JSON.
export function cookieClient(base, origin = TEST_ORIGIN) {
  return (ip = '203.0.113.10') => {
    const jar = new Map();
    const api = async (path, { method = 'GET', body, headers = {}, origin: sent = origin, raw, redirect } = {}) => {
      const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
      const response = await globalThis.fetch(base + path, { method, redirect, headers: { 'x-forwarded-for': ip, ...(sent ? { origin: sent } : {}), ...(cookie ? { cookie } : {}), ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}), ...headers }, body: raw ? body : body === undefined ? undefined : JSON.stringify(body) });
      for (const line of response.headers.getSetCookie()) {
        const [pair, ...attributes] = line.split(';');
        const [name, ...value] = pair.split('=');
        if (attributes.some(attribute => /^\s*max-age=0/i.test(attribute)) || value.join('=') === '') jar.delete(name); else jar.set(name, value.join('='));
      }
      const text = await response.text();
      let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: response.status, json, text, headers: response.headers, setCookie: response.headers.getSetCookie() };
    };
    api.jar = jar;
    return api;
  };
}
