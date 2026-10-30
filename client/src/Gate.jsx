// Checks the current login before showing the private lesson dashboard.
import React, { useEffect, useState } from 'react';
import App from './App.jsx';
import AuthScreen from './AuthScreen.jsx';
import { getAuthConfig, getSession, installUnauthorizedHandler, signOut } from './auth.js';

// Reads a reset token once and removes it from the visible address bar.
function readResetLink() {
  const params = new URLSearchParams(window.location.search);
  const onResetPage = window.location.pathname === '/reset-password';
  const token = onResetPage ? params.get('token') : null;
  const error = onResetPage && params.get('error') ? 'This reset link is invalid or has expired. Request a new one.' : null;
  if (onResetPage) window.history.replaceState({}, '', '/');
  return { token, error };
}

// Only mounts the private dashboard after the session check succeeds.
export default function Gate() {
  const [link] = useState(readResetLink);
  const [config, setConfig] = useState({ google: false, mail: 'unknown' });
  const [state, setState] = useState({ status: 'loading', user: null, notice: null });

  useEffect(() => {
    let active = true;
    getAuthConfig().then(value => { if (active) setConfig(value); });
    getSession().then(user => { if (active) setState({ status: user && !link.token && !link.error ? 'in' : 'out', user: user && !link.token && !link.error ? user : null, notice: null }); }).catch(() => { if (active) setState({ status: 'out', user: null, notice: null }); });
    return () => { active = false; };
  }, []);

  useEffect(() => installUnauthorizedHandler(() => setState(current => current.status === 'in' ? { status: 'out', user: null, notice: 'Your session ended, so you were signed out. Please sign in again.' } : current)), []);

  // Clears the local signed-in view even if the session has already expired.
  async function logOut() {
    try { await signOut(); } catch { /* the server may already have ended the session */ }
    setState({ status: 'out', user: null, notice: 'You have been signed out.' });
  }

  if (state.status === 'loading') return <main><p role="status">Loading CoachLab…</p></main>;
  if (state.status === 'out') return <AuthScreen config={config} notice={state.notice} resetToken={link.token} resetError={link.error} onSignedIn={user => setState({ status: 'in', user, notice: null })} />;
  return <App user={state.user} onLogOut={logOut} />;
}
