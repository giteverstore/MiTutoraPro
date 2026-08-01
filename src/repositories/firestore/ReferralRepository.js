import { BaseRepository } from './BaseRepository';
import { referralConverter } from './converters';
import { userReferralsPath } from './paths';

export class ReferralRepository extends BaseRepository {
  constructor(uid) {
    super(userReferralsPath(uid), referralConverter);
  }

  getProfile() {
    return this.get('profile');
  }

  setProfile(profile) {
    return this.set('profile', profile);
  }

  removeProfile() {
    return this.remove('profile');
  }
}
