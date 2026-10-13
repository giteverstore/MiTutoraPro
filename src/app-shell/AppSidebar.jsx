import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PRIMARY_NAVIGATION } from './navigation';
import { brandAssets } from '../branding/brandAssets.js';
import { BrandWordmark } from '../branding/BrandWordmark.jsx';

export function AppSidebar({
  activePage,
  collapsed,
  mobileOpen,
  onNavigate,
  onToggleCollapsed,
  onCloseMobile,
  todayChallengeCompleted = false,
}) {
  return (
    <>
      <aside
        className={`application-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
        aria-label="Primary navigation"
      >
        <div className="application-sidebar-header">
          <button className="application-brand" type="button" aria-label="Y Coders home" onClick={() => onNavigate('home')}>
            <span className="application-brand-mark"><img src={brandAssets.mark} alt="" width="486" height="513" /></span>
            <BrandWordmark className="application-brand-full" />
          </button>
          <button
            className="application-icon-button application-drawer-close"
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <nav className="application-navigation">
          {PRIMARY_NAVIGATION.map(({ id, label, icon: Icon }) => {
            const challengeCompleted = id === 'challenges' && todayChallengeCompleted;
            return (
            <button
              className={activePage === id ? 'is-active' : ''}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={activePage === id ? 'page' : undefined}
              title={collapsed ? label : undefined}
              aria-label={challengeCompleted ? "Challenges — today's challenge completed" : undefined}
              key={id}
            >
              <span className="application-navigation-icon"><Icon aria-hidden="true" />{challengeCompleted ? <span className="application-navigation-complete" aria-hidden="true"><Check /></span> : null}</span>
              <span className="application-navigation-label">{label}</span>
            </button>
          );})}
        </nav>
        <button
          className="application-sidebar-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
          <span>Collapse</span>
        </button>
      </aside>
      <button
        className={`application-drawer-backdrop ${mobileOpen ? 'is-visible' : ''}`}
        type="button"
        onClick={onCloseMobile}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
      />
    </>
  );
}
