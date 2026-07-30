import { mockReferralProfile } from './referralData';
import { createLocalReferralRepository } from './localReferralRepository';
import { createReferralProfile } from './referralModel';

export class ReferralService {
  constructor({ repository = createLocalReferralRepository() } = {}) {
    this.repository = repository;
  }

  async getReferralProfile(userId) {
    const stored = await this.repository.load(userId);
    if (stored) return createReferralProfile(stored);
    const initial = createReferralProfile(mockReferralProfile);
    await this.repository.save(userId, initial);
    return initial;
  }

  async saveReferralProfile(userId, profile) {
    const normalized = createReferralProfile(profile);
    return this.repository.save(userId, normalized);
  }

  async resetReferralProfile(userId) {
    await this.repository.clear(userId);
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
