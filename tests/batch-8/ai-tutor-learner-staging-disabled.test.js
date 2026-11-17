import { describe, expect, it, vi } from 'vitest';
import { createAIExplainHandler } from '../../api/ai/explain.js';
import { viteAITutorPlugin } from '../../server/ai/viteAITutorPlugin.js';
import { createTutorFeatureGate } from '../../server/ai/tutor/tutorFeatureGate.js';
import {
  LEARNER_STAGING_DISABLED_BOUNDARY,
  requiresFederatedTutorCredentials,
  resolveTutorRuntimeProfile,
  TUTOR_RUNTIME_PROFILES,
} from '../../server/ai/tutor/tutorRuntimeConfig.js';

const stagingEnvironment = (overrides = {}) => ({
  NODE_ENV: 'production',
  VERCEL_ENV: 'preview',
  VERCEL_PROJECT_NAME: 'ycoders-learner-staging',
  VERCEL_PROJECT_ID: 'prj_AZ45waZW70SNXP1VkgBHiU8CRNR4',
  FIREBASE_PROJECT_ID: 'ycoders-v2-staging',
  AI_TUTOR_RUNTIME_BOUNDARY: LEARNER_STAGING_DISABLED_BOUNDARY,
  AI_TUTOR_ENABLED: 'false',
  AI_TUTOR_ROLLOUT_PERCENTAGE: '0',
  ...overrides,
});

function response() {
  return {
    writableEnded: false,
    setHeader: vi.fn(),
    status: vi.fn(function status() { return this; }),
    json: vi.fn((value) => value),
    once: vi.fn(),
    off: vi.fn(),
  };
}

describe('learner-staging-disabled AI Tutor runtime profile', () => {
  it('accepts only the immutable learner Preview identity and exposes zero capabilities', () => {
    const profile = resolveTutorRuntimeProfile(stagingEnvironment());
    expect(profile).toBe(TUTOR_RUNTIME_PROFILES[LEARNER_STAGING_DISABLED_BOUNDARY]);
    expect(profile).toMatchObject({
      projectId: 'ycoders-v2-staging',
      vercel: {
        teamSlug: 'avinashabbigeris-projects',
        teamId: 'team_JWeTI30xjnERJbMpLUkgTpzV',
        projectName: 'ycoders-learner-staging',
        projectId: 'prj_AZ45waZW70SNXP1VkgBHiU8CRNR4',
        environment: 'preview',
        subject: 'owner:avinashabbigeris-projects:project:ycoders-learner-staging:environment:preview',
      },
      capabilities: {
        providerAccess: false,
        modelInvocation: false,
        quotaBackend: false,
        tutorServiceIdentity: false,
        tutorWif: false,
        tutorPersistence: false,
        externalAIRequests: false,
      },
    });
    expect(profile).not.toHaveProperty('wif');
    expect(profile).not.toHaveProperty('quotaDatabaseId');
    expect(profile).not.toHaveProperty('runtimeServiceAccountEmail');
    expect(requiresFederatedTutorCredentials(stagingEnvironment())).toBe(false);
  });

  it.each([
    ['enabled Tutor', { AI_TUTOR_ENABLED: 'true' }],
    ['non-zero rollout', { AI_TUTOR_ROLLOUT_PERCENTAGE: '1' }],
    ['wrong Firebase project', { FIREBASE_PROJECT_ID: 'mi-tutora-pro' }],
    ['validation Firebase project', { FIREBASE_PROJECT_ID: 'mi-tutora-ai-val-260904-k7m3' }],
    ['wrong Vercel project', { VERCEL_PROJECT_NAME: 'ycoders' }],
    ['Admin Vercel project', { VERCEL_PROJECT_NAME: 'ycoders-admin' }],
    ['wrong Vercel project ID', { VERCEL_PROJECT_ID: 'prj_wrong' }],
    ['Production environment', { VERCEL_ENV: 'production' }],
    ['validation Vercel identity', { VERCEL_PROJECT_NAME: 'mi-tutora-pro-ai-validation', VERCEL_PROJECT_ID: 'prj_MXRcPMPyTAtqbfHJbFote2I3bRAD' }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => resolveTutorRuntimeProfile(stagingEnvironment(overrides)))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });

  it.each([
    ['provider selection', { AI_PROVIDER: 'openai' }],
    ['provider credential', { OPENAI_API_KEY: 'not-a-real-secret' }],
    ['validation quota database', { AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota-validation' }],
    ['quota backend', { AI_TUTOR_QUOTA_BACKEND: 'firestore' }],
    ['Tutor WIF audience', { GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/test/providers/test' }],
    ['Tutor service identity', { GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'tutor@example.invalid' }],
    ['long-lived service credential', { FIREBASE_SERVICE_ACCOUNT_JSON: '{}' }],
  ])('rejects contradictory %s configuration', (_label, overrides) => {
    expect(() => resolveTutorRuntimeProfile(stagingEnvironment(overrides)))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });

  it('constructs a disabled feature gate without a quota backend', () => {
    const gate = createTutorFeatureGate(stagingEnvironment());
    expect(gate.evaluate({ uid: 'pilot-learner' })).toMatchObject({ enabled: false, state: 'disabled' });
    const quotaGuardFactory = vi.fn();
    expect(() => viteAITutorPlugin(stagingEnvironment(), { quotaGuardFactory })).not.toThrow();
    expect(quotaGuardFactory).not.toHaveBeenCalled();
  });

  it('returns the typed disabled response before credentials or backend dependencies are constructed', async () => {
    const credentialFactory = vi.fn();
    const quotaGuardFactory = vi.fn();
    const featureGateFactory = vi.fn();
    const experienceFactory = vi.fn();
    const handler = createAIExplainHandler({
      environment: stagingEnvironment(),
      credentialFactory,
      quotaGuardFactory,
      featureGateFactory,
      experienceFactory,
    });
    const result = response();
    await handler({ method: 'POST', body: {}, headers: {}, once: vi.fn(), off: vi.fn() }, result);
    expect(result.status).toHaveBeenCalledWith(503);
    expect(result.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'ai/disabled' }) });
    expect(credentialFactory).not.toHaveBeenCalled();
    expect(quotaGuardFactory).not.toHaveBeenCalled();
    expect(featureGateFactory).not.toHaveBeenCalled();
    expect(experienceFactory).not.toHaveBeenCalled();
  });

  it('leaves the production and validation profiles unchanged and isolated', () => {
    expect(TUTOR_RUNTIME_PROFILES.production).toMatchObject({
      projectId: 'mi-tutora-pro', quotaDatabaseId: 'ai-tutor-quota', vercelEnvironment: 'production',
    });
    expect(TUTOR_RUNTIME_PROFILES.validation).toMatchObject({
      projectId: 'mi-tutora-ai-val-260904-k7m3',
      quotaDatabaseId: 'ai-tutor-quota-validation',
      runtimeServiceAccountEmail: 'ai-tutor-validation-runtime@mi-tutora-ai-val-260904-k7m3.iam.gserviceaccount.com',
      vercel: { projectName: 'mi-tutora-pro-ai-validation', projectId: 'prj_MXRcPMPyTAtqbfHJbFote2I3bRAD' },
    });
  });
});
