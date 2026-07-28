import { Code2 } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span><Code2 size={ICON_SIZE.lg} /></span>
          <strong>MI Tutora</strong>
        </div>
        <div>
          <span className="eyebrow">Learn by building</span>
          <h1>Build practical coding skills, one focused lesson at a time.</h1>
          <p>Your progress, bookmarks, and preferences stay available on this device.</p>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p className="auth-description">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
