import { describe, expect, it } from 'vitest';
import { ProcessLocalTutorExperienceStore } from '../../server/ai/tutor/TutorExperienceStore.js';
import { FirestoreTutorExperienceStore } from '../../server/ai/tutor/FirestoreTutorExperienceStore.js';
import { TutorExperienceService } from '../../server/ai/tutor/TutorExperienceService.js';
import { classifyTutorCacheEligibility, createExactTutorCacheKey, normalizeExactTutorQuestion } from '../../server/ai/tutor/tutorCachePolicy.js';
import { tutorIncludedUsageDateKey } from '../../server/ai/tutor/tutorIncludedUsageDay.js';

const scope = { surface: 'course', scopeId: 'python', activityId: 'loops', contentVersion: 7 };
const entitlement = { includedTutorMessages: 30, unlimitedTutorMessages: false };
const principal = { uid: 'learner-a' };
const body = (requestId, question = 'What does range() do?') => ({ requestId, learnerMessage: question, language: 'python' });
const service = (store) => new TutorExperienceService({ store, identityKey: (uid) => `owner-${uid}` });

function firestore() {
  const records = new Map();
  let queue = Promise.resolve();
  const snapshot = (path) => ({ exists: records.has(path), data: () => records.get(path) });
  const ref = (path) => ({ path, get: async () => snapshot(path) });
  return {
    records,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction(operation) {
      const result = queue.then(() => operation({
        get: async (document) => snapshot(document.path),
        set: (document, value) => records.set(document.path, { ...value }),
        create: (document, value) => { if (records.has(document.path)) throw new Error('already exists'); records.set(document.path, { ...value }); },
        update: (document, value) => records.set(document.path, { ...records.get(document.path), ...value }),
      }));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

describe('global included Tutor messages', () => {
  it('shares one 30-message pool and rejects the 31st successful reservation', async () => {
    const store = new ProcessLocalTutorExperienceStore(); const experience = service(store);
    let usage;
    for (let index = 0; index < 30; index += 1) { const prepared = await experience.prepare({ principal, entitlement, scope: { ...scope, surface: ['course', 'practice', 'project'][index % 3] }, body: body(`request-${String(index).padStart(8, '0')}`) }); usage = await experience.complete(prepared, { scope, body: body(`request-${String(index).padStart(8, '0')}`), response: { summary: 'answer' } }); if (index === 0) expect(usage).toMatchObject({ usedMessages: 1, remainingMessages: 29 }); }
    expect(usage).toMatchObject({ usedMessages: 30, remainingMessages: 0 });
    await expect(experience.prepare({ principal, entitlement, scope, body: body('request-00000030') })).rejects.toMatchObject({ code: 'ai/included-messages-exhausted' });
    expect(store.snapshot('owner-learner-a')).toEqual({ dateKey: tutorIncludedUsageDateKey(), usedMessages: 30, reservedMessages: 0 });
  });
  it('atomically permits only one concurrent final reservation', async () => { const store = new ProcessLocalTutorExperienceStore(); const experience = service(store); store.usage.set('owner-learner-a', { dateKey: tutorIncludedUsageDateKey(), usedMessages: 29, reservedMessages: 0 }); const results = await Promise.allSettled([experience.prepare({ principal, entitlement, scope, body: body('request-concurrent-a') }), experience.prepare({ principal, entitlement, scope, body: body('request-concurrent-b') })]); expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1); expect(results.filter((item) => item.status === 'rejected')[0].reason.code).toBe('ai/included-messages-exhausted'); });
  it('releases failures and settles duplicate request IDs idempotently', async () => { const store = new ProcessLocalTutorExperienceStore(); const experience = service(store); const prepared = await experience.prepare({ principal, entitlement, scope, body: body('request-idempotent') }); await experience.release(prepared); await experience.release(prepared); expect(store.snapshot('owner-learner-a')).toEqual({ dateKey: tutorIncludedUsageDateKey(), usedMessages: 0, reservedMessages: 0 }); });
  it('lets unlimited entitlement bypass included cap without weakening the store boundary', async () => { const store = new ProcessLocalTutorExperienceStore(); store.usage.set('owner-learner-a', { dateKey: tutorIncludedUsageDateKey(), usedMessages: 30, reservedMessages: 0 }); await expect(service(store).prepare({ principal, entitlement: { includedTutorMessages: 30, unlimitedTutorMessages: true }, scope, body: body('request-unlimited') })).resolves.toMatchObject({ capability: { unlimitedTutorMessages: true } }); });

  it('resets the shared allowance at the Asia/Kolkata calendar boundary without resetting on remount', async () => {
    let now = Date.parse('2026-11-03T18:29:59.000Z');
    const store = new ProcessLocalTutorExperienceStore({ now: () => now });
    const firstService = service(store);
    const first = await firstService.prepare({ principal, entitlement, scope, body: body('request-day-one-0001') });
    expect(await firstService.complete(first, { scope, body: body('request-day-one-0001'), response: { summary: 'answer' } })).toMatchObject({ usedMessages: 1, remainingMessages: 29 });
    expect(store.snapshot('owner-learner-a')).toMatchObject({ dateKey: '2026-11-03', usedMessages: 1 });
    expect(service(store).store).toBe(store);
    expect(await store.usageSnapshot('owner-learner-a')).toMatchObject({ dateKey: '2026-11-03', usedMessages: 1 });

    now = Date.parse('2026-11-03T18:30:00.000Z');
    expect(await store.usageSnapshot('owner-learner-a')).toEqual({ dateKey: '2026-11-04', usedMessages: 0, reservedMessages: 0 });
    const next = await service(store).prepare({ principal, entitlement, scope, body: body('request-day-two-0001') });
    expect(await service(store).complete(next, { scope, body: body('request-day-two-0001'), response: { summary: 'answer' } })).toMatchObject({ usedMessages: 1, remainingMessages: 29 });
  });

  it('does not reuse legacy or stale prior-day counters', async () => {
    const now = Date.parse('2026-11-03T12:00:00.000Z');
    const store = new ProcessLocalTutorExperienceStore({ now: () => now });
    store.usage.set('owner-learner-a', { usedMessages: 20, reservedMessages: 4 });
    expect(await store.usageSnapshot('owner-learner-a')).toEqual({ dateKey: '2026-11-03', usedMessages: 0, reservedMessages: 0 });
  });
});

describe('persistent history and Practice retention', () => {
  it('returns exactly five latest messages then five older using a stable cursor', async () => { const store = new ProcessLocalTutorExperienceStore(); for (let index = 0; index < 6; index += 1) await store.persistInteraction({ ownerKey: 'owner-a', requestId: `turn-${index}`, scope, userText: `q${index}`, assistant: { summary: `a${index}` }, metadata: {} }); const latest = await store.history({ ownerKey: 'owner-a', scope, limit: 5 }); expect(latest.items).toHaveLength(5); expect(latest.items.map((item) => item.createdAt)).toEqual([...latest.items.map((item) => item.createdAt)].sort((a, b) => a - b)); const older = await store.history({ ownerKey: 'owner-a', scope, limit: 5, before: latest.nextCursor }); expect(older.items).toHaveLength(5); expect(new Set([...older.items, ...latest.items].map((item) => item.id)).size).toBe(10); });
  it('isolates owners and does not expose Practice analytics as history', async () => { const store = new ProcessLocalTutorExperienceStore(); await store.persistInteraction({ ownerKey: 'owner-a', requestId: 'practice-event', scope: { ...scope, surface: 'practice' }, userText: 'private', assistant: { summary: 'answer' }, metadata: {} }); expect(store.analytics).toHaveLength(1); await expect(store.history({ ownerKey: 'owner-a', scope: { ...scope, surface: 'practice' } })).resolves.toEqual({ items: [], nextCursor: null }); await expect(store.history({ ownerKey: 'owner-b', scope })).resolves.toEqual({ items: [], nextCursor: null }); });
});

describe('Firestore daily included-message enforcement', () => {
  it('persists same-day usage across store instances and resets stale documents atomically', async () => {
    let now = Date.parse('2026-11-03T18:29:59.000Z');
    const db = firestore();
    const firstStore = new FirestoreTutorExperienceStore({ db, now: () => now });
    const first = await service(firstStore).prepare({ principal, entitlement, scope, body: body('firestore-request-0001') });
    await service(firstStore).complete(first, { scope, body: { ...body('firestore-request-0001'), requestType: 'project-questions' }, response: { summary: 'answer' } });
    expect(await new FirestoreTutorExperienceStore({ db, now: () => now }).usageSnapshot('owner-learner-a')).toMatchObject({ dateKey: '2026-11-03', usedMessages: 1 });

    now = Date.parse('2026-11-03T18:30:00.000Z');
    const nextStore = new FirestoreTutorExperienceStore({ db, now: () => now });
    expect(await nextStore.usageSnapshot('owner-learner-a')).toEqual({ dateKey: '2026-11-04', usedMessages: 0, reservedMessages: 0 });
    const next = await service(nextStore).prepare({ principal, entitlement, scope, body: body('firestore-request-0002') });
    await service(nextStore).complete(next, { scope, body: { ...body('firestore-request-0002'), requestType: 'project-questions' }, response: { summary: 'answer' } });
    expect(db.records.get('aiTutorIncludedUsage/owner-learner-a')).toMatchObject({ dateKey: '2026-11-04', usedMessages: 1, reservedMessages: 0 });
  });
});

describe('exact cache privacy and invalidation', () => {
  it('normalizes only harmless punctuation/spacing and versions every key dimension', () => { expect(normalizeExactTutorQuestion('  What does len() do? ')).toBe('what does len do'); const normalizedQuestion = normalizeExactTutorQuestion('What is a list?'); const base = createExactTutorCacheKey({ scope, language: 'python', normalizedQuestion }); expect(createExactTutorCacheKey({ scope: { ...scope, activityId: 'lists' }, language: 'python', normalizedQuestion })).not.toBe(base); expect(createExactTutorCacheKey({ scope: { ...scope, contentVersion: 8 }, language: 'python', normalizedQuestion })).not.toBe(base); });
  it('keeps canonical numeric and source-qualified string content identities distinct', () => {
    const normalizedQuestion = normalizeExactTutorQuestion('What is a list?');
    const canonical = createExactTutorCacheKey({ scope: { ...scope, contentSource: 'admin', contentVersion: 2 }, language: 'python', normalizedQuestion });
    expect(createExactTutorCacheKey({ scope: { ...scope, contentSource: 'legacy-course', contentVersion: 'v2' }, language: 'python', normalizedQuestion })).not.toBe(canonical);
  });
  it.each([{ learnerMessage: 'Why does my code fail?', code: 'print(1)' }, { selectedCode: 'x' }, { compilerOutput: 'error' }, { conversation: [{ question: 'q', answer: 'a' }] }, { learnerMessage: 'Give me the complete solution' }])('rejects context-dependent cache input %j', (extra) => expect(classifyTutorCacheEligibility({ learnerMessage: 'What is a list?', ...extra }, scope).eligible).toBe(false));
  it('stores no learner identity in reusable cache entries and a hit still consumes one message', async () => { const store = new ProcessLocalTutorExperienceStore(); const experience = service(store); const first = await experience.prepare({ principal, entitlement, scope, body: body('request-cache-first', 'What is a list?') }); await experience.complete(first, { scope, body: body('request-cache-first', 'What is a list?'), response: { summary: 'A collection.' } }); const second = await experience.prepare({ principal: { uid: 'learner-b' }, entitlement, scope, body: body('request-cache-second', ' what is a list ') }); expect(second.cachedResponse).toEqual({ summary: 'A collection.' }); await experience.complete(second, { scope, body: body('request-cache-second', ' what is a list '), response: second.cachedResponse }); expect(store.snapshot('owner-learner-b').usedMessages).toBe(1); expect(JSON.stringify([...store.cache.values()])).not.toContain('learner-a'); });
});
