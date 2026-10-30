// Shows account forms and explains sign-in failures without exposing server details.
import React, { useState } from 'react';
import { getSession, requestReset, resetPassword, signIn, signUp, startGoogleSignIn } from './auth.js';
import { passwordLimits, passwordProblem, validateEmail, validateName } from './password-policy.js';

// Hides passwords by default but lets the owner reveal their own typing.
function PasswordField({ label, value, onChange, autoComplete, hint, disabled }) {
  const [shown, setShown] = useState(false);
  return <div className="password-field">
    <label>{label}
      <input type={shown ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} required maxLength={passwordLimits.max} disabled={disabled} autoCapitalize="none" spellCheck="false" />
    </label>
    {hint && <small>{hint}</small>}
    <label className="check-label show-password"><input type="checkbox" checked={shown} onChange={event => setShown(event.target.checked)} />Show password</label>
  </div>;
}

// Chooses only account actions supported by the server configuration.
export default function AuthScreen({ config, notice, resetToken, resetError, onSignedIn }) {
  const resetEnabled = config.passwordReset === true;
  const [requestedMode, setMode] = useState(resetToken ? 'reset' : resetError ? 'forgot' : 'signin');
  const mode = !resetEnabled && ['forgot', 'reset'].includes(requestedMode) ? 'signin' : requestedMode;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(notice ? { tone: 'success', text: notice } : resetError ? { tone: 'error', text: resetError } : null);
  const [busy, setBusy] = useState(false);

  // Clears the password when changing account forms so it is not reused accidentally.
  function go(next, text, tone = 'success') {
    setMode(next);
    setPassword('');
    setMessage(text ? { tone, text } : null);
  }
  // Keeps account requests from overlapping and shows their safe errors.
  async function run(work) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await work(); } catch (failure) { setMessage({ tone: 'error', text: failure.message }); } finally { setBusy(false); }
  }
  // Prevents browser navigation and runs the selected account action with shared error handling.
  const submit = work => event => { event.preventDefault(); run(work); };

  const login = submit(async () => {
    const problem = validateEmail(email);
    if (problem) throw new Error(problem);
    if (!password) throw new Error('Enter your password.');
    await signIn({ email, password });
    const user = await getSession();
    if (!user) throw new Error('Sign-in did not complete. Please try again.');
    onSignedIn(user);
  });
  const register = submit(async () => {
    const problem = validateName(name) || validateEmail(email) || passwordProblem(password, email);
    if (problem) throw new Error(problem);
    await signUp({ name, email, password });
    go('signin', `Your account request was received. Sign in below. If this email already had an account, its password was not changed. ${resetEnabled ? 'Use your existing password or choose “Forgot password”.' : 'Contact the coach if you cannot sign in.'}`);
  });
  const forgot = submit(async () => {
    if (!resetEnabled) throw new Error('Contact the coach to reset your password.');
    const problem = validateEmail(email);
    if (problem) throw new Error(problem);
    await requestReset(email);
    go('signin', config.mail === 'console' ? 'If that email has an account, a reset link was created. Email is not set up yet in this local copy, so the link is printed in the CoachLab backend window. It works once and expires in one hour.' : 'If that email has an account, we sent a reset link. It works once and expires in one hour.');
  });
  const reset = submit(async () => {
    if (!resetEnabled) throw new Error('Contact the coach to reset your password.');
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    await resetPassword({ token: resetToken, newPassword: password });
    go('signin', 'Your password was changed and every other session was signed out. Sign in with your new password.');
  });

  const heading = { signin: 'Sign in to CoachLab', register: 'Create your coach account', forgot: 'Reset your password', reset: 'Choose a new password' }[mode];
  return <main className="auth-screen">
    <div className="auth-card">
      <p className="eyebrow">PLAN WITH PURPOSE</p>
      <h1>CoachLab</h1>
      <h2>{heading}</h2>
      {message && <p className={message.tone === 'error' ? 'error' : 'success'} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {mode === 'signin' && <form onSubmit={login} noValidate>
        <fieldset disabled={busy}>
          <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" autoFocus required /></label>
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
          <button type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
        </fieldset>
        <p className="auth-links">{resetEnabled ? <button type="button" className="link" onClick={() => go('forgot')}>Forgot password?</button> : 'Contact the coach to reset your password.'}</p>
      </form>}
      {mode === 'register' && <form onSubmit={register} noValidate>
        <fieldset disabled={busy}>
          <label>Your name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={80} required autoFocus /></label>
          <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" required /></label>
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" hint={`At least ${passwordLimits.min} characters. A few random words work well. Avoid common passwords.`} />
          <button type="submit">{busy ? 'Creating account…' : 'Create account'}</button>
        </fieldset>
      </form>}
      {mode === 'forgot' && <form onSubmit={forgot} noValidate>
        <fieldset disabled={busy}>
          <p>Enter your email and we will create a one-time reset link.</p>
          <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" autoFocus required /></label>
          <button type="submit">{busy ? 'Sending…' : 'Send reset link'}</button>
        </fieldset>
      </form>}
      {mode === 'reset' && <form onSubmit={reset} noValidate>
        <fieldset disabled={busy}>
          <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint={`At least ${passwordLimits.min} characters.`} />
          <button type="submit">{busy ? 'Saving…' : 'Change password'}</button>
        </fieldset>
      </form>}
      {mode === 'signin' && config.google && <>
        <p className="auth-divider"><span>or</span></p>
        <button type="button" className="secondary" disabled={busy} onClick={() => run(startGoogleSignIn)}>Continue with Google</button>
      </>}
      <p className="auth-links">
        {mode === 'signin' && <>New here? <button type="button" className="link" onClick={() => go('register')}>Create an account</button></>}
        {mode !== 'signin' && <button type="button" className="link" onClick={() => go('signin')}>Back to sign in</button>}
      </p>
    </div>
  </main>;
}
