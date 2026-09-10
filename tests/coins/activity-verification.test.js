import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ActivityVerificationService } from '../../functions/src/activity-verification/ActivityVerificationService.js';
import { AuthoritativeActivityResolver } from '../../functions/src/activity-verification/AuthoritativeActivityResolver.js';
import { PracticeVerifier } from '../../functions/src/activity-verification/PracticeVerifier.js';
import { DailyChallengeVerifier } from '../../functions/src/activity-verification/DailyChallengeVerifier.js';
import { sanitizedVerificationError } from '../../functions/src/activity-verification/ActivityVerificationError.js';
import { productionActivityVerificationBoundary } from '../../functions/src/activity-verification/ProductionActivityVerificationBoundary.js';

const limits = Object.freeze({
  maxSourceBytes: 4_096,
  maxOutputBytes: 1_024,
  maxTestCount: 8,
  maxTestInputBytes: 1_024,
  executionTimeoutMs: 40,
  memoryLimitBytes: 32 * 1024 * 1024,
});
const hash = createHash('sha256').update('canonical').digest('hex');
const principal = Object.freeze({ uid: 'learner-1', authenticated: true });
const request = Object.freeze({
  activityType: 'PRACTICE', activityId: 'question-1', contentVersion: 'v2', language: 'python', sourceCode: 'def answer(): return 2',
});
const activity = Object.freeze({
  activityType: 'PRACTICE', id: 'question-1', version: 'v2', language: 'python', published: true, contentHash: hash,
  verification: Object.freeze({ entryPoint: 'answer', tests: Object.freeze([{ arguments: [], expected: 2 }, { arguments: [1], expected: 2 }]) }),
});

function executor(result = { passed: true, testCount: 2 }) {
  return {
    securityProfile: Object.freeze({
      isolated: true, hardTimeout: true, networkAccess: false, filesystemAccess: false,
      memoryLimitBytes: limits.memoryLimitBytes, outputLimitBytes: limits.maxOutputBytes,
    }),
    execute: vi.fn().mockResolvedValue(result),
  };
}

function harness({ resolved = activity, execution = executor(), completion } = {}) {
  const recorder = completion ?? { recordVerifiedCompletion: vi.fn().mockResolvedValue({ duplicate: false }) };
  const service = new ActivityVerificationService({
    resolver: { resolve: vi.fn().mockResolvedValue(resolved) },
    verifiers: {
      PRACTICE: new PracticeVerifier({ executor: execution }),
      DAILY_CHALLENGE: new DailyChallengeVerifier({ executor: execution }),
    },
    completionRecorder: recorder,
    limits,
  });
  return { service, execution, recorder };
}

async function expectCode(promise, code) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('authoritative activity verification boundary', () => {
  it.each([
    [null],
    [{ authenticated: false, uid: 'learner-1' }],
    [{ authenticated: true, uid: '' }],
    [{ authenticated: true, uid: 'other/user' }],
  ])('rejects unauthenticated or malformed principals', async (candidate) => {
    await expectCode(harness().service.verify({ principal: candidate, body: request }), 'activity-verification/unauthenticated');
  });

  it.each(['amount', 'rewardType', 'balance', 'policyVersion', 'uid', 'completedAt', 'passed', 'expectedOutput', 'compilerOutput'])
    ('rejects client-authoritative field %s', async (field) => {
      await expectCode(harness().service.verify({ principal, body: { ...request, [field]: field === 'passed' ? true : 'forged' } }), 'activity-verification/client-authority-rejected');
    });

  it.each([
    [{ ...request, sourceCode: '' }, 'activity-verification/source-required'],
    [{ ...request, sourceCode: 'x'.repeat(limits.maxSourceBytes + 1) }, 'activity-verification/source-too-large'],
    [{ ...request, contentVersion: 'latest' }, 'activity-verification/invalid-version'],
    [{ ...request, language: '' }, 'activity-verification/invalid-request'],
    [{ ...request, activityType: 'COURSE' }, 'activity-verification/invalid-activity-type'],
  ])('rejects malformed or unbounded submission input', async (body, code) => {
    await expectCode(harness().service.verify({ principal, body }), code);
  });

  it('accepts a passing isolated verification and records only server-derived completion evidence', async () => {
    const { service, recorder } = harness();
    await expect(service.verify({ principal, body: request })).resolves.toEqual({
      status: 'VERIFIED', verified: true, duplicate: false, rewardStatus: 'UNAVAILABLE', rewardReason: 'REWARD_POLICY_UNCONFIGURED',
    });
    expect(recorder.recordVerifiedCompletion).toHaveBeenCalledWith(expect.objectContaining({
      principal: { uid: principal.uid },
      activity: { activityType: 'PRACTICE', activityId: 'question-1', contentVersion: 'v2', contentHash: hash, language: 'python' },
      evidence: expect.objectContaining({ assurance: 'SERVER_VALIDATED_EXECUTION' }),
    }));
  });

  it('rejects an incorrect solution without creating completion evidence', async () => {
    const { service, recorder } = harness({ execution: executor({ passed: false, testCount: 2 }) });
    await expect(service.verify({ principal, body: { ...request, sourceCode: 'def answer(): return 9' } })).resolves.toMatchObject({ status: 'REJECTED', verified: false });
    expect(recorder.recordVerifiedCompletion).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'activity-verification/activity-not-found'],
    [{ ...activity, published: false }, 'activity-verification/activity-unpublished'],
    [{ ...activity, id: 'question-2' }, 'activity-verification/activity-mismatch'],
    [{ ...activity, version: 'v1' }, 'activity-verification/version-mismatch'],
    [{ ...activity, language: 'java' }, 'activity-verification/language-mismatch'],
    [{ ...activity, contentHash: null }, 'activity-verification/content-integrity-unavailable'],
    [{ ...activity, verification: { tests: [] } }, 'activity-verification/test-definition-unavailable'],
  ])('fails closed for invalid authoritative activity state', async (resolved, code) => {
    await expectCode(harness({ resolved }).service.verify({ principal, body: request }), code);
  });

  it('rejects mismatched authoritative bytes before any verifier executes', async () => {
    const resolver = new AuthoritativeActivityResolver({
      loadMetadata: async () => ({ ...activity, contentHash: hash }),
      loadContentBytes: async () => Buffer.from('different'),
      loadVerificationDefinition: async () => activity.verification,
    });
    await expectCode(resolver.resolve(request), 'activity-verification/content-integrity-failed');
  });

  it('resolves exact authoritative bytes, metadata, and private tests together', async () => {
    const bytes = Buffer.from('canonical');
    const resolver = new AuthoritativeActivityResolver({
      loadMetadata: async () => ({ ...activity, contentHash: hash }),
      loadContentBytes: async () => bytes,
      loadVerificationDefinition: async () => activity.verification,
    });
    await expect(resolver.resolve(request)).resolves.toMatchObject({ id: 'question-1', version: 'v2', contentHash: hash });
  });

  it.each([
    [{ isolated: false, hardTimeout: true, networkAccess: false, filesystemAccess: false, memoryLimitBytes: 1, outputLimitBytes: 1 }],
    [{ isolated: true, hardTimeout: false, networkAccess: false, filesystemAccess: false, memoryLimitBytes: 1, outputLimitBytes: 1 }],
    [{ isolated: true, hardTimeout: true, networkAccess: true, filesystemAccess: false, memoryLimitBytes: 1, outputLimitBytes: 1 }],
    [{ isolated: true, hardTimeout: true, networkAccess: false, filesystemAccess: true, memoryLimitBytes: 1, outputLimitBytes: 1 }],
    [{ isolated: true, hardTimeout: true, networkAccess: false, filesystemAccess: false, memoryLimitBytes: limits.memoryLimitBytes + 1, outputLimitBytes: 1 }],
  ])('rejects a non-compliant execution boundary', async (securityProfile) => {
    const unsafe = executor();
    unsafe.securityProfile = securityProfile;
    await expectCode(harness({ execution: unsafe }).service.verify({ principal, body: request }), 'activity-verification/sandbox-unavailable');
  });

  it('maps executor failure without releasing internal details', async () => {
    const failing = executor();
    failing.execute.mockRejectedValue(new Error('private infrastructure detail'));
    const error = await harness({ execution: failing }).service.verify({ principal, body: request }).catch((value) => value);
    expect(sanitizedVerificationError(error)).toEqual({ code: 'activity-verification/verifier-failed', message: 'Activity verification infrastructure failed.', status: 503 });
  });

  it('times out and aborts a verifier that exceeds the configured hard deadline', async () => {
    const slow = executor();
    slow.execute.mockImplementation(({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    await expectCode(harness({ execution: slow }).service.verify({ principal, body: request }), 'activity-verification/timeout');
  });

  it.each([null, {}, { passed: true, testCount: 1 }, { passed: 'true', testCount: 2 }])
    ('rejects malformed verifier results', async (result) => {
      await expectCode(harness({ execution: executor(result) }).service.verify({ principal, body: request }), 'activity-verification/malformed-verifier-result');
    });

  it('uses the same engine contract for a Daily Challenge', async () => {
    const daily = { ...activity, activityType: 'DAILY_CHALLENGE', id: 'challenge-1' };
    const body = { ...request, activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1' };
    await expect(harness({ resolved: daily }).service.verify({ principal, body })).resolves.toMatchObject({ status: 'VERIFIED', rewardStatus: 'UNAVAILABLE' });
  });

  it('rejects a Daily Challenge version mismatch', async () => {
    const daily = { ...activity, activityType: 'DAILY_CHALLENGE', id: 'challenge-1', version: 'v1' };
    const body = { ...request, activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1' };
    await expectCode(harness({ resolved: daily }).service.verify({ principal, body }), 'activity-verification/version-mismatch');
  });

  it('propagates idempotent completion state without awarding coins', async () => {
    const completion = { recordVerifiedCompletion: vi.fn().mockResolvedValue({ duplicate: true }) };
    await expect(harness({ completion }).service.verify({ principal, body: request })).resolves.toMatchObject({ duplicate: true, rewardStatus: 'UNAVAILABLE' });
  });

  it('keeps the production boundary disabled while no compliant sandbox exists', () => {
    expect(productionActivityVerificationBoundary).toMatchObject({
      enabled: false, endpointExposed: false, rewardActivationEnabled: false,
      reason: 'ISOLATED_EXECUTION_SANDBOX_NOT_CONFIGURED', streakEvent: 'SERVER_VERIFIED_ACTIVITY',
    });
  });
});
