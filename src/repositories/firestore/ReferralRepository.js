import { BaseRepository } from './BaseRepository';
import { referralConverter } from './converters';
import { userReferralAttributionPath, userReferralIdentityPath, userReferralReadModelPath } from './paths';

export class ReferralRepository extends BaseRepository {
  constructor(uid) {
    super(userReferralReadModelPath(uid), referralConverter);
    this.uid = uid;
  }

  async getProfile() {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase/firestore');
    const [identity, attribution, referrals] = await Promise.all([
      getDoc(doc(db, userReferralIdentityPath(this.uid))),
      getDoc(doc(db, userReferralAttributionPath(this.uid))),
      this.list(),
    ]);
    return {
      identity: identity.exists() ? identity.data() : null,
      attribution: attribution.exists() ? attribution.data() : null,
      referrals,
    };
  }
}
