import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from '../components/IconButton';

export function DashboardTopNavigation({
  user,
  query,
  onQueryChange,
  theme,
  onThemeToggle,
  onMenuClick,
  onContinue,
  isNotificationsOpen,
  onNotificationsToggle,
  isProfileOpen,
  onProfileToggle,
  onSignOut,
}) {
  return (
    <header className="dashboard-topbar">
      <IconButton label="Open dashboard navigation" className="dashboard-menu-button" onClick={onMenuClick}>
        <Menu size={ICON_SIZE.lg} />
      </IconButton>
      <label className="dashboard-search">
        <Search size={ICON_SIZE.md} />
        <input
          type="search"
          value={query}
          placeholder="Search courses"
          aria-label="Search courses"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <kbd>⌘ K</kbd>
      </label>
      <div className="dashboard-topbar-actions">
        <button className="button button--primary dashboard-continue-button" type="button" onClick={onContinue}>
          Continue learning
        </button>
        <div className="dashboard-popover-wrap">
          <IconButton label="Notifications" aria-expanded={isNotificationsOpen} onClick={onNotificationsToggle}>
            <Bell size={ICON_SIZE.md} />
          </IconButton>
          <span className="notification-dot" />
          {isNotificationsOpen ? (
            <div className="dashboard-popover notification-popover" role="status">
              <strong>You’re all caught up</strong>
              <p>New learning reminders will appear here.</p>
            </div>
          ) : null}
        </div>
        <IconButton label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={onThemeToggle}>
          {theme === 'dark' ? <Sun size={ICON_SIZE.md} /> : <Moon size={ICON_SIZE.md} />}
        </IconButton>
        <div className="dashboard-popover-wrap">
          <button className="dashboard-profile-button" type="button" aria-expanded={isProfileOpen} onClick={onProfileToggle}>
            <span>{user.avatar}</span>
            <span><strong>{user.name}</strong><small>{user.email}</small></span>
          </button>
          {isProfileOpen ? (
            <div className="dashboard-popover profile-popover">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
              <button type="button" onClick={onSignOut}>Sign out</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

