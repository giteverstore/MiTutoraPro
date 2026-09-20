import { findCatalogCourse } from './homeData';

const timestamp = (value) => {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

function boundedProgress(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(100, Math.max(0, Math.round(numeric))) : null;
}

export function createHomeLearningModel({ progressRecords = [], recentCourseIds = [], challengesCompleted = 0 } = {}) {
  const enrollments = progressRecords.map((progress) => {
    const course = findCatalogCourse(progress.courseId ?? progress.id);
    return course ? {
      ...course,
      started: true,
      progress: boundedProgress(progress.completion ?? progress.courseProgress),
      currentLesson: progress.currentLesson ?? null,
      currentModule: progress.currentModule ?? null,
      lastOpened: progress.lastOpened ?? progress.startedAt ?? null,
    } : null;
  }).filter(Boolean).sort((left, right) => timestamp(right.lastOpened) - timestamp(left.lastOpened));
  const completedLessonCount = progressRecords.reduce((total, progress) => {
    const courseLessons = Array.isArray(progress.completedLessons) ? progress.completedLessons : [];
    return total + new Set(courseLessons).size;
  }, 0);
  const enrollmentByCourse = new Map(enrollments.map((course) => [course.id, course]));
  return Object.freeze({
    enrollments: Object.freeze(enrollments),
    activeCourse: enrollments[0] ?? null,
    recentlyViewed: Object.freeze(recentCourseIds.map((courseId) => enrollmentByCourse.get(courseId) ?? findCatalogCourse(courseId)).filter(Boolean)),
    statistics: Object.freeze([
      { id: 'courses', label: 'Courses enrolled', value: String(enrollments.length) },
      { id: 'lessons', label: 'Lessons completed', value: String(completedLessonCount) },
      { id: 'challenges', label: 'Challenges completed', value: String(Math.max(0, Number(challengesCompleted) || 0)) },
    ]),
  });
}
