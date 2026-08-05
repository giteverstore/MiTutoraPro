import { Menu, Moon, Sun } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';
import { BookmarkToggle } from '../bookmarks/BookmarkToggle';
import { UserAvatar } from './UserAvatar';

export function TopNavigation({
  onMenuClick,
  course,
  lesson,
  onThemeToggle,
  theme,
  user,
  onSignOut,
  progress,
  bookmark,
  onBookmarkChange,
  onExitCourse,
}) {
  const { navigation } = course;

  return (
    <header className="topbar">
      <div className="topbar-context">
        <IconButton
          label={`${navigation.openMenuLabel} (${course.ui.shortcuts.menu})`}
          className="menu-trigger"
          onClick={onMenuClick}
        >
          <Menu size={ICON_SIZE.lg} />
        </IconButton>
        <button className="course-mark course-mark-button" type="button" aria-label="Return to dashboard" onClick={onExitCourse}>{course.shortMark}</button>
        <div className="course-context-copy">
          <span className="eyebrow">{course.categoryLabel}</span>
          <strong>{course.name}</strong>
        </div>
        <span className="context-divider" aria-hidden="true" />
        <div className="lesson-context">
          <span className="eyebrow">{navigation.currentLessonLabel}</span>
          <span>{lesson?.title ?? course.ui.emptyCourse.title}</span>
        </div>
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
