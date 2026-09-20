import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { requestAuthentication } from './publicAuthNavigation';

const links = [['/library', 'Courses'], ['/practice', 'Practice'], ['/projects', 'Projects']];

export function PublicHeader({ activePath = window.location.pathname }) {
  const [open, setOpen] = useState(false);
  return <header className="marketing-header"><a className="marketing-brand" href="/" aria-label="Y Coders home"><img src="/ycoders-mark.svg" alt="" /><strong>ycoders</strong></a><button className="marketing-menu-button" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="marketing-navigation" onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button><div className={open ? 'marketing-navigation is-open' : 'marketing-navigation'} id="marketing-navigation"><nav aria-label="Public navigation">{links.map(([href, label]) => <a href={href} aria-current={activePath === href ? 'page' : undefined} key={href}>{label}</a>)}</nav><div className="marketing-auth-actions"><button type="button" onClick={() => requestAuthentication(activePath, 'login')}>Login</button><button className="button button--primary" type="button" onClick={() => requestAuthentication(activePath, 'signup')}>Sign Up</button></div></div></header>;
}
