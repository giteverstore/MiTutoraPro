import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { AuthLayout } from './AuthLayout';
import { FormField } from './FormField';

export function SignIn({ onSubmit, onSignUp, onForgotPassword }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await onSubmit({ email: form.email });
    if (!result.success) setError(result.message);
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to continue"
      description="Use the email connected to your local learning profile."
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
          hint="Demo only. Passwords are not stored or authenticated."
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
      </form>
      <p className="auth-switch">
        New to MI Tutora? <button type="button" onClick={onSignUp}>Create an account</button>
      </p>
    </AuthLayout>
  );
}
