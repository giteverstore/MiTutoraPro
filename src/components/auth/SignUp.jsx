import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { AuthLayout } from './AuthLayout';
import { AuthButtonLabel } from './AuthButtonLabel';
import { FormField } from './FormField';
import { validateRegistration } from '../../auth/authValidation';

export function SignUp({ onContinue, onGoogle, onSignIn }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [googlePending, setGooglePending] = useState(false);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationError = validateRegistration(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    onContinue({ name: form.name.trim(), email: form.email.trim(), password: form.password });
  };

  const handleGoogleRegistration = async () => {
    if (googlePending) return;
    setError('');
    setGooglePending(true);
    try {
      await onGoogle();
    } catch (authError) {
      setError(authError.message || 'Unable to continue with Google.');
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Start your learning profile"
      description="Set up the basics, then personalize how you want to learn."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Name" name="name" autoComplete="name" value={form.name} onChange={updateField} required />
        <FormField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} required />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength="6"
          value={form.password}
          onChange={updateField}
          required
        />
        <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={updateField} required />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--primary auth-submit" type="submit" disabled={googlePending}>
          Continue <ArrowRight size={ICON_SIZE.base} />
        </button>
        <button className="button button--secondary auth-submit" type="button" onClick={handleGoogleRegistration} disabled={googlePending} aria-busy={googlePending}>
          <AuthButtonLabel loading={googlePending} loadingLabel="Opening Google…">
            Continue with Google
          </AuthButtonLabel>
        </button>
      </form>
      <p className="auth-switch">
        Already have a profile? <button type="button" onClick={onSignIn} disabled={googlePending}>Sign in</button>
      </p>
    </AuthLayout>
  );
}
