import { ACTIVITY_TYPES } from './ActivityVerificationModels.js';
import { ActivityVerifier } from './ActivityVerifier.js';

export class PracticeVerifier extends ActivityVerifier {
  constructor({ executor }) { super({ activityType: ACTIVITY_TYPES.PRACTICE, executor }); }
}
