import { userDataService } from '../user-data/UserDataService';
import { createReferralProfile } from './referralModel';
import { callFirebaseFunction } from '../firebase/functions';

export class ReferralService {
  constructor({ dataService = userDataService } = {}) {
    this.dataService = dataService;
  }

  async getReferralProfile(userId) {
    let stored = await this.dataService.loadReferral(userId);
    if (!stored?.identity) {
      await callFirebaseFunction('ensureReferralIdentity', {});
      stored = await this.dataService.loadReferral(userId);
    }
    return createReferralProfile(stored);
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

export function attributeReferralCode(referralCode) {
  return callFirebaseFunction('attributeReferral', { referralCode });
}
