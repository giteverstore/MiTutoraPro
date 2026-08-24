import { mockReferralProfile } from './referralData';
import { userDataService } from '../user-data/UserDataService';
import { createReferralProfile } from './referralModel';

export class ReferralService {
  constructor({ dataService = userDataService } = {}) {
    this.dataService = dataService;
  }

  async getReferralProfile(userId) {
    const stored = await this.dataService.loadReferral(userId);
    if (stored) return createReferralProfile(stored);
    return createReferralProfile(mockReferralProfile);
  }

  async saveReferralProfile(userId, profile) {
    void userId;
    return createReferralProfile(profile);
  }

  async resetReferralProfile(userId) {
    void userId;
    return createReferralProfile(mockReferralProfile);
  }

  exportReferralProfile(profile) {
    return JSON.stringify({
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      referral: createReferralProfile(profile),
    }, null, 2);
  }
}

export const referralService = new ReferralService();
