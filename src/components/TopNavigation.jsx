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
  lessonProgress,
  bookmark,
  onBookmarkChange,
  onExitCourse,
  isSidebarOverlay,
}) {
  const { navigation } = course;
  const hasLessonProgress = Number.isInteger(lessonProgress?.current)
    && Number.isInteger(lessonProgress?.total)
    && lessonProgress.total > 0
    && lessonProgress.current >= 1
    && lessonProgress.current <= lessonProgress.total;
  const lessonProgressText = hasLessonProgress
    ? `${lessonProgress.current} of ${lessonProgress.total}`
    : '— of —';
  const lessonProgressPercent = hasLessonProgress
    ? (lessonProgress.current / lessonProgress.total) * 100
    : 0;
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
            <span>Lesson progress</span>
            <strong>{lessonProgressText}</strong>
          </div>
          {hasLessonProgress ? (
            <div
              className="progress-track"
              role="progressbar"
              aria-label={`Lesson progress: ${lessonProgressText}`}
              aria-valuenow={lessonProgress.current}
              aria-valuemin="1"
              aria-valuemax={lessonProgress.total}
            >
              <span style={{ width: `${lessonProgressPercent}%` }} />
            </div>
          ) : null}
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
