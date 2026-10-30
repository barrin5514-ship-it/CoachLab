// Wraps browser authentication requests and turns safe server failures into useful messages.
const json = { 'Content-Type': 'application/json' };
export const networkMessage = 'Could not reach CoachLab. Check your connection and try again.';

// Uses known safe error codes instead of exposing raw authentication errors.
export function friendlyAuthError(status, data) {
  const code = data?.code;
  if (code === 'PASSWORD_RESET_DISABLED') return 'Contact the coach to reset your password.';
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || status === 401) return 'Incorrect email or password.';
  if (code === 'TOO_MANY_ATTEMPTS') return data.message;
  if (status === 429) return 'Too many attempts from this device. Wait a few minutes and try again.';
  if (code === 'INVALID_TOKEN') return 'This reset link is invalid or has expired. Request a new one.';
  if (['INVALID_REGISTRATION', 'WEAK_PASSWORD', 'PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG'].includes(code) && data.message) return data.message;
  if (status === 403) return 'This request was blocked for your safety. Reload the page and try again.';
  return 'Something went wrong. Please try again.';
}

// Sends authentication requests to this app and maps failures to safe messages.
async function call(path, { method = 'POST', body } = {}) {
  let response;
  try {
    response = await fetch(`/api/auth${path}`, { method, headers: body === undefined ? undefined : json, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error(networkMessage);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(friendlyAuthError(response.status, data));
  return data;
}

// Reads public feature flags only; failed configuration hides optional login features.
export async function getAuthConfig() {
  try {
    const response = await fetch('/api/auth-config');
    const data = await response.json();
    return { google: data.google === true, mail: data.mail, passwordReset: data.passwordReset === true };
  } catch {
    return { google: false, mail: 'unknown', passwordReset: false };
  }
}

// Keeps only the user details the browser needs to show the signed-in view.
export async function getSession() {
  const data = await call('/get-session', { method: 'GET' });
  return data?.user ? { id: data.user.id, name: data.user.name, email: data.user.email } : null;
}

// Submits registration to the server, which owns password handling.
export const signUp = ({ name, email, password }) => call('/sign-up/email', { body: { name: name.trim(), email: email.trim(), password } });
// Asks the server to create a session rather than storing credentials in the browser.
export const signIn = ({ email, password }) => call('/sign-in/email', { body: { email: email.trim(), password } });
// Asks the server to end the current session.
export const signOut = () => call('/sign-out', { body: {} });
// Requests a reset only through the existing authentication API.
export const requestReset = email => call('/request-password-reset', { body: { email: email.trim(), redirectTo: '/reset-password' } });
// Submits the one-use token and new password to the server.
export const resetPassword = ({ token, newPassword }) => call('/reset-password', { body: { token, newPassword } });

// Redirects only to the expected Google login host.
export async function startGoogleSignIn() {
  const data = await call('/sign-in/social', { body: { provider: 'google', callbackURL: '/' } });
  if (typeof data?.url !== 'string' || !data.url.startsWith('https://accounts.google.com/')) throw new Error('Google sign-in is not available right now.');
  window.location.assign(data.url);
}

// Returns to sign-in when protected app requests report an expired session.
export function installUnauthorizedHandler(handler) {
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const response = await original(input, init);
    const address = typeof input === 'string' ? input : input?.url ?? '';
    if (response.status === 401 && address.startsWith('/api/') && !address.startsWith('/api/auth')) handler();
    return response;
  };
  return () => { window.fetch = original; };
}
