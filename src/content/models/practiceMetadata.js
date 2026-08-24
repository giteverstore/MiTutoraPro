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
    summary: requiredString(metadata.summary, 'summary', 'Practice'),
    language: requiredString(metadata.language, 'language', 'Practice'),
    topic: requiredString(metadata.topic, 'topic', 'Practice'),
    category: requiredString(metadata.category, 'category', 'Practice'),
    subtopic: requiredString(metadata.subtopic, 'subtopic', 'Practice'),
    questionType: requiredString(metadata.questionType, 'questionType', 'Practice'),
    skills: Object.freeze(Array.isArray(metadata.skills) ? [...metadata.skills] : []),
    difficulty: requiredString(metadata.difficulty, 'difficulty', 'Practice'),
    estimatedMinutes: nonNegativeNumber(metadata.estimatedMinutes, 'estimatedMinutes', 'Practice'),
    xp: nonNegativeNumber(metadata.xp, 'xp', 'Practice'),
    position: nonNegativeNumber(metadata.position, 'position', 'Practice'),
    published: metadata.published === true,
    version: positiveVersion(metadata.version, 'Practice'),
    storagePath: metadataStoragePath(metadata.storagePath, 'Practice'),
    contentHash: String(metadata.contentHash ?? '').trim().toLowerCase(),
  });
}
