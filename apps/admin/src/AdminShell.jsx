import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { adminRoleLabel } from '../../../shared/admin/adminAuthorization.js';
import { ADMIN_NAVIGATION } from './adminRoutes.js';

export function AdminShell({ route, session, onNavigate, onSignOut, children }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(() => {
    try { return window.localStorage.getItem('ycoders.admin.navigation-collapsed.v1') === 'true'; } catch { return false; }
  });
  const [tooltip, setTooltip] = useState(null);
  useEffect(() => setNavigationOpen(false), [route?.path]);
  useEffect(() => {
    try { window.localStorage.setItem('ycoders.admin.navigation-collapsed.v1', String(navigationCollapsed)); } catch { /* Keep session state when storage is unavailable. */ }
    setTooltip(null);
  }, [navigationCollapsed]);
  useEffect(() => {
    const clear = () => setTooltip(null);
    window.addEventListener('resize', clear);
    return () => window.removeEventListener('resize', clear);
  }, []);
  const showTooltip = (event, label) => {
    if (!navigationCollapsed || !window.matchMedia('(min-width: 901px)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: Math.max(24, Math.min(bounds.top + bounds.height / 2, window.innerHeight - 24)), left: bounds.right + 8 });
  };
  const hideTooltip = (event) => { if (document.activeElement !== event.currentTarget) setTooltip(null); };
  return <div className={`admin-shell${navigationCollapsed ? ' is-navigation-collapsed' : ''}`}>
    <a className="admin-skip-link" href="#admin-main">Skip to content</a>
    <header className="admin-header">
      <button className="admin-mobile-menu" type="button" aria-label="Open navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu aria-hidden="true" /></button>
      <div className="admin-header-title"><span>{route?.section ?? 'Admin'}</span><strong>{route?.label ?? 'Page not found'}</strong></div>
      <div className="admin-identity"><div><strong>{session.displayName || session.email || 'Admin'}</strong><span>{adminRoleLabel(session.role)}</span></div><button type="button" onClick={onSignOut}><LogOut aria-hidden="true" /><span>Sign out</span></button></div>
    </header>
    {navigationOpen ? <button className="admin-navigation-scrim" type="button" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} /> : null}
    <aside className={`admin-sidebar ${navigationOpen ? 'is-open' : ''}`} aria-label="Admin navigation">
      <div className="admin-sidebar-brand"><span aria-hidden="true">Y</span><div><strong>Y Coders</strong><small>Admin</small></div><button type="button" aria-label="Close navigation" onClick={() => setNavigationOpen(false)}><X aria-hidden="true" /></button></div>
      <nav id="admin-navigation">
        {ADMIN_NAVIGATION.map((group) => <section key={group.section} aria-labelledby={`admin-nav-${group.section.toLowerCase()}`}>
          <h2 id={`admin-nav-${group.section.toLowerCase()}`}>{group.section}</h2>
          {group.routes.map((item) => { const Icon = item.icon; const current = item.path === route?.path; return <a key={item.path} href={item.path} aria-label={navigationCollapsed ? item.label : undefined} aria-describedby={navigationCollapsed ? 'admin-navigation-tooltip' : undefined} aria-current={current ? 'page' : undefined} onMouseEnter={(event) => showTooltip(event, item.label)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip(event, item.label)} onBlur={() => setTooltip(null)} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setTooltip(null); onNavigate(item.path); } }}><Icon aria-hidden="true" /><span>{item.label}</span></a>; })}
        </section>)}
      </nav>
      <div className="admin-sidebar-footer"><button type="button" aria-label={navigationCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-controls="admin-navigation" aria-expanded={!navigationCollapsed} aria-describedby={navigationCollapsed ? 'admin-navigation-tooltip' : undefined} onMouseEnter={(event) => showTooltip(event, 'Expand navigation')} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip(event, 'Expand navigation')} onBlur={() => setTooltip(null)} onClick={() => setNavigationCollapsed((value) => !value)}>{navigationCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}<span>{navigationCollapsed ? 'Expand navigation' : 'Collapse navigation'}</span></button></div>
    </aside>
    <main id="admin-main" className="admin-main" tabIndex="-1">{children}</main>
    {tooltip ? createPortal(<span id="admin-navigation-tooltip" className="admin-nav-tooltip" role="tooltip" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.label}</span>, document.body) : null}
  </div>;
}
