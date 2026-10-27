import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { passwordProblem, validateEmail, validateName } from '../client/src/password-policy.js';

const generic = 'Invalid email or password';
const tooMany = 'Too many sign-in attempts. Wait a few minutes and try again, or reset your password.';

export function attemptLimiter({ max, windowMs, now = Date.now }) {
  const entries = new Map();
  const fresh = key => {
    const list = (entries.get(key) || []).filter(time => now() - time < windowMs);
    if (list.length) entries.set(key, list); else entries.delete(key);
    return list;
  };
  return {
    blocked: key => fresh(key).length >= max,
    hit: key => { const list = fresh(key); list.push(now()); entries.set(key, list); },
    clear: key => entries.delete(key),
  };
}

const normalize = email => String(email ?? '').trim().toLowerCase();

export function createAuth({ database, prisma, secret, baseURL, trustedOrigins, mailer, env = {}, loginLimiter = attemptLimiter({ max: 8, windowMs: 15 * 60 * 1000 }), resetLimiter = attemptLimiter({ max: 3, windowMs: 60 * 60 * 1000 }) }) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('A random authentication secret of at least 32 characters is required.');
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : null;
  const sqlite = !prisma;
  const auth = betterAuth({
    database: prisma ? prismaAdapter(prisma, { provider: 'postgresql' }) : database,
    secret,
    baseURL,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const key = normalize(user.email);
        if (resetLimiter.blocked(key)) return;
        resetLimiter.hit(key);
        await mailer.sendPasswordReset({ to: user.email, url });
      },
      onExistingUserSignUp: async ({ user }) => { await mailer.sendExistingAccountNotice({ to: user.email }); },
    },
    socialProviders: google ? { google } : undefined,
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      cookiePrefix: 'coachlab',
      useSecureCookies: env.NODE_ENV === 'production' || baseURL.startsWith('https://'),
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 300, max: 10 },
        '/sign-up/email': { window: 3600, max: 10 },
        '/request-password-reset': { window: 3600, max: 5 },
        '/reset-password': { window: 900, max: 10 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async context => {
        const body = context.body ?? {};
        if (context.path === '/sign-up/email') {
          const problem = validateName(body.name) || validateEmail(body.email) || passwordProblem(body.password, body.email);
          if (problem) throw new APIError('BAD_REQUEST', { message: problem, code: 'INVALID_REGISTRATION' });
        }
        if (context.path === '/reset-password') {
          const problem = passwordProblem(body.newPassword);
          if (problem) throw new APIError('BAD_REQUEST', { message: problem, code: 'WEAK_PASSWORD' });
        }
        if (context.path === '/sign-in/email') {
          const problem = validateEmail(body.email);
          if (problem || typeof body.password !== 'string') throw new APIError('UNAUTHORIZED', { message: generic, code: 'INVALID_EMAIL_OR_PASSWORD' });
          if (loginLimiter.blocked(normalize(body.email))) throw new APIError('TOO_MANY_REQUESTS', { message: tooMany, code: 'TOO_MANY_ATTEMPTS' });
        }
      }),
      after: createAuthMiddleware(async context => {
        if (context.path !== '/sign-in/email') return;
        const key = normalize(context.body?.email);
        if (context.context.returned instanceof APIError) { if (context.context.returned.statusCode === 401) loginLimiter.hit(key); } else loginLimiter.clear(key);
      }),
    },
  });
  return {
    auth,
    google: !!google,
    mailMode: mailer.mode,
    handler: toNodeHandler(auth),
    async getUser(request) {
      const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      return result?.user ? { id: result.user.id, email: result.user.email, name: result.user.name } : null;
    },
    async prepare() {
      if (!sqlite) return;
      const { runMigrations } = await getMigrations(auth.options);
      await runMigrations();
    },
  };
}
