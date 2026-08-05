import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { loadCourseDocument, loadCourseMetadata } from './courseRepository';
import { createCourseNavigation } from './courseNavigation';
import { createCourseModel } from './createCourseModel';

const CourseLoaderContext = createContext(null);

export function CourseLoaderProvider({ children, courseId, initialLessonId = null }) {
  console.log('[TRACE] CourseLoaderProvider');
  const initialLessonIdRef = useRef(initialLessonId);
  const [metadata, setMetadata] = useState(null);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [currentLessonId, setCurrentLessonId] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourse() {
      console.log('[TRACE] CourseLoaderProvider.loadCourse');
      setStatus('loading');
      setError(null);

      try {
        const loadedMetadata = await loadCourseMetadata(controller.signal, courseId);
        const { course: courseDocument } = await loadCourseDocument(
          loadedMetadata,
          courseId,
          controller.signal,
        );
        const course = createCourseModel(courseDocument);

        setMetadata(loadedMetadata);
        setCurrentCourse(course);
        const storedLessonExists = course.modules.some((module) =>
          module.lessons.some((lesson) => lesson.id === initialLessonIdRef.current),
        );
        setCurrentLessonId(
          storedLessonExists
            ? initialLessonIdRef.current
            : course.navigation?.defaultLessonId ?? course.defaultLessonId,
        );
        setStatus('ready');
      } catch (loadError) {
        if (loadError.name === 'AbortError') return;
        setError(loadError);
        setStatus('error');
      }
    }

    loadCourse();
    return () => controller.abort();
  }, [courseId]);

  const courseNavigation = useMemo(
    () => currentCourse ? createCourseNavigation(currentCourse) : null,
    [currentCourse],
  );

  const lessonState = useMemo(
    () => courseNavigation
      ? courseNavigation.getState(currentLessonId)
      : {
          currentModule: null,
          currentLesson: null,
          previousLesson: null,
          nextLesson: null,
          nextLessonOptions: [],
          currentBlockList: [],
        },
    [courseNavigation, currentLessonId],
  );

  const selectLesson = useCallback((lessonId) => {
    if (courseNavigation?.canNavigateTo(lessonId)) {
      setCurrentLessonId(lessonId);
    }
  }, [courseNavigation]);

  const goToPreviousLesson = useCallback(() => {
    if (lessonState.previousLesson) {
      setCurrentLessonId(lessonState.previousLesson.id);
    }
  }, [lessonState.previousLesson]);

  const goToNextLesson = useCallback((branchId) => {
    const selectedOption = typeof branchId === 'string'
      ? lessonState.nextLessonOptions.find((option) => option.id === branchId)
      : null;
    const target = selectedOption?.lesson ?? lessonState.nextLesson;

    if (target) {
      setCurrentLessonId(target.id);
    }
  }, [lessonState.nextLesson, lessonState.nextLessonOptions]);

  const value = useMemo(() => ({
    metadata,
    currentCourse,
    ...lessonState,
    status,
    error,
    isLoading: status === 'loading',
    selectLesson,
    goToPreviousLesson,
    goToNextLesson,
  }), [
    metadata,
    currentCourse,
    lessonState,
    status,
    error,
    selectLesson,
    goToPreviousLesson,
    goToNextLesson,
  ]);

  return (
    <CourseLoaderContext.Provider value={value}>
      {children}
    </CourseLoaderContext.Provider>
  );
}

export function useCourseLoader() {
  const context = useContext(CourseLoaderContext);

  if (!context) {
    throw new Error('useCourseLoader must be used inside CourseLoaderProvider.');
  }

  return context;
}
