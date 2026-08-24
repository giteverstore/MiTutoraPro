import {
  metadataStoragePath,
  nonNegativeNumber,
  optionalString,
  positiveVersion,
  requiredString,
  requireMetadataObject,
} from './modelUtils';

export function createCourseMetadata(value) {
  const metadata = requireMetadataObject(value, 'Course');
  const integrity = metadata.contentIntegrity && typeof metadata.contentIntegrity === 'object'
    ? Object.freeze({
      algorithm: optionalString(metadata.contentIntegrity.algorithm),
      manifest: optionalString(metadata.contentIntegrity.manifest).toLowerCase(),
      modules: Object.freeze({ ...(metadata.contentIntegrity.modules ?? {}) }),
    })
    : null;
  return Object.freeze({
    id: requiredString(metadata.id, 'id', 'Course'),
    slug: requiredString(metadata.slug, 'slug', 'Course'),
    title: requiredString(metadata.title, 'title', 'Course'),
    description: optionalString(metadata.description),
    thumbnail: optionalString(metadata.thumbnail),
    language: requiredString(metadata.language, 'language', 'Course'),
    domain: requiredString(metadata.domain, 'domain', 'Course'),
    difficulty: requiredString(metadata.difficulty, 'difficulty', 'Course'),
    estimatedMinutes: nonNegativeNumber(metadata.estimatedMinutes, 'estimatedMinutes', 'Course'),
    moduleCount: nonNegativeNumber(metadata.moduleCount, 'moduleCount', 'Course'),
    lessonCount: nonNegativeNumber(metadata.lessonCount, 'lessonCount', 'Course'),
    published: metadata.published === true,
    version: positiveVersion(metadata.version, 'Course'),
    storagePath: metadataStoragePath(metadata.storagePath, 'Course'),
    contentIntegrity: integrity,
  });
}
