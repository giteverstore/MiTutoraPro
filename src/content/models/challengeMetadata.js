import {
  metadataStoragePath,
  nonNegativeNumber,
  positiveVersion,
  requiredString,
  requireMetadataObject,
} from './modelUtils';
import { CONTENT_ERROR_CODES, ContentError } from '../utils/ContentError';

export function createChallengeMetadata(value) {
  const metadata = requireMetadataObject(value, 'Challenge');
  const date = requiredString(metadata.date, 'date', 'Challenge');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ContentError(
      CONTENT_ERROR_CODES.invalidMetadata,
      'Challenge metadata date must use YYYY-MM-DD format.',
      { details: { field: 'date' } },
    );
  }
  return Object.freeze({
    id: requiredString(metadata.id, 'id', 'Challenge'),
    date,
    language: requiredString(metadata.language, 'language', 'Challenge'),
    difficulty: requiredString(metadata.difficulty, 'difficulty', 'Challenge'),
    rewardCoins: nonNegativeNumber(metadata.rewardCoins, 'rewardCoins', 'Challenge'),
    rewardXp: nonNegativeNumber(metadata.rewardXp, 'rewardXp', 'Challenge'),
    published: metadata.published === true,
    version: positiveVersion(metadata.version, 'Challenge'),
    storagePath: metadataStoragePath(metadata.storagePath, 'Challenge'),
  });
}
