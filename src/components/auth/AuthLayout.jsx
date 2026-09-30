export function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page" data-theme="light">
      <section className="auth-form-panel" aria-labelledby="auth-page-title">
        <div className="auth-form-wrap">
          <a className="auth-brand" href="/" aria-label="Y Coders home">
            <span><img src="/ycoders-mark.svg" alt="" /></span>
            <strong>Y CODERS</strong>
          </a>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1 id="auth-page-title">{title}</h1>
          {description ? <p className="auth-description">{description}</p> : null}
          {children}
          <nav className="auth-public-links" aria-label="Legal and company information">
            <a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refund-policy">Refund Policy</a>
          </nav>
        </div>
      </section>
    </main>
  );
}
