import { Bell, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';

function getInitials(name) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

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
      <div className="application-topbar-actions">
        <button className="application-icon-button" type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <div className="application-menu-anchor">
          <button
            className="application-icon-button"
            type="button"
            onClick={onNotificationsToggle}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell />
          </button>
          {notificationsOpen ? (
            <div className="application-popover application-notifications" role="status">
              <strong>Notifications</strong>
              <p>You’re all caught up.</p>
            </div>
          ) : null}
        </div>
        <div className="application-menu-anchor">
          <button
            className="application-profile-button"
            type="button"
            onClick={onUserMenuToggle}
            aria-label="Open user menu"
            aria-expanded={userMenuOpen}
          >
            <span>{getInitials(user.name)}</span>
            <div><strong>{user.name}</strong><small>Learner</small></div>
          </button>
          {userMenuOpen ? (
            <div className="application-popover application-user-menu">
              <div><UserRound /><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
              <button type="button" onClick={onSignOut}><LogOut /> Sign out</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
