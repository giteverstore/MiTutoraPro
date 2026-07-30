const REFERRAL_STATUSES = new Set(['invited', 'joined', 'qualified']);
const REWARD_STATUSES = new Set(['pending', 'earned']);

export function createReferralEntry(entry) {
  if (!entry.id || !entry.friendName || !REFERRAL_STATUSES.has(entry.status)) {
    throw new Error('Referral entries require a valid id, friend name, and status.');
  }
  if (!REWARD_STATUSES.has(entry.rewardStatus)) {
    throw new Error(`Invalid referral reward status "${entry.rewardStatus}".`);
  }
  return {
    id: entry.id,
    friendName: entry.friendName,
    joinDate: entry.joinDate ?? null,
    status: entry.status,
    rewardStatus: entry.rewardStatus,
    rewardCoins: entry.rewardCoins ?? 0,
  };
}

export function createReferralProfile(profile) {
  return {
    schemaVersion: '1.0.0',
    referralCode: profile.referralCode,
    referralLink: profile.referralLink,
    totalInvites: profile.totalInvites ?? 0,
    successfulReferrals: profile.successfulReferrals ?? 0,
    coinsEarned: profile.coinsEarned ?? 0,
    rewards: {
      referrerCoins: profile.rewards?.referrerCoins ?? 0,
      referredUserCoins: profile.rewards?.referredUserCoins ?? 0,
      qualification: profile.rewards?.qualification ?? '',
    },
    history: (profile.history ?? []).map(createReferralEntry),
  };
}
