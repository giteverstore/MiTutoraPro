import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';
import { EmptyState } from './EmptyState';
import { SidebarSkeleton } from './LoadingSkeleton';
import { ModuleItem } from './ModuleItem';

export function Sidebar({
  isOpen,
  onClose,
  course,
  currentLessonId,
  onSelectLesson,
  isLoading,
  completedLessonIds,
  completedCount,
  lessonCount,
  completedModuleIds,
  estimatedTimeRemaining,
  isCollapsed,
  onToggleCollapsed,
}) {
  const { sidebar } = course;

  return (
    <>
      <button
        className={`drawer-scrim ${isOpen ? 'is-visible' : ''}`}
        type="button"
        aria-label={`${sidebar.closeLabel} (${course.ui.shortcuts.close})`}
        onClick={onClose}
      />
      <aside className={`course-sidebar ${isOpen ? 'is-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <span className="eyebrow">{sidebar.eyebrow}</span>
            <h2>{course.name}</h2>
          </div>
          <IconButton
            label={isCollapsed ? 'Expand learning sidebar' : 'Collapse learning sidebar'}
            className="sidebar-collapse-button"
            onClick={onToggleCollapsed}
          >
            {isCollapsed
              ? <PanelLeftOpen size={ICON_SIZE.md} />
              : <PanelLeftClose size={ICON_SIZE.md} />}
          </IconButton>
          <IconButton
            label={`${sidebar.closeLabel} (${course.ui.shortcuts.close})`}
            className="drawer-close"
            onClick={onClose}
          >
            <X size={ICON_SIZE.md} />
          </IconButton>
        </div>
        <div className="sidebar-summary">
          <span>{completedCount} of {lessonCount} lessons</span>
          <span>{estimatedTimeRemaining} min remaining</span>
        </div>
        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <nav className="module-navigation" aria-label={sidebar.navigationLabel}>
            {course.modules.length > 0 ? course.modules.map((module) => (
              <ModuleItem
                module={module}
                currentLessonId={currentLessonId}
                onSelectLesson={onSelectLesson}
                completedLessonIds={completedLessonIds}
                isCompleted={completedModuleIds.has(module.id)}
                key={module.id}
              />
            )) : (
              <EmptyState
                title={course.ui.emptyModules.title}
                description={course.ui.emptyModules.description}
              />
            )}
          </nav>
        )}
        <div className="sidebar-footer">
          <span className="sidebar-footer-icon">{sidebar.support.icon}</span>
          <span>
            <strong>{sidebar.support.title}</strong>
            <small>{sidebar.support.description}</small>
          </span>
        </div>
      </aside>
    </>
  );
}
