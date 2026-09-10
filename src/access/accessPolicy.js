export const FREE_PREVIEW_LESSON_COUNT = 3;

export const ACCESS_FEATURES = Object.freeze({
  COURSE_PREMIUM_LESSON: 'COURSE_PREMIUM_LESSON',
  PROJECTS: 'PROJECTS',
  AI_TUTOR: 'AI_TUTOR',
  CERTIFICATES: 'CERTIFICATES',
  PRACTICE: 'PRACTICE',
  CHALLENGES: 'CHALLENGES',
  BOOKMARKS: 'BOOKMARKS',
});

const FREE_FEATURES = new Set([ACCESS_FEATURES.PRACTICE, ACCESS_FEATURES.CHALLENGES, ACCESS_FEATURES.BOOKMARKS]);

export function canAccessFeature({ tier, feature }) {
  return tier === 'PREMIUM' || FREE_FEATURES.has(feature);
}

export function canAccessLesson({ tier, lessonIndex }) {
  return Number.isInteger(lessonIndex) && lessonIndex >= 0
    && (lessonIndex < FREE_PREVIEW_LESSON_COUNT || tier === 'PREMIUM');
}

export function canonicalLessonIndex(course, lessonId) {
  const lessons = (course?.modules ?? []).flatMap((module) => module.sections?.length
    ? module.sections.flatMap((section) => section.lessons ?? [])
    : module.lessons ?? []);
  return lessons.findIndex((lesson) => lesson.id === lessonId);
}
