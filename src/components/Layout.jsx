import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContentArea } from './ContentArea';
import { ResizeHandle } from './ResizeHandle';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { useDragResize } from '../hooks/useDragResize';
import { useCompilerPaneResize } from '../hooks/useCompilerPaneResize';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { LAYOUT_SIZE } from '../design-system/theme';
import { useUser } from '../auth/UserContext';
import { useAuth } from '../auth/AuthContext';
import { useLearningProgress } from '../progress/LearningProgressContext';
import { createCompilerData } from './blocks/CompilerBlock';
import { LessonFooter } from './LessonFooter';
import { createCourseLessonBookmark } from '../bookmarks/bookmarkModel';
import { LearningCompilerProvider } from '../compiler/LearningCompilerContext';
import { findLessonProgressScope, getModuleLessons } from '../course/courseStructure';
import { dispatchCompilerRun } from '../compiler/core/compilerEvents';
import { useApplicationTheme } from '../theme/useApplicationTheme';
import { LearningWorkspaceToolbar } from './LearningWorkspaceToolbar';
import { AITutorWorkspace } from '../ai/AITutorWorkspace';
import { SharedCompilerDock } from './SharedCompilerDock';

export function Layout({ courseLoader, onExitCourse }) {
  const compilerInstanceId = `course-${courseLoader.currentCourse.id}-workspace`;
  const { user } = useUser();
  const { signOut } = useAuth();
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
  const compilerPanelRef = useRef(null);
  const [isCompilerMinimized, setIsCompilerMinimized] = useState(
    () => window.localStorage.getItem('mi-tutora:compiler-minimized') === 'true',
  );
  const [compilerStatus, setCompilerStatus] = useState('ready');
  const [activeWorkspace, setActiveWorkspace] = useState('course');
  const [compilerContext, setCompilerContext] = useState(null);
  const [pendingTutorRequest, setPendingTutorRequest] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.localStorage.getItem('mi-tutora:sidebar-collapsed') === 'true',
  );
  const { theme, brandTheme, toggleTheme } = useApplicationTheme();
  const [isSidebarOverlay, setIsSidebarOverlay] = useState(
    () => window.matchMedia('(max-width: 1180px)').matches,
  );
  const sidebarResize = useDragResize({
    ...LAYOUT_SIZE.sidebar,
    storageKey: 'mi-tutora:sidebar-width',
  });
  const sidebarPaneWidth = isSidebarCollapsed ? 60 : sidebarResize.value;
  const compilerResize = useCompilerPaneResize({ reservedWidth: isSidebarOverlay ? 0 : sidebarPaneWidth });
  const workspaceRef = compilerResize.workspaceRef;
  const compilerMaxWidth = compilerResize.max;
  const persistentCompilerData = compilerData ?? course.compiler;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1180px)');
    const updateMode = ({ matches }) => {
      setIsSidebarOverlay(matches);
      setIsDrawerOpen(false);
    };
    mediaQuery.addEventListener('change', updateMode);
    return () => mediaQuery.removeEventListener('change', updateMode);
  }, []);

  useEffect(() => {
    if (compilerData) compilerPanelRef.current?.loadDefinition(compilerData);
  }, [compilerData]);

  const toggleCompilerMinimized = useCallback(() => {
    setIsCompilerMinimized((current) => {
      const next = !current;
      window.localStorage.setItem('mi-tutora:compiler-minimized', String(next));
      return next;
    });
  }, []);

  const minimizeCompiler = useCallback(() => {
    setIsCompilerMinimized(true);
    window.localStorage.setItem('mi-tutora:compiler-minimized', 'true');
  }, []);

  const learningCompiler = useMemo(() => ({
    isMinimized: isCompilerMinimized,
    expand: () => {
      setIsCompilerMinimized(false);
      window.localStorage.setItem('mi-tutora:compiler-minimized', 'false');
    },
    runExample: (example) => {
      setIsCompilerMinimized(false);
      window.localStorage.setItem('mi-tutora:compiler-minimized', 'false');
      return new Promise((resolve) => {
        requestAnimationFrame(() => resolve(compilerPanelRef.current?.loadExample(example)));
      });
    },
  }), [isCompilerMinimized]);
  const shortcuts = useMemo(() => [
    { key: 'm', action: () => setIsDrawerOpen((current) => !current) },
    {
      key: 'd',
      action: () => { void toggleTheme().catch(() => undefined); },
    },
    {
      key: 'Escape',
      action: () => {
        setIsDrawerOpen(false);
        minimizeCompiler();
      },
    },
    {
      key: 'Enter',
      ctrlOrMeta: true,
      action: () => {
        dispatchCompilerRun(compilerInstanceId, 'learning-shortcut');
      },
    },
  ], [minimizeCompiler, toggleTheme]);

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
    () => course.contentLoadState?.totalLessonCount
      ?? course.modules.reduce((total, module) => total + getModuleLessons(module).length, 0),
    [course.contentLoadState?.totalLessonCount, course.modules],
  );
  const lessonProgressScope = useMemo(
    () => findLessonProgressScope(course, currentLesson?.id),
    [course, currentLesson?.id],
  );
  const lessonBookmark = useMemo(
    () => currentLesson ? createCourseLessonBookmark({
      course,
      module: currentModule,
      lesson: currentLesson,
    }) : null,
    [course, currentLesson, currentModule],
  );
  const workspaceStyle = {
    '--sidebar-width': `${sidebarPaneWidth}px`,
    '--compiler-width': `${compilerResize.value}px`,
    '--lesson-pane-min': `${LAYOUT_SIZE.lesson.min}px`,
  };
  const handleCompilerContextChange = useCallback((context) => setCompilerContext(context), []);
  const handleAskAITutor = useCallback((context) => {
    setCompilerContext((current) => ({ ...current, ...context }));
    setPendingTutorRequest({ id: `${Date.now()}-${context.selectionContext.snapshot.selectionHash}`, selectionContext: context.selectionContext });
    setActiveWorkspace('ai');
  }, []);

  return (
    <LearningCompilerProvider controller={learningCompiler}>
    <div className="app-shell" data-theme={theme} data-brand-theme={brandTheme}>
      <TopNavigation
        course={course}
        onMenuClick={() => setIsDrawerOpen(true)}
        onThemeToggle={() => { void toggleTheme().catch(() => undefined); }}
        theme={theme}
        lessonProgress={lessonProgressScope && lessonProgressScope.index >= 0 ? {
          current: lessonProgressScope.index + 1,
          total: lessonProgressScope.lessons.length,
        } : null}
        bookmark={lessonBookmark}
        onBookmarkChange={(saved) => {
          if (currentLesson && learningProgress.isBookmarked(currentLesson.id) !== saved) {
            learningProgress.toggleBookmark(currentLesson.id);
          }
        }}
        user={user}
        onSignOut={signOut}
        onExitCourse={onExitCourse}
        isSidebarOverlay={isSidebarOverlay}
      />
      <div
        ref={workspaceRef}
        data-immersive-coding-workspace="course"
        className={`workspace ${!isCompilerMinimized ? 'has-compiler' : 'is-compiler-minimized'} ${
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
          isOverlay={isSidebarOverlay}
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
        <section className="lesson-region" aria-label="Lesson content and navigation">
          <LearningWorkspaceToolbar
            activeView={activeWorkspace}
            onViewChange={setActiveWorkspace}
            compilerMinimized={isCompilerMinimized}
            onRestoreCompiler={toggleCompilerMinimized}
          />
          <div className="learning-workspace-view is-course" id="learning-course-panel" role="tabpanel" hidden={activeWorkspace !== 'course'}>
            <ContentArea
              lesson={currentLesson}
              module={currentModule}
              blocks={lessonContentBlocks}
              isLoading={false}
              emptyState={course.ui.emptyLesson}
              unavailableState={course.ui.emptyCourse}
            />
            <LessonFooter
              lesson={currentLesson}
              previousLesson={previousLesson}
              nextLesson={nextLesson}
              onPrevious={goToPreviousLesson}
              onNext={() => goToNextLesson()}
              lessonCount={lessonProgressScope?.lessons.length ?? lessonCount}
              currentLessonIndex={lessonProgressScope?.index ?? -1}
            />
          </div>
          <div className="learning-workspace-view is-ai" id="learning-ai-panel" role="tabpanel" hidden={activeWorkspace !== 'ai'}>
            <AITutorWorkspace
              course={course}
              lesson={currentLesson}
              compilerContext={compilerContext ?? {
                code: persistentCompilerData.editor.lines.map((line) => line.text ?? '').join('\n'),
                language: persistentCompilerData.language,
                fileName: persistentCompilerData.editor.fileName,
                compilerStatus: 'ready',
              }}
              pendingRequest={pendingTutorRequest}
            />
          </div>
        </section>
        <SharedCompilerDock
          ariaLabel={persistentCompilerData.ariaLabel}
          compilerStatus={compilerStatus}
          minimized={isCompilerMinimized}
          panelRef={compilerPanelRef}
          compiler={persistentCompilerData}
          panelProps={{
            instanceId: compilerInstanceId,
            activityType: 'lesson',
            onExecutionStateChange: setCompilerStatus,
            isCompilerMinimized,
            onToggleCompiler: toggleCompilerMinimized,
            onAskAITutor: handleAskAITutor,
            onContextChange: handleCompilerContextChange,
            aiEnabled: true,
          }}
          errorBoundary={{
            name: 'course-compiler',
            title: 'The compiler could not be displayed.',
            description: 'Your lesson remains available. Retry the compiler without leaving this lesson.',
            resetKeys: [persistentCompilerData.id],
          }}
          resize={{ label: course.ui.resizeLabels.compiler, max: compilerMaxWidth, value: compilerResize.value, onPointerDown: compilerResize.startDragging, onKeyDown: compilerResize.handleKeyDown }}
        />
      </div>
    </div>
    </LearningCompilerProvider>
  );
}
