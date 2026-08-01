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
    const initial = createReferralProfile(mockReferralProfile);
    await this.dataService.saveReferral(userId, initial);
    return initial;
  }

  async saveReferralProfile(userId, profile) {
    const normalized = createReferralProfile(profile);
    return this.dataService.saveReferral(userId, normalized);
  }

  async resetReferralProfile(userId) {
    await this.dataService.clearReferral(userId);
    return this.getReferralProfile(userId);
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
