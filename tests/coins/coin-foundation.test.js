import { describe, expect, it, vi } from 'vitest';
import { CoinRewardPolicy, coinRewardPolicy, MVP_COIN_POLICY_VERSION, MVP_DAILY_ACTIVITY_COIN_CAP } from '../../functions/src/coins/CoinRewardPolicy.js';
import { RewardClaimService } from '../../functions/src/coins/RewardClaimService.js';
import {
  COIN_ACTIVITY_TYPES,
  claimIdentifier,
  positiveInteger,
  requiredEvidenceReference,
  requiredIdentifier,
} from '../../functions/src/coins/CoinModels.js';

describe('MI Coin foundation validation', () => {
  it('accepts positive integer coin amounts and rejects zero, negative, fractional, and unsafe amounts', () => {
    expect(positiveInteger(1)).toBe(1);
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '10', NaN]) {
      expect(() => positiveInteger(value)).toThrow(expect.objectContaining({ code: 'coin/invalid-amount' }));
    }
  });

  it('rejects malformed identifiers and accepts bounded server evidence paths', () => {
    expect(requiredIdentifier('challenge:daily-1', 'sourceId')).toBe('challenge:daily-1');
    for (const value of ['', 'has/slash', 'has space', 'x'.repeat(257)]) {
      expect(() => requiredIdentifier(value, 'sourceId')).toThrow(expect.objectContaining({ code: 'coin/invalid-argument' }));
    }
    expect(requiredEvidenceReference('trustedEvidence/session-1')).toBe('trustedEvidence/session-1');
    expect(() => requiredEvidenceReference('../unsafe')).toThrow(expect.objectContaining({ code: 'coin/invalid-argument' }));
  });

  it('derives stable claim IDs without exposing the raw user or activity identifier', () => {
    const first = claimIdentifier('user-a', 'PRACTICE', 'question-1');
    expect(first).toBe(claimIdentifier('user-a', 'PRACTICE', 'question-1'));
    expect(first).not.toContain('user-a');
    expect(first).not.toContain('question-1');
  });

  it('activates the fixed versioned MVP policy without per-activity variation', () => {
    expect(MVP_COIN_POLICY_VERSION).toBe('mvp-v1');
    expect(MVP_DAILY_ACTIVITY_COIN_CAP).toBe(100);
    expect(coinRewardPolicy.getActivityRewardPolicy('PRACTICE', 'question-1', 'v2')).toMatchObject({ amount: 5, policyVersion: 'mvp-v1', enabled: true });
    expect(coinRewardPolicy.getActivityRewardPolicy('PRACTICE', 'another-question', 'v2')).toMatchObject({ amount: 5 });
    expect(coinRewardPolicy.getActivityRewardPolicy('DAILY_CHALLENGE', 'today', 'v1')).toMatchObject({ amount: 20 });
    expect(() => coinRewardPolicy.getActivityRewardPolicy('PRACTICE', 'question-1', 'v1'))
      .toThrow(expect.objectContaining({ code: 'coin/reward-policy-missing' }));
  });

  it('rejects malformed type-wide policy amounts at construction', () => {
    for (const amount of [0, -5, 1.5]) {
      expect(() => new CoinRewardPolicy([{ activityType: 'PRACTICE', activityVersion: 'v2', policyVersion: 'bad-v1', amount }]))
        .toThrow(expect.objectContaining({ code: 'coin/invalid-amount' }));
    }
  });

  it('rejects ambiguous duplicate policy scopes at startup', () => {
    expect(() => new CoinRewardPolicy([
      { activityType: 'PRACTICE', activityVersion: 'v2', policyVersion: 'mvp-v1', amount: 5 },
      { activityType: 'PRACTICE', activityVersion: 'v2', policyVersion: 'mvp-v2', amount: 6 },
    ])).toThrow(expect.objectContaining({ code: 'coin/reward-policy-conflict' }));
  });

  it('resolves only an explicitly configured, versioned synthetic policy', () => {
    const policy = new CoinRewardPolicy([{ activityType: COIN_ACTIVITY_TYPES.PRACTICE, activityId: 'synthetic-question', policyVersion: 'test-v1', amount: 7 }]);
    expect(policy.getCoinRewardPolicy('PRACTICE', 'synthetic-question', 'test-v1')).toMatchObject({ amount: 7 });
    expect(() => policy.getCoinRewardPolicy('PRACTICE', 'synthetic-question', 'test-v2'))
      .toThrow(expect.objectContaining({ code: 'coin/reward-policy-missing' }));
  });

  it('requires a verified server principal before recording or granting a claim', async () => {
    const db = { doc: vi.fn(), runTransaction: vi.fn() };
    const ledger = { grantCoins: vi.fn() };
    const service = new RewardClaimService({ db, ledger });
    await expect(service.recordCompletion({
      principal: { uid: 'user-a', authenticated: false },
      activityType: 'PRACTICE', activityId: 'question-1', evidenceReference: 'evidence/session-1',
      evidenceAssurance: 'SERVER_GRADED', policyVersion: 'v1',
    })).rejects.toMatchObject({ code: 'coin/unauthenticated' });
    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(ledger.grantCoins).not.toHaveBeenCalled();
  });
});
