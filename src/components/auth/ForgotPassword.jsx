import { useState } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { AuthLayout } from './AuthLayout';
import { FormField } from './FormField';

export function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <AuthLayout
        eyebrow="Request received"
        title="Check your email"
        description="This is a frontend demonstration; no email was actually sent."
      >
        <div className="auth-confirmation">
          <span><MailCheck size={ICON_SIZE.xl} /></span>
          <p>A password reset message would be sent to <strong>{email}</strong>.</p>
          <button className="button button--secondary auth-submit" type="button" onClick={onBack}>
            <ArrowLeft size={ICON_SIZE.base} /> Return to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="Enter your email to preview the recovery experience."
    >
      <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
        <FormField label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <button className="button button--primary auth-submit" type="submit">Continue</button>
        <button className="auth-text-button auth-back-button" type="button" onClick={onBack}>
          <ArrowLeft size={ICON_SIZE.sm} /> Back to sign in
        </button>
      </form>
    </AuthLayout>
  );
}
