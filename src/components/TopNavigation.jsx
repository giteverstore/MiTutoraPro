import { ArrowLeft, Moon, PanelLeftOpen, Sun } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { UserAvatar } from './UserAvatar';

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
        <span className="overview-brand lesson-topbar-brand" aria-label="MiTutora">
          <span aria-hidden="true">Mi</span>
          MiTutora
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
        <IconButton
          label={`${theme === 'light' ? navigation.darkModeLabel : navigation.lightModeLabel} (${course.ui.shortcuts.theme})`}
          onClick={onThemeToggle}
        >
          {theme === 'light' ? <Moon size={ICON_SIZE.md} /> : <Sun size={ICON_SIZE.md} />}
        </IconButton>
        {bookmark ? (
          <BookmarkToggle
            bookmark={bookmark}
            onChange={onBookmarkChange}
            iconOnly
            className="topbar-bookmark-toggle"
          />
        ) : null}
        <div className="topbar-user">
          <UserAvatar avatar={user.avatar} name={user.name} className="user-avatar" />
          <span className="user-name">{user.name}</span>
          <button className="auth-text-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
