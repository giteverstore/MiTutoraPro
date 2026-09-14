import { useEffect, useState } from 'react';
import { ArrowLeft, PanelLeftOpen } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { GlobalTopbarActions } from '../app-shell/GlobalTopbarActions';

export function TopNavigation({
  onMenuClick,
  course,
  onThemeToggle,
  theme,
  user,
  onSignOut,
  progress,
  bookmark,
  onBookmarkChange,
  onExitCourse,
  isSidebarOverlay,
}) {
  const { navigation } = course;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const closeMenus = (event) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', closeMenus);
    return () => window.removeEventListener('keydown', closeMenus);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-context">
        <IconButton
          label="Back to course overview"
          className="lesson-back-button"
          onClick={onExitCourse}
        >
          <ArrowLeft size={ICON_SIZE.lg} aria-hidden="true" />
        </IconButton>
        <span className="overview-brand lesson-topbar-brand" aria-label="ycoders">
          <span><img src="/ycoders-mark.svg" alt="" /></span>
          ycoders
        </span>
        {isSidebarOverlay ? (
          <IconButton
            label={`${navigation.openMenuLabel} (${course.ui.shortcuts.menu})`}
            className="lesson-sidebar-trigger"
            onClick={onMenuClick}
          >
            <PanelLeftOpen size={ICON_SIZE.md} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      <div className="lesson-navigation">
        <div className="progress-block">
          <div className="progress-copy">
            <span>{navigation.progressLabel}</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        {bookmark ? (
          <BookmarkToggle
            bookmark={bookmark}
            onChange={onBookmarkChange}
            iconOnly
            className="topbar-bookmark-toggle"
          />
        ) : null}
        <GlobalTopbarActions
          user={user}
          theme={theme}
          notificationsOpen={notificationsOpen}
          userMenuOpen={userMenuOpen}
          onThemeToggle={onThemeToggle}
          onNotificationsToggle={() => {
            setUserMenuOpen(false);
            setNotificationsOpen((current) => !current);
          }}
          onUserMenuToggle={() => {
            setNotificationsOpen(false);
            setUserMenuOpen((current) => !current);
          }}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
