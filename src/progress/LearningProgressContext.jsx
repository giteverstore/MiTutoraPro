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
import { trustedCompletionService as defaultTrustedCompletionService } from './TrustedCompletionService';
import { phase5Mark } from '../performance/phase5Mark.js';
import { createInitialProgress, deriveProgress, getCourseLessons, getModuleIdForLesson } from './learningProgressModel.js';

const LearningProgressContext = createContext(null);

export function LearningProgressProvider({
  children,
  course,
  userId,
  initialLessonId,
  initialCompletedLessons = [],
  initialBookmarks = [],
  initialVisitedLessons = [],
  initialStoredProgress,
  repository = defaultRepository,
  trustedCompletionService = defaultTrustedCompletionService,
}) {
  const courseRef = useRef(course);
  courseRef.current = course;
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
    phase5Mark('course:progress-hydrate:start', { courseId: course.id, reusedPinRecord: initialStoredProgress !== undefined });

    (initialStoredProgress !== undefined
      ? Promise.resolve(initialStoredProgress)
      : repository.load(userId, course.id)).then((stored) => {
      if (!active) return;
      const activeCourse = courseRef.current;
      const initial = createInitialProgress(
        activeCourse,
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
      setProgress(deriveProgress(activeCourse, restored));
      setStatus('ready');
      phase5Mark('course:progress-hydrate:end', { courseId: course.id });
    }).catch((loadError) => {
      if (!active) return;
      console.error('[Progress] Unable to load saved progress.', loadError);
      setStatus('error');
    });

    return () => {
      active = false;
    };
  }, [course.id, initialStoredProgress, repository, userId]);

  useEffect(() => {
    setProgress((current) => deriveProgress(course, current));
  }, [course]);

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

  const completeLesson = useCallback(async (lessonId) => {
    if (progress.completedLessons.includes(lessonId)) return;
    if (course.publishedVersion) {
      await trustedCompletionService.recordLessonCompletion(course.id, course.publishedVersion, lessonId);
      updateProgress((current) => current.completedLessons.includes(lessonId)
        ? current
        : { ...current, completedLessons: [...current.completedLessons, lessonId] });
      return;
    }
    const updatedAt = new Date().toISOString();
    const next = deriveProgress(course, { ...progress, completedLessons: [...progress.completedLessons, lessonId], updatedAt });
    await repository.save(userId, course.id, next);
    setProgress((current) => deriveProgress(course, {
      ...current,
      completedLessons: [...new Set([...current.completedLessons, lessonId])],
      updatedAt,
    }));
  }, [course, progress, repository, trustedCompletionService, updateProgress, userId]);

  const markLessonVisited = useCallback((lessonId) => {
    if (course.publishedVersion) {
      trustedCompletionService.beginLessonEvidence(course.id, course.publishedVersion, lessonId)
        .catch((error) => console.error('[Progress] Unable to begin trusted lesson evidence.', error));
    }
    updateProgress((current) =>
      current.visitedLessons.includes(lessonId)
        ? current
        : { ...current, visitedLessons: [...current.visitedLessons, lessonId] });
  }, [course.id, course.publishedVersion, trustedCompletionService, updateProgress]);

  const recordQuizScore = useCallback((
    quizId,
    score,
    maxScore = 1,
    passed = score === maxScore,
    selectedOptionIds = [],
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
            selectedOptionIds: [...selectedOptionIds],
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
      if (exercise?.completed) return current;
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
          sourceCode: verification.sourceCode,
          compilerId: verification.compilerId,
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
