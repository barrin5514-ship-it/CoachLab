export const passwordLimits = { min: 10, max: 128 };

const common = new Set(['password', 'password1', 'password123', 'passw0rd', 'qwertyuiop', 'qwerty123', 'qwertyuiop1', '1234567890', '12345678910', '0123456789', 'iloveyou12', 'letmein123', 'welcome123', 'admin12345', 'changeme123', 'coachlab123', 'trustno1234', 'abc1234567', 'football123', 'baseball123']);

export function passwordProblem(password, email = '') {
  if (typeof password !== 'string') return 'Enter a password.';
  if (password.length < passwordLimits.min) return `Use at least ${passwordLimits.min} characters.`;
  if (password.length > passwordLimits.max) return `Use at most ${passwordLimits.max} characters.`;
  if (common.has(password.toLowerCase())) return 'That password is too common. Choose something harder to guess.';
  if (/^(.)\1+$/.test(password) || /^\d+$/.test(password)) return 'Use a mix of characters, not just one repeated character or only digits.';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) return 'Do not include your email name in your password.';
  return null;
}

export function validateName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'Enter your name.';
  if (name.trim().length > 80) return 'Use at most 80 characters for your name.';
  if (/[<>\u0000-\u001f]/.test(name)) return 'Your name cannot contain angle brackets or control characters.';
  return null;
}

export function validateEmail(email) {
  if (typeof email !== 'string' || !email.trim()) return 'Enter your email address.';
  const value = email.trim();
  if (value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(value)) return 'Enter a valid email address, for example name@example.com.';
  return null;
}
