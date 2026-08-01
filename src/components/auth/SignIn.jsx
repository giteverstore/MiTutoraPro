import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { AuthLayout } from './AuthLayout';
import { AuthButtonLabel } from './AuthButtonLabel';
import { FormField } from './FormField';
import { validateLogin } from '../../auth/authValidation';

export function SignIn({ onSubmit, onGoogle, onSignUp, onForgotPassword }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingAction) return;
    const validationError = validateLogin(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPendingAction('email');
    try {
      await onSubmit({ email: form.email.trim(), password: form.password });
    } catch (authError) {
      setError(authError.message || 'Unable to sign in.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (pendingAction) return;
    setError('');
    setPendingAction('google');
    try {
      await onGoogle();
    } catch (authError) {
      setError(authError.message || 'Unable to sign in with Google.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to continue"
      description="Use your email and password or continue with Google."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={updateField}
          required
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={updateField}
          required
        />
        <button className="auth-text-button" type="button" onClick={onForgotPassword} disabled={Boolean(pendingAction)}>
          Forgot password?
        </button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--primary auth-submit" type="submit" disabled={Boolean(pendingAction)} aria-busy={pendingAction === 'email'}>
          <AuthButtonLabel loading={pendingAction === 'email'} loadingLabel="Signing in…">
            Sign in <ArrowRight size={ICON_SIZE.base} />
          </AuthButtonLabel>
        </button>
        <button className="button button--secondary auth-submit" type="button" onClick={handleGoogleSignIn} disabled={Boolean(pendingAction)} aria-busy={pendingAction === 'google'}>
          <AuthButtonLabel loading={pendingAction === 'google'} loadingLabel="Opening Google…">
            Continue with Google
          </AuthButtonLabel>
        </button>
      </form>
      <p className="auth-switch">
        New to MI Tutora? <button type="button" onClick={onSignUp} disabled={Boolean(pendingAction)}>Create an account</button>
      </p>
    </AuthLayout>
  );
}
