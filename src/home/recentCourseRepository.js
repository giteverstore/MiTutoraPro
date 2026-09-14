const KEY_PREFIX = 'mi-tutora:recent-courses:v1';
const MAXIMUM_RECENT_COURSES = 6;
const keyFor = (userId) => `${KEY_PREFIX}:${userId}`;

function read(storage, userId) {
  try {
    const value = JSON.parse(storage.getItem(keyFor(userId)) ?? '[]');
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch { return []; }
}

export function createRecentCourseRepository(storage = globalThis.localStorage) {
  return {
    list(userId) { return read(storage, userId); },
    record(userId, courseId) {
      const next = [courseId, ...read(storage, userId).filter((id) => id !== courseId)].slice(0, MAXIMUM_RECENT_COURSES);
      storage.setItem(keyFor(userId), JSON.stringify(next));
      return next;
    },
  };
}

export const recentCourseRepository = createRecentCourseRepository();
