// Provides development and test mail substitutes; production password reset stays disabled.
// Email sending stays behind this small interface so a real provider can be added later without touching the login code.
// Until a provider is configured, messages are printed to the backend console (local development only) and never leave this computer.

// Provides local reset guidance without connecting to an email provider.
export function consoleMailer(log = console.log) {
  return {
    mode: 'console',
    // Delivers the reset notice through this selected development or test mail substitute.
    async sendPasswordReset({ to, url }) {
      log(`[CoachLab mail — local only] Password reset requested for ${to}. Open this link within one hour: ${url}`);
    },
    // Warns about an existing account without changing its password.
    async sendExistingAccountNotice({ to }) {
      log(`[CoachLab mail — local only] Someone tried to create a new account with ${to}, which already has one. Nothing was changed.`);
    },
  };
}

// Captures mail in a test outbox so tests do not send real email.
export function memoryMailer() {
  const outbox = [];
  return {
    mode: 'memory',
    outbox,
    // Delivers the reset notice through this selected development or test mail substitute.
    async sendPasswordReset({ to, url }) { outbox.push({ kind: 'reset', to, url }); },
    // Warns about an existing account without changing its password.
    async sendExistingAccountNotice({ to }) { outbox.push({ kind: 'existing', to }); },
  };
}
