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
    referralCode: new URLSearchParams(globalThis.location?.search ?? '').get('ref') ?? '',
  });
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingAction) return;
    const validationError = validateRegistration(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPendingAction('email');
    try {
      await onContinue({ name: form.name.trim(), email: form.email.trim(), password: form.password, referralCode: form.referralCode.trim() });
    } catch (authError) {
      setError(authError.message || 'Unable to create your account.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleGoogleRegistration = async () => {
    if (pendingAction) return;
    setError('');
    setPendingAction('google');
    try {
      await onGoogle();
    } catch (authError) {
      setError(authError.message || 'Unable to continue with Google.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <AuthLayout
      title="Start your learning profile"
      variant="sign-up"
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
        <FormField label="Referral code (optional)" name="referralCode" autoComplete="off" value={form.referralCode} onChange={updateField} />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--primary auth-submit" type="submit" disabled={Boolean(pendingAction)} aria-busy={pendingAction === 'email'}>
          <AuthButtonLabel loading={pendingAction === 'email'} loadingLabel="Creating account…">
            Continue <ArrowRight size={ICON_SIZE.base} />
          </AuthButtonLabel>
        </button>
        <button className="button button--secondary auth-submit auth-google-button" type="button" onClick={handleGoogleRegistration} disabled={Boolean(pendingAction)} aria-busy={pendingAction === 'google'}>
          <AuthButtonLabel loading={pendingAction === 'google'} loadingLabel="Opening Google…">
            Continue with Google
          </AuthButtonLabel>
        </button>
      </form>
      <p className="auth-switch">
        Already have a profile? <button type="button" onClick={onSignIn} disabled={Boolean(pendingAction)}>Sign in</button>
      </p>
    </AuthLayout>
  );
}
