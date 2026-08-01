import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { progressRepository as defaultRepository } from './progressRepository';

const LearningProgressContext = createContext(null);

function getEstimatedMinutes(lesson) {
  if (Number.isFinite(lesson.estimatedMinutes)) return lesson.estimatedMinutes;
  const detail = lesson.details?.find((item) => /\d+\s*min/i.test(item));
  return detail ? Number.parseInt(detail, 10) : 10;
}

function getCourseLessons(course) {
  return course.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ lesson, module })),
  );
}

function getModuleIdForLesson(course, lessonId) {
  return course.modules.find((module) =>
    module.lessons.some((lesson) => lesson.id === lessonId))?.id ?? null;
}

function deriveProgress(course, stored) {
  const entries = getCourseLessons(course);
  const lessonIds = new Set(entries.map(({ lesson }) => lesson.id));
  const completedLessons = [...new Set(stored.completedLessons ?? [])]
    .filter((lessonId) => lessonIds.has(lessonId));
  const completedSet = new Set(completedLessons);
  const visitedLessons = [...new Set([
    ...(stored.visitedLessons ?? []),
    ...completedLessons,
  ])].filter((lessonId) => lessonIds.has(lessonId));
  let sequentialCompletedLessons = 0;
  for (const { lesson } of entries) {
    if (!completedSet.has(lesson.id)) break;
    sequentialCompletedLessons += 1;
  }
  const completedModules = course.modules
    .filter((module) => {
      const availableLessons = module.lessons.filter((lesson) => lessonIds.has(lesson.id));
      return availableLessons.length > 0
        && availableLessons.every((lesson) => completedSet.has(lesson.id));
    })
    .map((module) => module.id);
  const estimatedTimeRemaining = entries.reduce(
    (minutes, { lesson }) =>
      completedSet.has(lesson.id) ? minutes : minutes + getEstimatedMinutes(lesson),
    0,
  );

  return {
    ...stored,
    completedLessons,
    visitedLessons,
    completedModules,
    bookmarks: [...new Set(stored.bookmarks ?? [])].filter((lessonId) => lessonIds.has(lessonId)),
    quizScores: stored.quizScores ?? {},
    exerciseCompletion: stored.exerciseCompletion ?? {},
    sequentialCompletedLessons,
    visitedLessonCount: visitedLessons.length,
    completedLessonCount: completedLessons.length,
    courseProgress: entries.length
      ? Math.round((sequentialCompletedLessons / entries.length) * 100)
      : 0,
    estimatedTimeRemaining,
  };
}

function createInitialProgress(
  course,
  currentLessonId,
  existingCompletedLessons = [],
  existingBookmarks = [],
  existingVisitedLessons = [],
) {
  const completedLessons = [...existingCompletedLessons, ...course.modules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.status === 'complete')
      .map((lesson) => lesson.id),
  )];

  const currentLesson = currentLessonId ?? course.navigation?.defaultLessonId ?? course.defaultLessonId;
  return deriveProgress(course, {
    currentLesson,
    currentModule: getModuleIdForLesson(course, currentLesson),
    completedLessons,
    visitedLessons: [...new Set(existingVisitedLessons)],
    completedModules: [],
    quizScores: {},
    exerciseCompletion: {},
    bookmarks: [...new Set(existingBookmarks)],
    courseProgress: 0,
    sequentialCompletedLessons: 0,
    visitedLessonCount: 0,
    completedLessonCount: 0,
    estimatedTimeRemaining: 0,
    updatedAt: null,
  });
}

export function LearningProgressProvider({
  children,
  course,
  userId,
  initialLessonId,
  initialCompletedLessons = [],
  initialBookmarks = [],
  initialVisitedLessons = [],
  repository = defaultRepository,
}) {
  const initialLessonIdRef = useRef(initialLessonId);
  const initialCompletedLessonsRef = useRef(initialCompletedLessons);
  const initialBookmarksRef = useRef(initialBookmarks);
  const initialVisitedLessonsRef = useRef(initialVisitedLessons);
  const [progress, setProgress] = useState(() =>
    createInitialProgress(
      course,
      initialLessonIdRef.current,
      initialCompletedLessonsRef.current,
      initialBookmarksRef.current,
      initialVisitedLessonsRef.current,
    ));
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;

    repository.load(userId, course.id).then((stored) => {
      if (!active) return;
      const initial = createInitialProgress(
        course,
        initialLessonIdRef.current,
        initialCompletedLessonsRef.current,
        initialBookmarksRef.current,
        initialVisitedLessonsRef.current,
      );
      const restored = stored
        ? {
            ...initial,
            ...stored,
            completedLessons: [
              ...initial.completedLessons,
              ...(stored.completedLessons ?? []),
            ],
            visitedLessons: [
              ...initialVisitedLessonsRef.current,
              ...(stored.visitedLessons ?? []),
            ],
            bookmarks: [
              ...initial.bookmarks,
              ...(stored.bookmarks ?? []),
            ],
          }
        : initial;
      setProgress(deriveProgress(course, restored));
      setStatus('ready');
    }).catch((loadError) => {
      if (!active) return;
      console.error('[Progress] Unable to load saved progress.', loadError);
      setStatus('error');
    });

    return () => {
      active = false;
    };
  }, [course, repository, userId]);

  const updateProgress = useCallback((updater) => {
    setProgress((current) => {
      const updated = typeof updater === 'function' ? updater(current) : updater;
      if (updated === current) return current;
      const next = deriveProgress(course, {
        ...updated,
        updatedAt: new Date().toISOString(),
      });
      repository.save(userId, course.id, next).catch((saveError) => {
        console.error('[Progress] Unable to save progress.', saveError);
      });
      return next;
    });
  }, [course, repository, userId]);

  const setCurrentLesson = useCallback((lessonId) => {
    updateProgress((current) =>
      current.currentLesson === lessonId ? current : {
        ...current,
        currentLesson: lessonId,
        currentModule: getModuleIdForLesson(course, lessonId),
      });
  }, [course, updateProgress]);

  const completeLesson = useCallback((lessonId) => {
    updateProgress((current) => ({
      ...current,
      completedLessons: current.completedLessons.includes(lessonId)
        ? current.completedLessons
        : [...current.completedLessons, lessonId],
    }));
  }, [updateProgress]);

  const markLessonVisited = useCallback((lessonId) => {
    updateProgress((current) =>
      current.visitedLessons.includes(lessonId)
        ? current
        : { ...current, visitedLessons: [...current.visitedLessons, lessonId] });
  }, [updateProgress]);

  const recordQuizScore = useCallback((
    quizId,
    score,
    maxScore = 1,
    passed = score === maxScore,
  ) => {
    updateProgress((current) => {
      const previous = current.quizScores[quizId];
      return {
        ...current,
        quizScores: {
          ...current.quizScores,
          [quizId]: {
            score,
            maxScore,
            percentage: maxScore ? Math.round((score / maxScore) * 100) : 0,
            passed,
            attempts: (previous?.attempts ?? 0) + 1,
            lastAttemptAt: new Date().toISOString(),
          },
        },
      };
    });
  }, [updateProgress]);

  const completeExercise = useCallback((exerciseId) => {
    updateProgress((current) => {
      const exercise = current.exerciseCompletion[exerciseId];
      if (!exercise?.verified) return current;
      return {
        ...current,
        exerciseCompletion: {
          ...current.exerciseCompletion,
          [exerciseId]: {
            ...exercise,
            completed: true,
            completedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, [updateProgress]);

  const verifyExercise = useCallback((exerciseId, verification) => {
    updateProgress((current) => ({
      ...current,
      exerciseCompletion: {
        ...current.exerciseCompletion,
        [exerciseId]: {
          ...current.exerciseCompletion[exerciseId],
          completed: current.exerciseCompletion[exerciseId]?.completed ?? false,
          verified: true,
          expectedOutput: verification.expectedOutput,
          programOutput: verification.programOutput,
          verifiedAt: new Date().toISOString(),
        },
      },
    }));
  }, [updateProgress]);

  const invalidateExerciseVerification = useCallback((exerciseId) => {
    updateProgress((current) => {
      const exercise = current.exerciseCompletion[exerciseId];
      if (!exercise?.verified || exercise.completed) return current;
      return {
        ...current,
        exerciseCompletion: {
          ...current.exerciseCompletion,
          [exerciseId]: {
            ...exercise,
            verified: false,
            verifiedAt: null,
          },
        },
      };
    });
  }, [updateProgress]);

  const toggleBookmark = useCallback((lessonId) => {
    updateProgress((current) => ({
      ...current,
      bookmarks: current.bookmarks.includes(lessonId)
        ? current.bookmarks.filter((id) => id !== lessonId)
        : [...current.bookmarks, lessonId],
    }));
  }, [updateProgress]);

  const resetCourse = useCallback(() => {
    const defaultLesson = course.navigation?.defaultLessonId ?? course.defaultLessonId;
    updateProgress((current) => ({
      ...current,
      currentLesson: defaultLesson,
      currentModule: getModuleIdForLesson(course, defaultLesson),
      completedLessons: [],
      visitedLessons: [],
      completedModules: [],
      quizScores: {},
      exerciseCompletion: {},
    }));
  }, [course, updateProgress]);

  const markAllLessonsComplete = useCallback(() => {
    const lessonIds = getCourseLessons(course).map(({ lesson }) => lesson.id);
    updateProgress((current) => ({
      ...current,
      completedLessons: lessonIds,
      visitedLessons: lessonIds,
    }));
  }, [course, updateProgress]);

  const resetLearningProgress = useCallback(() => {
    const defaultLesson = course.navigation?.defaultLessonId ?? course.defaultLessonId;
    updateProgress((current) => ({
      ...current,
      currentLesson: defaultLesson,
      currentModule: getModuleIdForLesson(course, defaultLesson),
      completedLessons: [],
      visitedLessons: [],
      completedModules: [],
    }));
  }, [course, updateProgress]);

  const resetQuizAttempts = useCallback(() => {
    updateProgress((current) => ({ ...current, quizScores: {} }));
  }, [updateProgress]);

  const resetExerciseAttempts = useCallback(() => {
    updateProgress((current) => ({ ...current, exerciseCompletion: {} }));
  }, [updateProgress]);

  const value = useMemo(() => ({
    ...progress,
    status,
    setCurrentLesson,
    completeLesson,
    markLessonVisited,
    recordQuizScore,
    completeExercise,
    verifyExercise,
    invalidateExerciseVerification,
    toggleBookmark,
    resetCourse,
    markAllLessonsComplete,
    resetLearningProgress,
    resetQuizAttempts,
    resetExerciseAttempts,
    isLessonComplete: (lessonId) => progress.completedLessons.includes(lessonId),
    isModuleComplete: (moduleId) => progress.completedModules.includes(moduleId),
    isBookmarked: (lessonId) => progress.bookmarks.includes(lessonId),
  }), [
    progress,
    status,
    setCurrentLesson,
    completeLesson,
    markLessonVisited,
    recordQuizScore,
    completeExercise,
    verifyExercise,
    invalidateExerciseVerification,
    toggleBookmark,
    resetCourse,
    markAllLessonsComplete,
    resetLearningProgress,
    resetQuizAttempts,
    resetExerciseAttempts,
  ]);

  return (
    <LearningProgressContext.Provider value={value}>
      {children}
    </LearningProgressContext.Provider>
  );
}

export function useLearningProgress() {
  const context = useContext(LearningProgressContext);
  if (!context) {
    throw new Error('useLearningProgress must be used inside LearningProgressProvider.');
  }
  return context;
}

export function useOptionalLearningProgress() {
  return useContext(LearningProgressContext);
}
