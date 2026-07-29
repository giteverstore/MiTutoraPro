import { useCallback, useMemo, useState } from 'react';
import { CompilerPanel } from './CompilerPanel';
import { ContentArea } from './ContentArea';
import { ResizeHandle } from './ResizeHandle';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { useDragResize } from '../hooks/useDragResize';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { LAYOUT_SIZE } from '../design-system/theme';
import { useUser } from '../auth/UserContext';
import { useLearningProgress } from '../progress/LearningProgressContext';
import { createCompilerData } from './blocks/CompilerBlock';
import { LessonFooter } from './LessonFooter';

export function Layout({ courseLoader, onExitCourse }) {
  const { user, signOut } = useUser();
  const learningProgress = useLearningProgress();
  const {
    currentCourse: course,
    currentModule,
    currentLesson,
    previousLesson,
    nextLesson,
    currentBlockList,
    selectLesson,
    goToPreviousLesson,
    goToNextLesson,
  } = courseLoader;
  const compilerBlock = useMemo(
    () => currentBlockList.find((block) => block.type === 'compiler') ?? null,
    [currentBlockList],
  );
  const exerciseBlock = useMemo(
    () => currentBlockList.find((block) => block.type === 'exercise') ?? null,
    [currentBlockList],
  );
  const lessonContentBlocks = useMemo(
    () => currentBlockList.filter((block) => block.type !== 'compiler'),
    [currentBlockList],
  );
  const compilerData = useMemo(
    () => compilerBlock
      ? { ...createCompilerData(compilerBlock), exerciseId: exerciseBlock?.id ?? null }
      : null,
    [compilerBlock, exerciseBlock?.id],
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.localStorage.getItem('mi-tutora:sidebar-collapsed') === 'true',
  );
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem('mi-tutora:theme') ?? 'light',
  );
  const sidebarResize = useDragResize(LAYOUT_SIZE.sidebar);
  const compilerResize = useDragResize({ ...LAYOUT_SIZE.compiler, direction: -1 });
  const shortcuts = useMemo(() => [
    { key: 'm', action: () => setIsDrawerOpen((current) => !current) },
    {
      key: 'd',
      action: () => setTheme((current) => {
        const nextTheme = current === 'light' ? 'dark' : 'light';
        window.localStorage.setItem('mi-tutora:theme', nextTheme);
        return nextTheme;
      }),
    },
    { key: 'Escape', action: () => setIsDrawerOpen(false) },
    {
      key: 'Enter',
      ctrlOrMeta: true,
      action: () => {
        if (compilerBlock) {
          window.dispatchEvent(new CustomEvent('learning-platform:run'));
        }
      },
    },
  ], [compilerBlock]);

  useKeyboardShortcuts(shortcuts);

  const handleLessonSelect = useCallback((lessonId) => {
    selectLesson(lessonId);
    setIsDrawerOpen(false);
  }, [selectLesson]);

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('mi-tutora:sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  const completedLessonIds = useMemo(
    () => new Set(learningProgress.completedLessons),
    [learningProgress.completedLessons],
  );
  const visitedLessonIds = useMemo(
    () => new Set(learningProgress.visitedLessons),
    [learningProgress.visitedLessons],
  );
  const lessonCount = useMemo(
    () => course.modules.reduce((total, module) => total + module.lessons.length, 0),
    [course.modules],
  );
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const nextTheme = current === 'light' ? 'dark' : 'light';
      window.localStorage.setItem('mi-tutora:theme', nextTheme);
      return nextTheme;
    });
  }, []);

  const workspaceStyle = {
    '--sidebar-width': `${isSidebarCollapsed ? 76 : sidebarResize.value}px`,
    '--compiler-width': `${compilerResize.value}px`,
  };

  return (
    <div className="app-shell" data-theme={theme}>
      <TopNavigation
        course={course}
        lesson={currentLesson}
        onMenuClick={() => setIsDrawerOpen(true)}
        onThemeToggle={toggleTheme}
        theme={theme}
        progress={learningProgress.courseProgress}
        isBookmarked={learningProgress.isBookmarked(currentLesson?.id)}
        onToggleBookmark={() => learningProgress.toggleBookmark(currentLesson.id)}
        user={user}
        onSignOut={signOut}
        onExitCourse={onExitCourse}
      />
      <div
        className={`workspace ${compilerBlock ? 'has-compiler' : ''} ${
          isSidebarCollapsed ? 'is-sidebar-collapsed' : ''
        }`}
        style={workspaceStyle}
      >
        <Sidebar
          course={course}
          currentLessonId={currentLesson?.id}
          onSelectLesson={handleLessonSelect}
          isLoading={false}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          completedLessonIds={completedLessonIds}
          visitedLessonIds={visitedLessonIds}
          completedCount={learningProgress.sequentialCompletedLessons}
          lessonCount={lessonCount}
          completedModuleIds={new Set(learningProgress.completedModules)}
          estimatedTimeRemaining={learningProgress.estimatedTimeRemaining}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
        {!isSidebarCollapsed ? (
          <ResizeHandle
            className="sidebar-resize-handle"
            label={course.ui.resizeLabels.sidebar}
            min={LAYOUT_SIZE.sidebar.min}
            max={LAYOUT_SIZE.sidebar.max}
            value={sidebarResize.value}
            onPointerDown={sidebarResize.startDragging}
            onKeyDown={sidebarResize.handleKeyDown}
          />
        ) : null}
        <ContentArea
          lesson={currentLesson}
          module={currentModule}
          blocks={lessonContentBlocks}
          isLoading={false}
          emptyState={course.ui.emptyLesson}
          unavailableState={course.ui.emptyCourse}
          footer={(
            <LessonFooter
              lesson={currentLesson}
              previousLesson={previousLesson}
              nextLesson={nextLesson}
              onPrevious={goToPreviousLesson}
              onNext={() => goToNextLesson()}
            />
          )}
        >
          {compilerData ? (
            <div className="mobile-compiler">
              <CompilerPanel compiler={compilerData} key={`mobile-${compilerBlock.id}`} />
            </div>
          ) : null}
        </ContentArea>
        {compilerData ? (
          <>
            <aside className="desktop-compiler compiler-enter" aria-label={compilerData.ariaLabel}>
              <CompilerPanel compiler={compilerData} key={compilerBlock.id} />
            </aside>
            <ResizeHandle
              className="compiler-resize-handle"
              label={course.ui.resizeLabels.compiler}
              min={LAYOUT_SIZE.compiler.min}
              max={LAYOUT_SIZE.compiler.max}
              value={compilerResize.value}
              onPointerDown={compilerResize.startDragging}
              onKeyDown={compilerResize.handleKeyDown}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
