import assert from 'node:assert/strict';
import { prepareProgressWrite, reconcileStaleProgress } from '../src/progress/progressReconciliation.js';
import { CallableAbuseGuard, CALLABLE_LIMITS, callableOptions } from '../functions/src/security/CallableAbuseGuard.js';
import { processMaintenancePages } from '../functions/src/certification/AttemptService.js';

function testProgressReconciliation() {
  const newer = {
    currentLesson: 'lesson-3', completedLessons: ['lesson-1', 'lesson-2'], visitedLessons: ['lesson-1', 'lesson-2', 'lesson-3'],
    completedModules: [], bookmarks: ['lesson-2'], courseProgress: 20, sequentialCompletedLessons: 2,
    quizScores: { quiz: { attempts: 2, passed: true, lastAttemptAt: '2026-01-02' } },
    exerciseCompletion: { exercise: { completed: true, completedAt: '2026-01-02' } },
  };
  const stale = {
    currentLesson: 'lesson-1', completedLessons: ['lesson-1'], visitedLessons: ['lesson-1'],
    completedModules: [], bookmarks: [], courseProgress: 10, sequentialCompletedLessons: 1,
    quizScores: { quiz: { attempts: 1, passed: false, lastAttemptAt: '2026-01-01' } },
    exerciseCompletion: { exercise: { completed: false } },
  };
  const merged = reconcileStaleProgress(newer, stale);
  assert.equal(merged.currentLesson, 'lesson-3', 'A stale tab cannot move resume position backward.');
  assert.deepEqual(merged.completedLessons, ['lesson-1', 'lesson-2']);
  assert.deepEqual(merged.visitedLessons, ['lesson-1', 'lesson-2', 'lesson-3']);
  assert.equal(merged.courseProgress, 20);
  assert.equal(merged.quizScores.quiz.passed, true);
  assert.equal(merged.exerciseCompletion.exercise.completed, true);
  const concurrent = reconcileStaleProgress(newer, { ...stale, completedLessons: ['lesson-1', 'lesson-4'] });
  assert.deepEqual(concurrent.completedLessons, ['lesson-1', 'lesson-2', 'lesson-4'], 'Independent valid completions reconcile monotonically.');
  const persistedNewer = { ...newer, revision: 4 };
  const staleWrite = prepareProgressWrite(persistedNewer, stale, 2);
  assert.equal(staleWrite.revision, 5);
  assert.deepEqual(staleWrite.completedLessons, ['lesson-1', 'lesson-2'], 'An out-of-order revision cannot replace newer completion.');
  const currentWrite = prepareProgressWrite(persistedNewer, { ...newer, currentLesson: 'lesson-4' }, 4);
  assert.equal(currentWrite.currentLesson, 'lesson-4', 'A legitimate current revision may update resume position.');
}

async function testRateLimits() {
  const documents = new Map();
  const db = {
    doc: (path) => ({ path }),
    runTransaction: async (operation) => operation({
      get: async ({ path }) => ({ exists: documents.has(path), data: () => documents.get(path) }),
      set: ({ path }, value) => documents.set(path, value),
    }),
  };
  const guard = new CallableAbuseGuard({ db, now: () => 1000 });
  await guard.enforce('user', 'create', { limit: 2, windowMs: 60_000 });
  await guard.enforce('user', 'create', { limit: 2, windowMs: 60_000 });
  await assert.rejects(() => guard.enforce('user', 'create', { limit: 2, windowMs: 60_000 }), (error) => error.code === 'resource-exhausted');
  await guard.enforce('other-user', 'create', { limit: 2, windowMs: 60_000 });
  assert.ok(CALLABLE_LIMITS.heartbeat.limit > CALLABLE_LIMITS.attemptCreate.limit, 'Limits must reflect endpoint workload.');
  const previous = process.env.ENFORCE_CERTIFICATION_APP_CHECK;
  process.env.ENFORCE_CERTIFICATION_APP_CHECK = 'true';
  assert.equal(callableOptions().enforceAppCheck, true);
  process.env.FUNCTIONS_EMULATOR = 'true';
  assert.deepEqual(callableOptions(), {}, 'Emulator traffic must remain supported.');
  delete process.env.FUNCTIONS_EMULATOR;
  if (previous === undefined) delete process.env.ENFORCE_CERTIFICATION_APP_CHECK;
  else process.env.ENFORCE_CERTIFICATION_APP_CHECK = previous;
}

async function runPaged(total, { pageSize = 3, failId = null, insertAfterFirst = false } = {}) {
  const documents = Array.from({ length: total }, (_, index) => ({ id: String(index + 1), data: () => ({}) }));
  let inserted = false;
  const processed = [];
  const result = await processMaintenancePages({
    pageSize,
    maxRuntimeMs: 60_000,
    now: () => 0,
    createQuery: (cursor, size) => ({ get: async () => {
      const start = cursor ? documents.findIndex(({ id }) => id === cursor.id) + 1 : 0;
      const docs = documents.slice(start, start + size);
      return { docs, size: docs.length, empty: docs.length === 0 };
    } }),
    processDocument: async (document) => {
      if (insertAfterFirst && !inserted) { documents.push({ id: '999', data: () => ({}) }); inserted = true; }
      if (document.id === failId) throw new Error('simulated record failure');
      processed.push(document.id);
      return document.id;
    },
  });
  return { result, processed };
}

async function testSchedulerPagination() {
  for (const total of [0, 2, 3, 8]) {
    const { result, processed } = await runPaged(total);
    assert.equal(processed.length, total);
    assert.equal(result.exhausted, true);
  }
  const failed = await runPaged(8, { failId: '4' });
  assert.equal(failed.result.failures.length, 1);
  assert.equal(failed.processed.length, 7, 'One failure must not stop later records.');
  const retry = await runPaged(1);
  assert.equal(retry.processed.length, 1);
  const inserted = await runPaged(4, { insertAfterFirst: true });
  assert.ok(inserted.processed.includes('999'), 'A deterministically ordered insertion after the cursor remains reachable.');
}

testProgressReconciliation();
await testRateLimits();
await testSchedulerPagination();
console.log('Remediation Batch 2 focused validation passed.');
