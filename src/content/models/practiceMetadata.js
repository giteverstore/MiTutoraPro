import {
  metadataStoragePath,
  nonNegativeNumber,
  positiveVersion,
  requiredString,
  requireMetadataObject,
} from './modelUtils';

export function createPracticeMetadata(value) {
  const metadata = requireMetadataObject(value, 'Practice');
  return Object.freeze({
    id: requiredString(metadata.id, 'id', 'Practice'),
    title: requiredString(metadata.title, 'title', 'Practice'),
    language: requiredString(metadata.language, 'language', 'Practice'),
    topic: requiredString(metadata.topic, 'topic', 'Practice'),
    difficulty: requiredString(metadata.difficulty, 'difficulty', 'Practice'),
    estimatedMinutes: nonNegativeNumber(metadata.estimatedMinutes, 'estimatedMinutes', 'Practice'),
    xp: nonNegativeNumber(metadata.xp, 'xp', 'Practice'),
    published: metadata.published === true,
    version: positiveVersion(metadata.version, 'Practice'),
    storagePath: metadataStoragePath(metadata.storagePath, 'Practice'),
  });
}
