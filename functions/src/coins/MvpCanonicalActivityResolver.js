import { COIN_ACTIVITY_TYPES, enumValue, requiredIdentifier } from './CoinModels.js';
import { failCoin } from './CoinError.js';

const VERSION = /^v[1-9][0-9]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class MvpCanonicalActivityResolver {
  constructor({ loadPracticeMetadata, loadDailyChallengeMetadata }) {
    if (typeof loadPracticeMetadata !== 'function' || typeof loadDailyChallengeMetadata !== 'function') {
      throw new TypeError('MvpCanonicalActivityResolver requires canonical metadata loaders.');
    }
    this.loaders = {
      [COIN_ACTIVITY_TYPES.PRACTICE]: loadPracticeMetadata,
      [COIN_ACTIVITY_TYPES.DAILY_CHALLENGE]: loadDailyChallengeMetadata,
    };
  }

  async resolve({ activityType: typeValue, activityId: idValue }, options = {}) {
    const activityType = enumValue(typeValue, COIN_ACTIVITY_TYPES, 'activityType');
    const activityId = requiredIdentifier(idValue, 'activityId');
    const metadata = await this.loaders[activityType](activityId, options);
    if (!metadata) return null;
    if (metadata.id !== activityId || metadata.published !== true || !VERSION.test(metadata.version ?? '')) {
      failCoin('coin/activity-not-rewardable', 'The canonical activity is not rewardable.');
    }
    const occurrence = activityType === COIN_ACTIVITY_TYPES.DAILY_CHALLENGE ? metadata.date : '';
    if (activityType === COIN_ACTIVITY_TYPES.DAILY_CHALLENGE && !DATE.test(occurrence ?? '')) {
      failCoin('coin/activity-not-rewardable', 'The Daily Challenge occurrence is not stable.');
    }
    return Object.freeze({ activityType, activityId, activityVersion: metadata.version, occurrence });
  }
}
