import { Bell, Flame, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { useLearnerActivity } from '../activity/LearnerActivityContext';
import { hasCompletedDailyChallenge, kolkataDate } from '../home/challengeCalendar';
import { ACCOUNT_NAVIGATION } from './navigation';

export function GlobalTopbarActions({
  user,
  theme,
  notificationsOpen,
  userMenuOpen,
  onThemeToggle,
  onNotificationsToggle,
  onUserMenuToggle,
  onNavigate,
  onSignOut,
}) {
  const activity = useLearnerActivity();
  const streak = Math.max(0, Number(activity.streak?.currentStreak) || 0);
  const todayCompleted = hasCompletedDailyChallenge(activity.completions, kolkataDate());
  const streakLabel = `${streak} day streak. Today's Daily Challenge ${todayCompleted ? 'completed' : 'is not completed'}.`;

  return (
    <div className="application-topbar-actions">
      <span className={`application-streak-badge is-${activity.status}${todayCompleted ? ' is-today-completed' : ''}`} aria-label={activity.status === 'ready' ? streakLabel : 'Streak unavailable'}>
        <Flame aria-hidden="true" fill={todayCompleted ? 'currentColor' : 'none'} />
        {activity.status === 'ready' ? <strong>{streak}</strong> : <span aria-hidden="true">—</span>}
      </span>
      <button className="application-icon-button" type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun /> : <Moon />}
      </button>
      <div className="application-menu-anchor">
        <button className="application-icon-button" type="button" onClick={onNotificationsToggle} aria-label="Notifications" aria-expanded={notificationsOpen}>
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
        <button className="application-profile-button" type="button" onClick={onUserMenuToggle} aria-label="Open user menu" aria-expanded={userMenuOpen} aria-haspopup="menu">
          <UserAvatar avatar={user.avatar} name={user.name} />
        </button>
        {userMenuOpen ? (
          <div className="application-popover application-user-menu" role="menu" aria-label="User menu">
            <div className="application-user-identity"><UserRound /><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
            {onNavigate ? (
              <div className="application-user-menu-links">
                {ACCOUNT_NAVIGATION.map(({ id, label, icon: Icon }) => (
                  <button type="button" role="menuitem" onClick={() => onNavigate(id)} key={id}><Icon aria-hidden="true" /> {label}</button>
                ))}
              </div>
            ) : null}
            <div className="application-user-menu-signout">
              <button type="button" role="menuitem" onClick={onSignOut}><LogOut aria-hidden="true" /> Sign out</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
