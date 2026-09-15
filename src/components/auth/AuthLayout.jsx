export function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span><img src="/ycoders-mark.svg" alt="" /></span>
          <strong>ycoders</strong>
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
          <nav className="auth-public-links" aria-label="Legal and company information">
            <a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refund-policy">Refund Policy</a>
          </nav>
        </div>
      </section>
    </main>
  );
}
