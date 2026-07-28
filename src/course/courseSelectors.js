import { createCourseNavigation } from './courseNavigation';

export function selectLessonState(course, currentLessonId) {
  return createCourseNavigation(course).getState(currentLessonId);
}
