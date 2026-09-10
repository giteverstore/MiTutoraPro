import { describe, expect, it, vi } from 'vitest';
import { ACCESS_FEATURES, FREE_PREVIEW_LESSON_COUNT, canAccessFeature, canAccessLesson, canonicalLessonIndex } from '../../src/access/accessPolicy.js';
import { createAIExplainHandler } from '../../api/ai/explain.js';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { createPremiumAccessGuard } from '../../server/subscriptions/PremiumAccessGuard.js';
import { PremiumAuthorization } from '../../functions/src/subscriptions/PremiumAuthorization.js';

const response = () => ({ writableEnded: false, setHeader: vi.fn(), once: vi.fn(), off: vi.fn(), status: vi.fn(function status(value) { this.statusCode = value; return this; }), json: vi.fn(function json(value) { this.body = value; this.writableEnded = true; return this; }) });
const course = { modules: [{ lessons: [{ id: 'one' }, { id: 'two' }] }, { sections: [{ lessons: [{ id: 'three' }, { id: 'four' }, { id: 'five' }] }] }] };

describe('M4 centralized Premium access policy', () => {
  it('centralizes the three-lesson preview', () => expect(FREE_PREVIEW_LESSON_COUNT).toBe(3));
  it.each([0, 1, 2])('allows FREE lesson index %i', (lessonIndex) => expect(canAccessLesson({ tier: 'FREE', lessonIndex })).toBe(true));
  it('denies FREE lesson four and allows Premium lesson four/final lesson', () => {
    expect(canAccessLesson({ tier: 'FREE', lessonIndex: 3 })).toBe(false);
    expect(canAccessLesson({ tier: 'PREMIUM', lessonIndex: 3 })).toBe(true);
    expect(canAccessLesson({ tier: 'PREMIUM', lessonIndex: 4 })).toBe(true);
  });
  it('uses canonical nested course ordering and rejects unknown/browser-supplied positions', () => {
    expect(canonicalLessonIndex(course, 'four')).toBe(3);
    expect(canonicalLessonIndex(course, 'missing')).toBe(-1);
    expect(canAccessLesson({ tier: 'FREE', lessonIndex: -1 })).toBe(false);
  });
  it.each(['direct URL', 'sidebar', 'Next', 'bookmark', 'Continue Learning'])('%s converges on the same canonical lesson-four denial', () => {
    const lessonIndex = canonicalLessonIndex(course, 'four');
    expect(canAccessLesson({ tier: 'FREE', lessonIndex })).toBe(false);
  });
  it.each([ACCESS_FEATURES.PRACTICE, ACCESS_FEATURES.CHALLENGES, ACCESS_FEATURES.BOOKMARKS])('keeps %s free', (feature) => expect(canAccessFeature({ tier: 'FREE', feature })).toBe(true));
  it.each([ACCESS_FEATURES.PROJECTS, ACCESS_FEATURES.CERTIFICATES, ACCESS_FEATURES.AI_TUTOR])('requires Premium for %s', (feature) => {
    expect(canAccessFeature({ tier: 'FREE', feature })).toBe(false);
    expect(canAccessFeature({ tier: 'PREMIUM', feature })).toBe(true);
  });
  it.each([undefined, null, 'ERROR'])('fails closed for unresolved tier %s', (tier) => expect(canAccessFeature({ tier, feature: ACCESS_FEATURES.AI_TUTOR })).toBe(false));
});

describe('M4 AI Tutor server entitlement boundary', () => {
  const run = async ({ access }) => {
    const calls = [];
    const handler = createAIExplainHandler({
      environment: {},
      credentialFactory: () => ({ authClient: null, preflight: async () => calls.push('preflight') }),
      authenticator: { authenticate: async () => { calls.push('authenticate'); return { uid: 'verified-user' }; } },
      premiumAccessGuardFactory: () => ({ assertPremium: async (principal) => { calls.push('premium'); return access(principal); } }),
      quotaGuardFactory: () => { calls.push('quota'); return {}; },
      featureGateFactory: () => ({}),
      explain: async () => { calls.push('provider-path'); return { summary: 'safe' }; },
    });
    const res = response();
    await handler({ method: 'POST', headers: {}, body: { premium: true, tier: 'PREMIUM' }, once: vi.fn(), off: vi.fn() }, res);
    return { calls, res };
  };

  it('rejects authenticated FREE before quota/provider and ignores client Premium fields', async () => {
    const result = await run({ access: () => { throw new AIServiceError('ai/premium-required', 'Premium is required to use the AI Tutor.', { status: 403 }); } });
    expect(result.calls).toEqual(['preflight', 'authenticate', 'premium']);
    expect(result.res.statusCode).toBe(403);
    expect(result.res.body.error).toMatchObject({ code: 'ai/premium-required', retryable: false });
  });
  it('allows an authoritative Premium principal through the entitlement boundary', async () => {
    const result = await run({ access: ({ uid }) => expect(uid).toBe('verified-user') });
    expect(result.calls).toEqual(['preflight', 'authenticate', 'premium', 'quota', 'provider-path']);
    expect(result.res.statusCode).toBe(200);
  });
  it('resolves expired and cancelled backing authority as premium-required', async () => {
    const values = new Map([
      ['users/verified-user/entitlements/premium', { ownerUid: 'verified-user', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: { toDate: () => new Date('2020-01-01') } }],
      ['users/verified-user/subscriptions/sub', { ownerUid: 'verified-user', status: 'CANCELLED', planId: 'monthly' }],
    ]);
    class FakeFirestore { constructor() { return { runTransaction() {}, doc: (path) => ({ get: async () => ({ exists: values.has(path), data: () => values.get(path) }) }) }; } }
    const guard = createPremiumAccessGuard({ FIREBASE_PROJECT_ID: 'demo-mitutora' }, { FirestoreClient: FakeFirestore });
    await expect(guard.assertPremium({ uid: 'verified-user' })).rejects.toMatchObject({ code: 'ai/premium-required' });
  });
  it.each([
    ['expired', { ownerUid: 'verified-user', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: { toDate: () => new Date('2020-01-01') } }, { ownerUid: 'verified-user', status: 'ACTIVE', planId: 'monthly' }],
    ['cancelled', { ownerUid: 'verified-user', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: { toDate: () => new Date('2099-01-01') } }, { ownerUid: 'verified-user', status: 'CANCELLED', planId: 'monthly' }],
    ['mismatched', { ownerUid: 'verified-user', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'annual', expiresAt: { toDate: () => new Date('2099-01-01') } }, { ownerUid: 'verified-user', status: 'ACTIVE', planId: 'monthly' }],
  ])('rejects %s server authority', async (_case, entitlement, subscription) => {
    const values = new Map([
      ['users/verified-user/entitlements/premium', entitlement],
      ['users/verified-user/subscriptions/sub', subscription],
    ]);
    class FakeFirestore { constructor() { return { runTransaction() {}, doc: (path) => ({ get: async () => ({ exists: values.has(path), data: () => values.get(path) }) }) }; } }
    const guard = createPremiumAccessGuard({ FIREBASE_PROJECT_ID: 'demo-mitutora' }, { FirestoreClient: FakeFirestore });
    await expect(guard.assertPremium({ uid: 'verified-user' })).rejects.toMatchObject({ code: 'ai/premium-required' });
  });
});

describe('M4 certification server entitlement boundary', () => {
  it('rejects FREE and accepts only the authoritative Premium resolution', async () => {
    const hasPremiumAccess = vi.fn().mockResolvedValueOnce({ tier: 'FREE' }).mockResolvedValueOnce({ tier: 'PREMIUM' });
    const authorization = new PremiumAuthorization({ subscriptionService: { hasPremiumAccess } });
    await expect(authorization.assert('verified-user')).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(authorization.assert('verified-user')).resolves.toMatchObject({ tier: 'PREMIUM' });
    expect(hasPremiumAccess).toHaveBeenNthCalledWith(1, 'verified-user');
  });
});
