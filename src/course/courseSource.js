export const COURSE_SOURCES = Object.freeze({
  canonical: 'canonical',
  legacy: 'legacy',
});

const knownLegacyCourseIds = new Set(['python', 'java']);

export function getCourseSource(courseId) {
  return knownLegacyCourseIds.has(String(courseId ?? '')) ? COURSE_SOURCES.legacy : null;
}
