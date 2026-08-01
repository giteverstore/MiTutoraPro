function storageSegment(value, label) {
  const segment = String(value ?? '').trim().toLowerCase();
  if (!segment) throw new Error(`${label} is required to build a content path.`);
  if (segment.includes('/') || segment === '.' || segment === '..') {
    throw new Error(`${label} must be a single Firebase Storage path segment.`);
  }
  return segment;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive integer.`);
  return number;
}

export function normalizeStoragePath(value) {
  const path = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (!path || path.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('A valid Firebase Storage path is required.');
  }
  return path;
}

export const courseStorageRoot = (courseSlug) => `course-content/${storageSegment(courseSlug, 'courseSlug')}`;
export const courseVersionStorageRoot = (storageRoot, version) => `${normalizeStoragePath(storageRoot)}/${storageSegment(version, 'version')}`;
export const courseManifestPath = (storageRoot, version) => `${courseVersionStorageRoot(storageRoot, version)}/course.json`;
export const versionedCourseModulePath = (storageRoot, version, moduleNumber) => `${courseVersionStorageRoot(storageRoot, version)}/module-${positiveInteger(moduleNumber, 'moduleNumber')}.json`;
export const courseModuleStoragePath = (courseSlug, version, moduleNumber) => versionedCourseModulePath(courseStorageRoot(courseSlug), version, moduleNumber);
export const practiceStoragePath = (language, questionSlug) => `practice/${storageSegment(language, 'language')}/${storageSegment(questionSlug, 'questionSlug')}.json`;
export const versionedContentPath = (storagePath, version) => {
  const normalizedPath = normalizeStoragePath(storagePath);
  const separator = normalizedPath.lastIndexOf('/');
  if (separator < 1 || !normalizedPath.endsWith('.json')) throw new Error('Versioned content requires a JSON storage path.');
  return `${normalizedPath.slice(0, separator)}/${storageSegment(version, 'version')}/${normalizedPath.slice(separator + 1)}`;
};
export const dailyChallengeStoragePath = (language, date) => {
  const normalizedDate = storageSegment(date, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) throw new Error('date must use YYYY-MM-DD format.');
  return `daily-challenges/${storageSegment(language, 'language')}/${normalizedDate}.json`;
};
