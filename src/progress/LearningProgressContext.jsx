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
    module.lessons
      .filter((lesson) => !['locked', 'coming-soon'].includes(lesson.status))
      .map((lesson) => ({ lesson, module })),
  );
}

function deriveProgress(course, stored) {
  const entries = getCourseLessons(course);
  const lessonIds = new Set(entries.map(({ lesson }) => lesson.id));
  const completedLessons = [...new Set(stored.completedLessons ?? [])]
    .filter((lessonId) => lessonIds.has(lessonId));
  const completedSet = new Set(completedLessons);
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
    completedModules,
    bookmarks: [...new Set(stored.bookmarks ?? [])].filter((lessonId) => lessonIds.has(lessonId)),
    quizScores: stored.quizScores ?? {},
    exerciseCompletion: stored.exerciseCompletion ?? {},
    courseProgress: entries.length
      ? Math.round((completedLessons.length / entries.length) * 100)
      : 0,
    estimatedTimeRemaining,
  };
}

function createInitialProgress(
  course,
  currentLessonId,
  existingCompletedLessons = [],
  existingBookmarks = [],
) {
  const completedLessons = [...existingCompletedLessons, ...course.modules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.status === 'complete')
      .map((lesson) => lesson.id),
  )];

  return deriveProgress(course, {
    currentLesson: currentLessonId ?? course.navigation?.defaultLessonId ?? course.defaultLessonId,
    completedLessons,
    completedModules: [],
    quizScores: {},
    exerciseCompletion: {},
    bookmarks: [...new Set(existingBookmarks)],
    courseProgress: 0,
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
  repository = defaultRepository,
}) {
  const initialLessonIdRef = useRef(initialLessonId);
  const initialCompletedLessonsRef = useRef(initialCompletedLessons);
  const initialBookmarksRef = useRef(initialBookmarks);
  const [progress, setProgress] = useState(() =>
    createInitialProgress(
      course,
      initialLessonIdRef.current,
      initialCompletedLessonsRef.current,
      initialBookmarksRef.current,
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
      );
      const restored = stored
        ? {
            ...initial,
            ...stored,
            completedLessons: [
              ...initial.completedLessons,
              ...(stored.completedLessons ?? []),
            ],
            bookmarks: [
              ...initial.bookmarks,
              ...(stored.bookmarks ?? []),
            ],
          }
        : initial;
      setProgress(deriveProgress(course, restored));
      setStatus('ready');
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
      repository.save(userId, course.id, next);
      return next;
    });
  }, [course, repository, userId]);

  const setCurrentLesson = useCallback((lessonId) => {
    updateProgress((current) =>
      current.currentLesson === lessonId ? current : { ...current, currentLesson: lessonId });
  }, [updateProgress]);

  const completeLesson = useCallback((lessonId) => {
    updateProgress((current) => ({
      ...current,
      completedLessons: current.completedLessons.includes(lessonId)
        ? current.completedLessons
        : [...current.completedLessons, lessonId],
    }));
  }, [updateProgress]);

  const recordQuizScore = useCallback((quizId, score, maxScore = 1) => {
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
            attempts: (previous?.attempts ?? 0) + 1,
            lastAttemptAt: new Date().toISOString(),
          },
        },
      };
    });
  }, [updateProgress]);

  const completeExercise = useCallback((exerciseId) => {
    updateProgress((current) => ({
      ...current,
      exerciseCompletion: {
        ...current.exerciseCompletion,
        [exerciseId]: {
          completed: true,
          completedAt: new Date().toISOString(),
        },
      },
    }));
  }, [updateProgress]);

  const toggleBookmark = useCallback((lessonId) => {
    updateProgress((current) => ({
      ...current,
      bookmarks: current.bookmarks.includes(lessonId)
        ? current.bookmarks.filter((id) => id !== lessonId)
        : [...current.bookmarks, lessonId],
    }));
  }, [updateProgress]);

  const value = useMemo(() => ({
    ...progress,
    status,
    setCurrentLesson,
    completeLesson,
    recordQuizScore,
    completeExercise,
    toggleBookmark,
    isLessonComplete: (lessonId) => progress.completedLessons.includes(lessonId),
    isModuleComplete: (moduleId) => progress.completedModules.includes(moduleId),
    isBookmarked: (lessonId) => progress.bookmarks.includes(lessonId),
  }), [
    progress,
    status,
    setCurrentLesson,
    completeLesson,
    recordQuizScore,
    completeExercise,
    toggleBookmark,
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
