import { Menu } from 'lucide-react';
import { GlobalTopbarActions } from './GlobalTopbarActions';

export function AppTopNavigation({
  pageLabel,
  user,
  theme,
  notificationsOpen,
  userMenuOpen,
  onMenuOpen,
  onThemeToggle,
  onNotificationsToggle,
  onUserMenuToggle,
  onSignOut,
}) {
  return (
    <header className="application-topbar">
      <button className="application-icon-button application-menu-button" type="button" onClick={onMenuOpen} aria-label="Open navigation">
        <Menu />
      </button>
      <strong className="application-page-title">{pageLabel}</strong>
      <GlobalTopbarActions {...{
        user, theme, notificationsOpen, userMenuOpen, onThemeToggle,
        onNotificationsToggle, onUserMenuToggle, onSignOut,
      }} />
    </header>
  );
}
