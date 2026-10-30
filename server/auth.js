// Configures server-side sessions, password checks and sign-in protections.
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { passwordProblem, validateEmail, validateName } from '../client/src/password-policy.js';

const generic = 'Invalid email or password';
const tooMany = 'Too many sign-in attempts. Wait a few minutes and try again, or reset your password.';

// Tracks recent attempts so repeated sign-in failures can be slowed down.
export function attemptLimiter({ max, windowMs, now = Date.now }) {
  const entries = new Map();
  // Expires old attempts rather than keeping a permanent block.
  const fresh = key => {
    const list = (entries.get(key) || []).filter(time => now() - time < windowMs);
    if (list.length) entries.set(key, list); else entries.delete(key);
    return list;
  };
  return {
    // Checks whether recent attempts have reached the limit.
    blocked: key => fresh(key).length >= max,
    // Records an attempt before later requests can reuse the same allowance.
    hit: key => { const list = fresh(key); list.push(now()); entries.set(key, list); },
    // Removes the attempt history after a successful login.
    clear: key => entries.delete(key),
  };
}

// Normalizes email case and spacing so equivalent logins share one limit.
const normalize = email => String(email ?? '').trim().toLowerCase();

// Delegates password and session storage to Better Auth while applying app safety rules.
export function createAuth({ database, prisma, secret, baseURL, trustedOrigins, mailer, env = {}, loginLimiter = attemptLimiter({ max: 8, windowMs: 15 * 60 * 1000 }), resetLimiter = attemptLimiter({ max: 3, windowMs: 60 * 60 * 1000 }) }) {
  const passwordResetEnabled = env.NODE_ENV !== 'production';
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
      // Keeps reset delivery disabled in production and limits development reset attempts.
      sendResetPassword: async ({ user, url }) => {
        // Block the endpoint too, not just the browser link, while production reset mail is unavailable.
        if (!passwordResetEnabled) return;
        const key = normalize(user.email);
        if (resetLimiter.blocked(key)) return;
        resetLimiter.hit(key);
        await mailer.sendPasswordReset({ to: user.email, url });
      },
      // Uses a notice instead of replacing an existing account password.
      onExistingUserSignUp: async ({ user }) => { if (passwordResetEnabled) await mailer.sendExistingAccountNotice({ to: user.email }); },
    },
    socialProviders: google ? { google } : undefined,
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      cookiePrefix: 'coachlab',
      // HTTPS-only production cookies keep the login session off unencrypted connections.
      useSecureCookies: env.NODE_ENV === 'production' || baseURL.startsWith('https://'),
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    rateLimit: {
      enabled: true,
      // Better Auth stores its rate-limit records in the database; extra app limiters have separate in-memory counters.
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
        // Block the endpoint too, not just the browser link, while production reset mail is unavailable.
        if (!passwordResetEnabled && /^\/(request-password-reset|reset-password)(\/|$)/.test(context.path)) throw new APIError('FORBIDDEN', { message: 'Contact the coach to reset your password.', code: 'PASSWORD_RESET_DISABLED' });
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
          if (loginLimiter.blocked(normalize(body.email))) throw new APIError('TOO_MANY_REQUESTS', { message: passwordResetEnabled ? tooMany : 'Too many sign-in attempts. Wait 15 minutes or contact the coach.', code: 'TOO_MANY_ATTEMPTS' });
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
    passwordResetEnabled,
    google: !!google,
    mailMode: passwordResetEnabled ? mailer.mode : 'disabled',
    handler: toNodeHandler(auth),
    // Reads the session cookie and returns only the user identity needed for ownership checks.
    async getUser(request) {
      const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      return result?.user ? { id: result.user.id, email: result.user.email, name: result.user.name } : null;
    },
    // Creates auth tables only for local SQLite; PostgreSQL uses versioned deployment migrations.
    async prepare() {
      if (!sqlite) return;
      const { runMigrations } = await getMigrations(auth.options);
      await runMigrations();
    },
  };
}
