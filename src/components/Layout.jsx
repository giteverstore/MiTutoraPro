import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Maximize2, Minus } from 'lucide-react';
import { CompilerPanel } from './CompilerPanel';
import { ContentArea } from './ContentArea';
import { ResizeHandle } from './ResizeHandle';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { useDragResize } from '../hooks/useDragResize';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ICON_SIZE, LAYOUT_SIZE } from '../design-system/theme';
import { useUser } from '../auth/UserContext';
import { useAuth } from '../auth/AuthContext';
import { useLearningProgress } from '../progress/LearningProgressContext';
import { createCompilerData } from './blocks/CompilerBlock';
import { LessonFooter } from './LessonFooter';
import { createCourseLessonBookmark } from '../bookmarks/bookmarkModel';
import { LearningCompilerProvider } from '../compiler/LearningCompilerContext';
import { findLessonProgressScope, getModuleLessons } from '../course/courseStructure';

export function Layout({ courseLoader, onExitCourse }) {
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
  const workspaceRef = useRef(null);
  const compilerPanelRef = useRef(null);
  const [isCompilerMinimized, setIsCompilerMinimized] = useState(
    () => window.localStorage.getItem('mi-tutora:compiler-minimized') === 'true',
  );
  const [compilerStatus, setCompilerStatus] = useState('ready');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.localStorage.getItem('mi-tutora:sidebar-collapsed') === 'true',
  );
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem('mi-tutora:theme') ?? 'light',
  );
  const [workspaceWidth, setWorkspaceWidth] = useState(() => window.innerWidth);
  const [isSidebarOverlay, setIsSidebarOverlay] = useState(
    () => window.matchMedia('(max-width: 1180px)').matches,
  );
  const sidebarResize = useDragResize({
    ...LAYOUT_SIZE.sidebar,
    storageKey: 'mi-tutora:sidebar-width',
  });
  const sidebarPaneWidth = isSidebarCollapsed ? 76 : sidebarResize.value;
  const compilerMaxWidth = Math.max(
    LAYOUT_SIZE.compiler.min,
    Math.floor(
      workspaceWidth
      - (isSidebarOverlay ? 0 : sidebarPaneWidth)
      - LAYOUT_SIZE.lesson.min,
    ),
  );
  const compilerResize = useDragResize({
    ...LAYOUT_SIZE.compiler,
    max: compilerMaxWidth,
    direction: -1,
    storageKey: 'mi-tutora:compiler-width',
  });
  const persistentCompilerData = compilerData ?? course.compiler;

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return undefined;
    const updateWidth = () => setWorkspaceWidth(workspace.getBoundingClientRect().width);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(workspace);
    updateWidth();
    return () => observer.disconnect();
  }, []);

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
      action: () => setTheme((current) => {
        const nextTheme = current === 'light' ? 'dark' : 'light';
        window.localStorage.setItem('mi-tutora:theme', nextTheme);
        return nextTheme;
      }),
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
        window.dispatchEvent(new CustomEvent('learning-platform:run'));
      },
    },
  ], [minimizeCompiler]);

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
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const nextTheme = current === 'light' ? 'dark' : 'light';
      window.localStorage.setItem('mi-tutora:theme', nextTheme);
      return nextTheme;
    });
  }, []);

  const workspaceStyle = {
    '--sidebar-width': `${sidebarPaneWidth}px`,
    '--compiler-width': `${compilerResize.value}px`,
    '--lesson-pane-min': `${LAYOUT_SIZE.lesson.min}px`,
  };

  return (
    <LearningCompilerProvider controller={learningCompiler}>
    <div className="app-shell" data-theme={theme}>
      <TopNavigation
        course={course}
        onMenuClick={() => setIsDrawerOpen(true)}
        onThemeToggle={toggleTheme}
        theme={theme}
        progress={learningProgress.courseProgress}
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
        </section>
        <aside
          className={`desktop-compiler compiler-dock ${isCompilerMinimized ? 'is-minimized' : 'is-expanded compiler-enter'} is-${compilerStatus}`}
          aria-label={persistentCompilerData.ariaLabel}
        >
          {isCompilerMinimized ? (
            <button
              className="compiler-dock-launcher"
              type="button"
              onClick={toggleCompilerMinimized}
              aria-expanded="false"
              aria-label={compilerStatus === 'running' ? 'Open compiler, code is running' : 'Open compiler'}
              title={compilerStatus === 'running' ? 'Running…' : 'Compiler ready'}
            >
              <span className="compiler-dock-symbol"><Code2 size={ICON_SIZE.md} aria-hidden="true" /></span>
              <span className="compiler-dock-word" aria-hidden="true">Compiler</span>
              <Maximize2 size={ICON_SIZE.sm} aria-hidden="true" />
            </button>
          ) : (
            <div className="compiler-dock-header">
              <span className="compiler-dock-identity">
                <span className="compiler-dock-symbol"><Code2 size={ICON_SIZE.md} aria-hidden="true" /></span>
                <span><strong>Compiler Dock</strong><small>{persistentCompilerData.language} · {compilerStatus}</small></span>
              </span>
              <button
                className="compiler-dock-minimize"
                type="button"
                onClick={minimizeCompiler}
                aria-label="Minimize compiler"
                title="Minimize compiler"
              >
                <Minus size={ICON_SIZE.md} aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="compiler-dock-body" aria-hidden={isCompilerMinimized}>
            <CompilerPanel
              ref={compilerPanelRef}
              compiler={persistentCompilerData}
              onExecutionStateChange={setCompilerStatus}
            />
          </div>
        </aside>
        {!isCompilerMinimized ? (
          <>
            <ResizeHandle
              className="compiler-resize-handle"
              label={course.ui.resizeLabels.compiler}
              min={LAYOUT_SIZE.compiler.min}
              max={compilerMaxWidth}
              value={compilerResize.value}
              onPointerDown={compilerResize.startDragging}
              onKeyDown={compilerResize.handleKeyDown}
            />
          </>
        ) : null}
      </div>
    </div>
    </LearningCompilerProvider>
  );
}
