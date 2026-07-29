import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { userRepository as defaultRepository } from './userRepository';

const UserContext = createContext(null);

function createUserProfile(profile) {
  return {
    id:
      profile.id ??
      globalThis.crypto?.randomUUID?.() ??
      `local-user-${Date.now()}`,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
    learningPreferences: {
      experienceLevel: profile.learningPreferences?.experienceLevel ?? 'beginner',
      preferredLanguage: profile.learningPreferences?.preferredLanguage ?? 'English',
      dailyGoalMinutes: profile.learningPreferences?.dailyGoalMinutes ?? 20,
    },
    completedLessons: profile.completedLessons ?? [],
    visitedLessons: profile.visitedLessons ?? [],
    bookmarks: profile.bookmarks ?? [],
    currentLesson: profile.currentLesson ?? null,
    sequentialCompletedLessons: profile.sequentialCompletedLessons ?? 0,
    courseProgress: profile.courseProgress ?? 0,
  };
}

export function UserProvider({ children, repository = defaultRepository }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;

    repository.loadCurrentUser().then((storedUser) => {
      if (!active) return;
      setUser(storedUser);
      setStatus(storedUser ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
    };
  }, [repository]);

  const persistUser = useCallback((updater) => {
    setUser((current) => {
      const updated = typeof updater === 'function' ? updater(current) : updater;
      repository.saveCurrentUser(updated);
      return updated;
    });
  }, [repository]);

  const signIn = useCallback(async ({ email }) => {
    const storedUser = await repository.loadProfile();
    if (!storedUser || storedUser.email.toLowerCase() !== email.toLowerCase()) {
      return { success: false, message: 'No local profile was found for this email.' };
    }

    await repository.saveCurrentUser(storedUser);
    setUser(storedUser);
    setStatus('authenticated');
    return { success: true };
  }, [repository]);

  const createProfile = useCallback(async (profile) => {
    const newUser = createUserProfile(profile);
    await repository.saveCurrentUser(newUser);
    setUser(newUser);
    setStatus('authenticated');
  }, [repository]);

  const signOut = useCallback(async () => {
    await repository.clearSession();
    setUser(null);
    setStatus('unauthenticated');
  }, [repository]);

  const forgetLocalProfile = useCallback(async () => {
    await repository.deleteProfile();
    setUser(null);
    setStatus('unauthenticated');
  }, [repository]);

  const updateProfile = useCallback((updates) => {
    persistUser((current) => ({ ...current, ...updates }));
  }, [persistUser]);

  const updateLearningPreferences = useCallback((updates) => {
    persistUser((current) => ({
      ...current,
      learningPreferences: { ...current.learningPreferences, ...updates },
    }));
  }, [persistUser]);

  const setCurrentLesson = useCallback((lessonId) => {
    persistUser((current) =>
      current?.currentLesson === lessonId ? current : { ...current, currentLesson: lessonId },
    );
  }, [persistUser]);

  const markLessonComplete = useCallback((lessonId) => {
    persistUser((current) => ({
      ...current,
      completedLessons: current.completedLessons.includes(lessonId)
        ? current.completedLessons
        : [...current.completedLessons, lessonId],
    }));
  }, [persistUser]);

  const toggleBookmark = useCallback((lessonId) => {
    persistUser((current) => ({
      ...current,
      bookmarks: current.bookmarks.includes(lessonId)
        ? current.bookmarks.filter((id) => id !== lessonId)
        : [...current.bookmarks, lessonId],
    }));
  }, [persistUser]);

  const value = useMemo(() => ({
    user,
    status,
    isAuthenticated: status === 'authenticated',
    signIn,
    signOut,
    createProfile,
    forgetLocalProfile,
    updateProfile,
    updateLearningPreferences,
    setCurrentLesson,
    markLessonComplete,
    toggleBookmark,
  }), [
    user,
    status,
    signIn,
    signOut,
    createProfile,
    forgetLocalProfile,
    updateProfile,
    updateLearningPreferences,
    setCurrentLesson,
    markLessonComplete,
    toggleBookmark,
  ]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used inside UserProvider.');
  return context;
}
