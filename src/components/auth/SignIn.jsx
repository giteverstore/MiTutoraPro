import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { AuthLayout } from './AuthLayout';
import { FormField } from './FormField';

export function SignIn({ onSubmit, onGoogle, onSignUp, onForgotPassword }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await onSubmit(form);
    } catch (authError) {
      setError(authError.message || 'Unable to sign in.');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await onGoogle();
    } catch (authError) {
      setError(authError.message || 'Unable to sign in with Google.');
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to continue"
      description="Use your email and password or continue with Google."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
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
        <button className="auth-text-button" type="button" onClick={onForgotPassword}>
          Forgot password?
        </button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--primary auth-submit" type="submit">
          Sign in <ArrowRight size={ICON_SIZE.base} />
        </button>
        <button className="button button--secondary auth-submit" type="button" onClick={handleGoogleSignIn}>
          Continue with Google
        </button>
      </form>
      <p className="auth-switch">
        New to MI Tutora? <button type="button" onClick={onSignUp}>Create an account</button>
      </p>
    </AuthLayout>
  );
}
