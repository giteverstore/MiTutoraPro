const REFERRAL_STATUSES = new Set(['ATTRIBUTED', 'QUALIFIED']);

export function createReferralEntry(entry) {
  if (!entry.referralId || !REFERRAL_STATUSES.has(entry.status)) throw new Error('Referral entries require a valid id and status.');
  return {
    id: entry.referralId,
    attributedAt: entry.attributedAt ?? null,
    qualifiedAt: entry.qualifiedAt ?? null,
    status: entry.status,
    calculatedRewardMinor: entry.calculatedRewardMinor ?? null,
    currency: entry.currency ?? 'INR',
  };
}

export function createReferralProfile(profile) {
  return {
    schemaVersion: '1.0.0',
    referralCode: profile.identity?.code ?? '',
    referralLink: `${globalThis.location?.origin ?? 'https://mi-tutora-pro.vercel.app'}/?ref=${profile.identity?.code ?? ''}`,
    attribution: profile.attribution ?? null,
    totalReferred: profile.referrals?.length ?? 0,
    attributed: profile.referrals?.filter(({ status }) => status === 'ATTRIBUTED').length ?? 0,
    qualified: profile.referrals?.filter(({ status }) => status === 'QUALIFIED').length ?? 0,
    calculatedRewardsMinor: profile.referrals?.reduce((sum, item) => sum + (item.calculatedRewardMinor ?? 0), 0) ?? 0,
    history: (profile.referrals ?? []).map(createReferralEntry),
  };
}
