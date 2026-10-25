import { useEffect, useRef } from 'react';
import { Bell, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { learnerUiIcons } from '../assets/learnerUiIcons';
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
  onNotificationsClose,
  onUserMenuToggle,
  onUserMenuClose,
  onNavigate,
  onSignOut,
}) {
  const activity = useLearnerActivity();
  const streak = Math.max(0, Number(activity.streak?.currentStreak) || 0);
  const todayCompleted = hasCompletedDailyChallenge(activity.completions, kolkataDate());
  const streakLabel = `${streak} day streak. Today's Daily Challenge ${todayCompleted ? 'completed' : 'is not completed'}.`;
  const notificationAnchorRef = useRef(null);
  const notificationPanelRef = useRef(null);
  const userAnchorRef = useRef(null);
  const userPanelRef = useRef(null);

  useEffect(() => {
    if (!notificationsOpen && !userMenuOpen) return undefined;
    const dismissOutside = (event) => {
      if (notificationAnchorRef.current?.contains(event.target) || notificationPanelRef.current?.contains(event.target)
        || userAnchorRef.current?.contains(event.target) || userPanelRef.current?.contains(event.target)) return;
      if (notificationsOpen) onNotificationsClose();
      if (userMenuOpen) onUserMenuClose();
    };
    const dismissOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (notificationsOpen) onNotificationsClose();
      if (userMenuOpen) onUserMenuClose();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [notificationsOpen, userMenuOpen, onNotificationsClose, onUserMenuClose]);

  return (
    <div className="application-topbar-actions">
      <span className={`application-streak-indicator is-${activity.status}`} aria-label={activity.status === 'ready' ? streakLabel : 'Streak unavailable'}>
        <img src={todayCompleted ? learnerUiIcons.fireComplete : learnerUiIcons.fireIncomplete} alt="" aria-hidden="true" />
        {activity.status === 'ready' ? <strong>{streak}</strong> : <span aria-hidden="true">—</span>}
      </span>
      <button className="application-icon-button" type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun /> : <Moon />}
      </button>
      <div className="application-menu-anchor" ref={notificationAnchorRef}>
        <button className="application-icon-button" type="button" onClick={onNotificationsToggle} aria-label="Notifications" aria-expanded={notificationsOpen}>
          <Bell />
        </button>
        {notificationsOpen ? (
          <div className="application-popover application-notifications" role="status" ref={notificationPanelRef}>
            <strong>Notifications</strong>
            <p>You’re all caught up.</p>
          </div>
        ) : null}
      </div>
      <div className="application-menu-anchor" ref={userAnchorRef}>
        <button className="application-profile-button" type="button" onClick={onUserMenuToggle} aria-label="Open user menu" aria-expanded={userMenuOpen} aria-haspopup="menu">
          <UserAvatar avatar={user.avatar} name={user.name} />
        </button>
        {userMenuOpen ? (
          <div className="application-popover application-user-menu" role="menu" aria-label="User menu" ref={userPanelRef}>
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
