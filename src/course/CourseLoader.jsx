import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  evictCourseModule,
  loadCourseDocument,
  loadCourseMetadata,
  loadCourseModule,
  resolveCourseLessonModuleNumber,
} from './courseRepository';
import {
  COURSE_SESSION_DEFAULT_CACHE_WINDOW,
  CourseSession,
} from './CourseSession';
import { createCourseNavigation } from './courseNavigation';
import { createCourseModel } from './createCourseModel';

const CourseLoaderContext = createContext(null);

export function CourseLoaderProvider({
  children,
  courseId,
  initialLessonId = null,
  cacheWindow = COURSE_SESSION_DEFAULT_CACHE_WINDOW,
}) {
  const initialLessonIdRef = useRef(initialLessonId);
  const courseDocumentRef = useRef(null);
  const courseEntryRef = useRef(null);
  const sessionRef = useRef(null);
  const [courseSession, setCourseSession] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [currentLessonId, setCurrentLessonId] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [backgroundError, setBackgroundError] = useState(null);

  const createSessionCourseModel = useCallback((session) => {
    if (!courseDocumentRef.current || !session) return null;
    const snapshot = session.getSnapshot();
    const totalModuleCount = courseEntryRef.current?.moduleCount ?? snapshot.modules.length;
    let contiguousModuleCount = 0;
    const knownModules = new Set(snapshot.knownModuleNumbers);
    while (knownModules.has(contiguousModuleCount + 1)) contiguousModuleCount += 1;
    return createCourseModel({
      ...courseDocumentRef.current,
      modules: snapshot.modules,
      contentLoadState: {
        isComplete: snapshot.knownModuleNumbers.length === totalModuleCount,
        loadedModuleNumbers: snapshot.loadedModuleNumbers,
        contiguousModuleCount,
        totalModuleCount,
        totalLessonCount: courseEntryRef.current?.lessonCount
          ?? snapshot.modules.reduce((total, module) => total + module.lessons.length, 0),
        cacheWindow: snapshot.cacheWindow,
        activeModuleNumber: snapshot.activeModuleNumber,
      },
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourse() {
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setCourseSession(null);
      setSessionState(null);
      setStatus('loading');
      setError(null);
      setBackgroundError(null);
      courseDocumentRef.current = null;
      courseEntryRef.current = null;

      try {
        const loadedMetadata = await loadCourseMetadata(controller.signal, courseId);
        const {
          course: courseDocument,
          courseEntry,
          initialModuleNumber,
          provider,
        } = await loadCourseDocument(
          loadedMetadata,
          courseId,
          controller.signal,
          initialLessonIdRef.current,
        );
        if (controller.signal.aborted) return;

        let course;
        if (provider === 'firebase' && courseEntry) {
          const { modules, ...courseFields } = courseDocument;
          courseDocumentRef.current = courseFields;
          courseEntryRef.current = courseEntry;
          const session = new CourseSession({
            moduleCount: courseEntry.moduleCount,
            outlineModules: modules,
            cacheWindow,
            loadModule: (moduleNumber) => loadCourseModule(courseEntry, moduleNumber),
            evictModule: (moduleNumber) => evictCourseModule(courseEntry, moduleNumber),
            onError: (moduleError) => setBackgroundError(moduleError),
          });
          if (initialModuleNumber && modules[initialModuleNumber - 1]) {
            session.prime(initialModuleNumber, modules[initialModuleNumber - 1]);
          }
          sessionRef.current = session;
          course = createSessionCourseModel(session);
          setSessionState(session.getSnapshot());
          setCourseSession(session);
        } else {
          courseEntryRef.current = courseEntry;
          course = createCourseModel(courseDocument);
        }

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
  }, [cacheWindow, courseId, createSessionCourseModel]);

  useEffect(() => {
    if (!courseSession) return undefined;
    const synchronizeSession = (snapshot) => {
      if (sessionRef.current !== courseSession) return;
      setSessionState(snapshot);
      setCurrentCourse(createSessionCourseModel(courseSession));
    };
    const unsubscribe = courseSession.subscribe(synchronizeSession);
    courseSession.prefetchNext();
    return () => {
      unsubscribe();
      courseSession.dispose();
    };
  }, [courseSession, createSessionCourseModel]);

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

  const selectLesson = useCallback(async (lessonId) => {
    const session = sessionRef.current;
    if (!session) {
      if (courseNavigation?.canNavigateTo(lessonId)) setCurrentLessonId(lessonId);
      return;
    }

    const courseEntry = courseEntryRef.current;
    const moduleNumber = resolveCourseLessonModuleNumber(lessonId, courseEntry.moduleCount);
    if (!moduleNumber) return;
    if (session.hasModule(moduleNumber) && courseNavigation?.canNavigateTo(lessonId)) {
      session.activate(moduleNumber);
      setCurrentLessonId(lessonId);
      return;
    }

    try {
      const module = await session.activate(moduleNumber);
      if (sessionRef.current !== session) return;
      if (module.lessons.some((lesson) => lesson.id === lessonId)) {
        setCurrentLessonId(lessonId);
      }
    } catch (moduleError) {
      if (sessionRef.current === session) setBackgroundError(moduleError);
    }
  }, [courseNavigation]);

  const goToPreviousLesson = useCallback(() => {
    if (lessonState.previousLesson) selectLesson(lessonState.previousLesson.id);
  }, [lessonState.previousLesson, selectLesson]);

  const goToNextLesson = useCallback((branchId) => {
    const selectedOption = typeof branchId === 'string'
      ? lessonState.nextLessonOptions.find((option) => option.id === branchId)
      : null;
    const target = selectedOption?.lesson ?? lessonState.nextLesson;
    if (target) selectLesson(target.id);
  }, [lessonState.nextLesson, lessonState.nextLessonOptions, selectLesson]);

  const value = useMemo(() => ({
    metadata,
    currentCourse,
    ...lessonState,
    status,
    error,
    backgroundError,
    isLoading: status === 'loading',
    isPrefetching: sessionState?.isPrefetching ?? false,
    courseSession: sessionState,
    selectLesson,
    goToPreviousLesson,
    goToNextLesson,
  }), [
    metadata,
    currentCourse,
    lessonState,
    status,
    error,
    backgroundError,
    sessionState,
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
  if (!context) throw new Error('useCourseLoader must be used inside CourseLoaderProvider.');
  return context;
}
