import { useState } from 'react';

const authMessage = (error) => ({
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/network-request-failed': 'Check your connection and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
}[error?.code] ?? 'Sign-in could not be completed. Try again.');

export function AdminLogin({ authClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState({ busy: false, message: '' });
  const run = async (operation) => {
    if (state.busy) return;
    setState({ busy: true, message: '' });
    try { await operation(); }
    catch (error) { setState({ busy: false, message: authMessage(error) }); }
  };
  return <main className="admin-state-page"><section className="admin-auth-card" aria-labelledby="admin-login-title">
    <div className="admin-brand"><span aria-hidden="true">Y</span><div><strong>Y Coders</strong><small>Admin</small></div></div>
    <h1 id="admin-login-title">Sign in to Y Coders Admin</h1>
    <p>Use your authorized Y Coders account to continue.</p>
    <form onSubmit={(event) => { event.preventDefault(); void run(() => authClient.signInWithEmail(email, password)); }}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {state.message ? <p className="admin-form-error" role="alert">{state.message}</p> : null}
      <button className="admin-primary-button" type="submit" disabled={state.busy}>{state.busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <div className="admin-auth-divider"><span>or</span></div>
    <button className="admin-secondary-button" type="button" disabled={state.busy} onClick={() => void run(authClient.signInWithGoogle)}>Continue with Google</button>
  </section></main>;
}
