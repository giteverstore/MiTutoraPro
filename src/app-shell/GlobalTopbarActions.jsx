import { Bell, Flame, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { useLearnerActivity } from '../activity/LearnerActivityContext';
import { hasCompletedDailyChallenge, kolkataDate } from '../home/challengeCalendar';

export function GlobalTopbarActions({
  user,
  theme,
  notificationsOpen,
  userMenuOpen,
  onThemeToggle,
  onNotificationsToggle,
  onUserMenuToggle,
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
        <button className="application-profile-button" type="button" onClick={onUserMenuToggle} aria-label="Open user menu" aria-expanded={userMenuOpen}>
          <UserAvatar avatar={user.avatar} name={user.name} />
        </button>
        {userMenuOpen ? (
          <div className="application-popover application-user-menu">
            <div><UserRound /><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
            <button type="button" onClick={onSignOut}><LogOut /> Sign out</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
