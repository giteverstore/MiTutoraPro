import { createChallengeMetadata } from '../models/challengeMetadata';
import { ChallengeRepository } from '../repositories/ChallengeRepository';
import { BaseContentService } from './BaseContentService';
import { versionedContentPath } from '../utils/contentPaths';
import { CONTENT_LIMITS } from '../validation/contentLimits';
import { PracticeService } from './PracticeService';

const validateChallenge = (value) => Boolean(value && !Array.isArray(value) && typeof value === 'object'
  && typeof value.id === 'string' && typeof value.date === 'string' && Array.isArray(value.blocks)
  && value.blocks.some((block) => block?.type === 'compiler'));

export class ChallengeService extends BaseContentService {
  constructor(repository = new ChallengeRepository(), practiceService = new PracticeService()) {
    super({ repository, createMetadata: createChallengeMetadata, contentType: 'Daily challenge' });
    this.practiceService = practiceService;
  }

  async getChallenge(challengeId, options) {
    return this.getChallengeFromMetadata(await this.getMetadata(challengeId, options));
  }

  getChallengeFromMetadata(metadata) {
    if (metadata.practiceQuestionId) {
      return this.practiceService.getQuestion(metadata.practiceQuestionId).then(({ content: question }) => ({
        metadata,
        content: Object.freeze({ ...question, date: metadata.date, reward: { coins: metadata.rewardCoins, streakIncrement: 1 } }),
      }));
    }
    return this.loadFromMetadata(
      metadata,
      (item, version, loadOptions) => this.repository.loadChallenge(item.storagePath, version, { ...loadOptions, maxBytes: CONTENT_LIMITS.runtime.maxChallengeDownloadBytes }),
      validateChallenge,
    );
  }

  invalidateChallenge(metadata) {
    this.invalidateMetadata(metadata.id);
    return metadata.storagePath
      ? this.repository.invalidate(versionedContentPath(metadata.storagePath, metadata.version))
      : false;
  }
}
