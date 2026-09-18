const links = [
  ['/about', 'About'],
  ['/contact', 'Contact'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/refund-policy', 'Refund Policy'],
];

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <a className="public-footer-brand" href="/" aria-label="ycoders home"><img src="/ycoders-mark.svg" alt="" />ycoders</a>
      <nav aria-label="Legal and company information">
        {links.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
      </nav>
    </footer>
  );
}
