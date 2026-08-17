import { getModuleLessons, mapModuleLessons } from './courseStructure.js';

const DEFAULT_UI = Object.freeze({
  emptyLesson: {
    title: 'Nothing here yet',
    description: 'Lesson content will appear here when blocks are available.',
  },
  emptyCourse: {
    title: 'No lesson selected',
    description: 'Choose an available lesson to begin learning.',
  },
  emptyModules: {
    title: 'No modules yet',
    description: 'Course modules will appear here when available.',
  },
  shortcuts: {
    menu: 'M',
    theme: 'D',
    run: 'Ctrl + Enter',
    close: 'Escape',
  },
  resizeLabels: {
    sidebar: 'Resize course sidebar',
    compiler: 'Resize compiler panel',
    output: 'Resize editor and output panels',
  },
});

function createCompilerModel(course) {
  const language = course.metadata?.tags?.includes('python') ? 'Python' : 'Code';

  return {
    ariaLabel: `${language} practice compiler`,
    eyebrow: 'Practice workspace',
    title: 'Compiler',
    status: 'Ready',
    languageLabel: 'Language',
    language,
    resetLabel: 'Reset code',
    runLabel: 'Run',
    runningLabel: 'Running…',
    runShortcut: 'Ctrl + Enter',
    resizeLabel: DEFAULT_UI.resizeLabels.output,
    editor: {
      fileName: language === 'Python' ? 'main.py' : 'main.txt',
      unsavedLabel: 'Unsaved changes',
      ariaLabel: `${language} code editor`,
      lines: [
        {
          number: 1,
          text: language === 'Python' ? '# Write your Python code here' : '// Write your code here',
          tone: 'comment',
        },
        { number: 2, text: '', tone: 'source' },
      ],
    },
    output: {
      outputTabLabel: 'Output',
      errorsTabLabel: 'Errors',
      errorCount: 0,
      prompt: '>_',
      emptyTitle: 'Output will appear here',
      emptyDescription: 'Run your code to see the result.',
      errorTitle: 'No errors',
      errorDescription: 'Compiler errors will appear here.',
    },
    footerItems: [`Language: ${language}`],
  };
}

function createNavigationModel(course) {
  const navigation = course.navigation ?? {};
  const labels = navigation.labels ?? {};

  return {
    ...navigation,
    currentLessonLabel:
      navigation.currentLessonLabel ?? labels.currentLesson ?? 'Current lesson',
    progressLabel:
      navigation.progressLabel ?? labels.progress ?? 'Course progress',
    previousLabel:
      navigation.previousLabel ?? labels.previous ?? 'Previous lesson',
    nextLabel:
      navigation.nextLabel ?? labels.next ?? 'Next lesson',
    openMenuLabel: navigation.openMenuLabel ?? 'Open course navigation',
    darkModeLabel: navigation.darkModeLabel ?? 'Use dark mode',
    lightModeLabel: navigation.lightModeLabel ?? 'Use light mode',
  };
}

function createSidebarModel(course) {
  return {
    eyebrow: 'Your learning path',
    navigationLabel: 'Course modules',
    closeLabel: 'Close course navigation',
    support: {
      icon: '?',
      title: 'Need a hand?',
      description: 'Review the lesson examples and hints',
    },
    ...course.sidebar,
  };
}

/**
 * Maps the canonical Learning Engine schema to the view model consumed by the
 * existing UI shell. Author-provided modules, lessons, IDs, navigation, and
 * blocks are preserved.
 */
export function createCourseModel(course) {
  const level = course.metadata?.level;

  return {
    ...course,
    name: course.name ?? course.title,
    shortMark: course.shortMark ?? (course.title?.trim().charAt(0).toUpperCase() || 'C'),
    categoryLabel:
      course.categoryLabel ?? (level ? `${level} course` : 'Learning course'),
    navigation: createNavigationModel(course),
    ui: {
      ...DEFAULT_UI,
      ...course.ui,
      shortcuts: { ...DEFAULT_UI.shortcuts, ...course.ui?.shortcuts },
      resizeLabels: { ...DEFAULT_UI.resizeLabels, ...course.ui?.resizeLabels },
    },
    sidebar: createSidebarModel(course),
    compiler: course.compiler ?? createCompilerModel(course),
    modules: course.modules.map((module) => {
      const lessons = getModuleLessons(module);
      return mapModuleLessons({
        ...module,
        meta: module.meta ?? `${lessons.length} lessons`,
        initiallyOpen: module.initiallyOpen ?? module.initiallyExpanded ?? false,
      }, (lesson) => ({
        ...lesson,
        numberLabel:
          lesson.numberLabel ?? (lesson.number ? `Lesson ${lesson.number}` : 'Lesson'),
        details: lesson.details ?? [
          `${lesson.estimatedMinutes ?? 10} min`,
          ...(lesson.tags?.slice(0, 1) ?? []),
          ...(level ? [level] : []),
        ],
      }));
    }),
  };
}
