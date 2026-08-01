import { dailyChallengesPath } from '../../repositories/firestore/paths';
import { BaseContentRepository } from './BaseContentRepository';
import { versionedContentPath } from '../utils/contentPaths';

export class ChallengeRepository extends BaseContentRepository {
  constructor(options) {
    super(dailyChallengesPath(), options);
  }

  loadChallenge(storagePath, version, options) {
    return this.downloadJson(versionedContentPath(storagePath, version), options);
  }
}
