import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { AuthLayout } from './AuthLayout';
import { FormField } from './FormField';

export function SignUp({ onContinue, onSignIn }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    onContinue({ name: form.name.trim(), email: form.email.trim(), password: form.password });
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Start your learning profile"
      description="Set up the basics, then personalize how you want to learn."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Name" name="name" autoComplete="name" value={form.name} onChange={updateField} required />
        <FormField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} required />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength="8"
          value={form.password}
          onChange={updateField}
          required
        />
        <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={updateField} required />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--primary auth-submit" type="submit">
          Continue <ArrowRight size={ICON_SIZE.base} />
        </button>
      </form>
      <p className="auth-switch">
        Already have a profile? <button type="button" onClick={onSignIn}>Sign in</button>
      </p>
    </AuthLayout>
  );
}
