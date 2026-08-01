import { createChallengeMetadata } from '../models/challengeMetadata';
import { ChallengeRepository } from '../repositories/ChallengeRepository';
import { BaseContentService } from './BaseContentService';
import { versionedContentPath } from '../utils/contentPaths';

const validateChallenge = (value) => Boolean(value && !Array.isArray(value) && typeof value === 'object'
  && typeof value.id === 'string' && typeof value.date === 'string' && Array.isArray(value.blocks)
  && value.blocks.some((block) => block?.type === 'compiler'));

export class ChallengeService extends BaseContentService {
  constructor(repository = new ChallengeRepository()) {
    super({ repository, createMetadata: createChallengeMetadata, contentType: 'Daily challenge' });
  }

  getChallenge(challengeId, options) {
    return this.loadById(
      challengeId,
      (metadata, version, loadOptions) => this.repository.loadChallenge(metadata.storagePath, version, loadOptions),
      validateChallenge,
      options,
    );
  }

  getChallengeFromMetadata(metadata) {
    return this.loadFromMetadata(
      metadata,
      (item, version, loadOptions) => this.repository.loadChallenge(item.storagePath, version, loadOptions),
      validateChallenge,
    );
  }

  invalidateChallenge(metadata) {
    this.invalidateMetadata(metadata.id);
    return this.repository.invalidate(versionedContentPath(metadata.storagePath, metadata.version));
  }
}
