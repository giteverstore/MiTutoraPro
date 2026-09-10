import { ACTIVITY_TYPES } from './ActivityVerificationModels.js';
import { ActivityVerifier } from './ActivityVerifier.js';

export class DailyChallengeVerifier extends ActivityVerifier {
  constructor({ executor }) { super({ activityType: ACTIVITY_TYPES.DAILY_CHALLENGE, executor }); }
}
