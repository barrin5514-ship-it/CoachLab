// Email sending stays behind this small interface so a real provider can be added later without touching the login code.
// Until a provider is configured, messages are printed to the backend console (local development only) and never leave this computer.

export function consoleMailer(log = console.log) {
  return {
    mode: 'console',
    async sendPasswordReset({ to, url }) {
      log(`[CoachLab mail — local only] Password reset requested for ${to}. Open this link within one hour: ${url}`);
    },
    async sendExistingAccountNotice({ to }) {
      log(`[CoachLab mail — local only] Someone tried to create a new account with ${to}, which already has one. Nothing was changed.`);
    },
  };
}

export function memoryMailer() {
  const outbox = [];
  return {
    mode: 'memory',
    outbox,
    async sendPasswordReset({ to, url }) { outbox.push({ kind: 'reset', to, url }); },
    async sendExistingAccountNotice({ to }) { outbox.push({ kind: 'existing', to }); },
  };
}
