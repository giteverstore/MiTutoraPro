import { describe, expect, it, vi } from 'vitest';
import { CoinRewardPolicy } from '../../functions/src/coins/CoinRewardPolicy.js';
import { MvpCanonicalActivityResolver } from '../../functions/src/coins/MvpCanonicalActivityResolver.js';
import { MvpActivityRewardClaimService } from '../../functions/src/coins/MvpActivityRewardClaimService.js';

const principal = { authenticated: true, uid: 'learner-a' };
const practice = { id: 'fund-variables-001', version: 'v2', published: true };
const challenge = { id: 'challenge-balanced-brackets', version: 'v1', date: '2026-08-01', published: true };

function dependencies({ entries, practiceMetadata = practice, challengeMetadata = challenge } = {}) {
  const ledger = { claimActivityReward: vi.fn(async (_mutation, _claim, options) => {
    await options.verifyEligibility({});
    return { duplicate: false, balance: 7, revision: 1 };
  }) };
  const resolver = new MvpCanonicalActivityResolver({
    loadPracticeMetadata: vi.fn(async (id) => id === practiceMetadata?.id ? practiceMetadata : null),
    loadDailyChallengeMetadata: vi.fn(async (id) => id === challengeMetadata?.id ? challengeMetadata : null),
  });
  const policy = new CoinRewardPolicy(entries ?? [{
    activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2', policyVersion: 'mvp-test-v1', amount: 7,
  }]);
  return { ledger, resolver, policy, service: new MvpActivityRewardClaimService({ ledger, resolver, policy, timestamp: () => 'fixed-time' }) };
}

describe('MVP locally verified activity reward boundary', () => {
  it('rejects unauthenticated requests before canonical resolution or mutation', async () => {
    const { service, ledger } = dependencies();
    await expect(service.claimActivityReward({ principal: { authenticated: false, uid: 'learner-a' }, request: {
      activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2',
    } })).rejects.toMatchObject({ code: 'coin/unauthenticated' });
    expect(ledger.claimActivityReward).not.toHaveBeenCalled();
  });

  it('rejects unknown activity types and malformed requests', async () => {
    const { service } = dependencies();
    await expect(service.claimActivityReward({ principal, request: { activityType: 'COURSE', activityId: 'lesson-1', activityVersion: 'v1' } }))
      .rejects.toMatchObject({ code: 'coin/invalid-argument' });
    await expect(service.claimActivityReward({ principal, request: null })).rejects.toMatchObject({ code: 'coin/invalid-request' });
  });

  it('rejects all client-controlled authority fields, including UID and reward amount', async () => {
    for (const field of ['uid', 'rewardAmount', 'coinBalance', 'amount', 'policyVersion', 'evidenceAssurance']) {
      const { service, ledger } = dependencies();
      await expect(service.claimActivityReward({ principal, request: {
        activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2', [field]: field === 'rewardAmount' ? 999 : 'forged',
      } })).rejects.toMatchObject({ code: 'coin/client-authority-rejected' });
      expect(ledger.claimActivityReward).not.toHaveBeenCalled();
    }
  });

  it('returns finite not-found and version-mismatch outcomes without mutation', async () => {
    const { service, ledger } = dependencies();
    await expect(service.claimActivityReward({ principal, request: { activityType: 'PRACTICE', activityId: 'missing', activityVersion: 'v2' } }))
      .resolves.toEqual({ status: 'activity_not_found' });
    await expect(service.claimActivityReward({ principal, request: { activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v1' } }))
      .resolves.toEqual({ status: 'version_mismatch' });
    expect(ledger.claimActivityReward).not.toHaveBeenCalled();
  });

  it('fails closed when policy is absent or explicitly disabled', async () => {
    const missing = dependencies({ entries: [] });
    await expect(missing.service.claimActivityReward({ principal, request: { activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2' } }))
      .resolves.toEqual({ status: 'activity_not_rewardable' });
    const disabled = dependencies({ entries: [{ activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2', policyVersion: 'test-v1', amount: 7, enabled: false }] });
    await expect(disabled.service.claimActivityReward({ principal, request: { activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2' } }))
      .resolves.toEqual({ status: 'policy_disabled' });
    expect(missing.ledger.claimActivityReward).not.toHaveBeenCalled();
    expect(disabled.ledger.claimActivityReward).not.toHaveBeenCalled();
  });

  it('derives the Practice reward, policy, owner, claim identity, and local assurance server-side', async () => {
    const { service, ledger } = dependencies();
    await expect(service.claimActivityReward({ principal, request: { activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2' } }))
      .resolves.toMatchObject({ status: 'credited', claimId: expect.any(String), balance: 7, revision: 1 });
    const [mutation, claim] = ledger.claimActivityReward.mock.calls[0];
    expect(mutation).toMatchObject({ uid: 'learner-a', amount: 7, policyVersion: 'mvp-test-v1', sourceId: practice.id });
    expect(claim.data).toMatchObject({ ownerUid: 'learner-a', activityVersion: 'v2', evidenceAssurance: 'LOCAL_VERIFIED_ACTIVITY', policyVersion: 'mvp-test-v1' });
    expect(claim.path).not.toContain('fund-variables-001');
  });

  it('binds Daily Challenge claims to the canonical occurrence date', async () => {
    const { service, ledger } = dependencies({ entries: [{
      activityType: 'DAILY_CHALLENGE', activityId: challenge.id, activityVersion: 'v1', policyVersion: 'mvp-test-v1', amount: 3,
    }] });
    await expect(service.claimActivityReward({ principal, request: { activityType: 'DAILY_CHALLENGE', activityId: challenge.id, activityVersion: 'v1' } }))
      .resolves.toMatchObject({ status: 'credited' });
    expect(ledger.claimActivityReward.mock.calls[0][1].data).toMatchObject({ occurrence: '2026-08-01' });
  });

  it('reports an idempotent ledger replay as already claimed', async () => {
    const values = dependencies();
    values.ledger.claimActivityReward.mockResolvedValue({ duplicate: true, balance: 7, revision: 1 });
    await expect(values.service.claimActivityReward({ principal, request: { activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2' } }))
      .resolves.toEqual({ status: 'already_claimed', claimId: expect.any(String), amount: 7, balance: 7, revision: 1 });
  });

  it('cannot represent financial or server-verified evidence through its request contract', async () => {
    const { service } = dependencies();
    for (const field of ['transactionType', 'walletAmount', 'evidenceAssurance']) {
      await expect(service.claimActivityReward({ principal, request: {
        activityType: 'PRACTICE', activityId: practice.id, activityVersion: 'v2', [field]: 'FINANCIAL_EVENT',
      } })).rejects.toMatchObject({ code: 'coin/client-authority-rejected' });
    }
  });
});
