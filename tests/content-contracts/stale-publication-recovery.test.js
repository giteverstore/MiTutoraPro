import { describe, expect, it } from 'vitest';
import { FirebaseContentPublicationStore } from '../../server/admin/content/FirebaseContentPublicationStore.js';
import { InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';

const contentId = 'course-1791616150410';
const draftPath = `adminContentDrafts/${contentId}`;
const pointerPath = `publishedContent/${contentId}`;
const versionPath = `${pointerPath}/versions/1`;
const args = { contentId, expectedRevision: 5, expectedVersion: 1, expectedActiveRevision: 0 };
const clone = (value) => structuredClone(value);

function fixture() {
  return {
    draft: {
      contentId, contentType: 'COURSE', draftRevision: 5, lifecycleState: 'PUBLISHING',
      updatedAt: '2026-10-11T13:50:57.230Z',
      validationSummary: {
        valid: true, errors: [], warnings: [], validatedAt: '2026-10-11T13:51:52.288Z',
      },
      document: { content: { title: 'Untitled Course', comingSoon: true } },
    },
    pointer: { contentId, contentType: 'COURSE', latestVersion: 1, activeRevision: 0, activeVersion: null },
    version: { contentId, contentType: 'COURSE', version: 1, status: 'FAILED', sourceDraftRevision: 5 },
  };
}

function createMemoryStore(state) {
  const store = new InMemoryContentPublicationStore();
  if (state.draft) store.drafts.set(contentId, clone(state.draft));
  if (state.pointer) store.pointers.set(contentId, clone(state.pointer));
  if (state.version) store.versions.set(contentId, new Map([[1, clone(state.version)]]));
  return {
    store,
    snapshot: () => ({
      draft: clone(store.drafts.get(contentId)),
      pointer: clone(store.pointers.get(contentId)),
      version: clone(store.versions.get(contentId)?.get(1)),
      audit: clone(store.audit),
    }),
  };
}

function createFirebaseStore(state) {
  const records = new Map();
  if (state.draft) records.set(draftPath, clone(state.draft));
  if (state.pointer) records.set(pointerPath, clone(state.pointer));
  if (state.version) records.set(versionPath, clone(state.version));
  let transactionCount = 0;
  const doc = (path) => ({ path, collection: (name) => ({ doc: (key) => doc(`${path}/${name}/${key}`) }) });
  const db = {
    collection: (name) => ({ doc: (key) => doc(`${name}/${key ?? 'audit-1'}`) }),
    async runTransaction(operation) {
      transactionCount += 1;
      const writes = [];
      const result = await operation({
        get: async (ref) => ({ exists: records.has(ref.path), data: () => clone(records.get(ref.path)) }),
        update: (ref, patch) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...clone(patch) })),
        create: (ref, value) => writes.push(() => records.set(ref.path, clone(value))),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
  return {
    store: new FirebaseContentPublicationStore(db),
    snapshot: () => ({
      draft: clone(records.get(draftPath)),
      pointer: clone(records.get(pointerPath)),
      version: clone(records.get(versionPath)),
      audit: clone(records.get('adminContentAudit/audit-1')),
    }),
    transactionCount: () => transactionCount,
  };
}

const invalidCases = [
  ['revision mismatch', (state, input) => { input.expectedRevision = 4; }],
  ['invalid expected version', (state, input) => { input.expectedVersion = 0; }],
  ['draft missing', (state) => { state.draft = null; }],
  ['wrong draft lifecycle', (state) => { state.draft.lifecycleState = 'VALIDATED'; }],
  ['invalid validation', (state) => { state.draft.validationSummary.valid = false; }],
  ['validation has errors', (state) => { state.draft.validationSummary.errors = [{ message: 'invalid' }]; }],
  ['validation has warnings', (state) => { state.draft.validationSummary.warnings = [{ message: 'unexpected' }]; }],
  ['validation predates current revision', (state) => { state.draft.validationSummary.validatedAt = '2026-10-11T13:49:00.000Z'; }],
  ['explicit validation revision differs', (state) => { state.draft.validationSummary.validatedRevision = 4; }],
  ['missing validation timestamp', (state) => { delete state.draft.validationSummary.validatedAt; }],
  ['comingSoon changed', (state) => { state.draft.document.content.comingSoon = false; }],
  ['content type changed', (state) => { state.draft.contentType = 'PROJECT'; }],
  ['latest version mismatch', (state) => { state.pointer.latestVersion = 2; }],
  ['pointer missing', (state) => { state.pointer = null; }],
  ['active revision mismatch', (state) => { state.pointer.activeRevision = 1; }],
  ['ACTIVE version exists', (state) => { state.pointer.activeVersion = 1; }],
  ['ACTIVE status exists', (state) => { state.pointer.publicationStatus = 'ACTIVE'; }],
  ['version missing', (state) => { state.version = null; }],
  ['version not FAILED', (state) => { state.version.status = 'CREATING'; }],
  ['version source revision mismatch', (state) => { state.version.sourceDraftRevision = 4; }],
  ['version number mismatch', (state) => { state.version.version = 2; }],
  ['draft content ID mismatch', (state) => { state.draft.contentId = 'other-course'; }],
  ['pointer content ID mismatch', (state) => { state.pointer.contentId = 'other-course'; }],
  ['version content ID mismatch', (state) => { state.version.contentId = 'other-course'; }],
];

describe.each([
  ['in-memory', createMemoryStore],
  ['Firestore transaction', createFirebaseStore],
])('stale failed publication recovery (%s)', (_name, createStore) => {
  it('changes only the draft lifecycle and records a safe audit event', async () => {
    const fixtureState = fixture();
    const { store, snapshot, transactionCount } = createStore(fixtureState);
    const before = snapshot();
    await expect(store.recoverStaleFailedPublication(args)).resolves.toEqual({
      contentId, draftRevision: 5, lifecycleState: 'VALIDATED',
    });
    const after = snapshot();
    expect(after.draft).toEqual({ ...before.draft, lifecycleState: 'VALIDATED' });
    expect(after.pointer).toEqual(before.pointer);
    expect(after.version).toEqual(before.version);
    expect(after.audit).toMatchObject(_name === 'in-memory' ? [{
      event: 'STALE_FAILED_PUBLICATION_RECOVERED', contentType: 'COURSE', contentId,
      expectedRevision: 5, failedVersion: 1,
      priorLifecycle: 'PUBLISHING', resultingLifecycle: 'VALIDATED',
    }] : {
      event: 'STALE_FAILED_PUBLICATION_RECOVERED', contentType: 'COURSE', contentId,
      expectedRevision: 5, failedVersion: 1,
      priorLifecycle: 'PUBLISHING', resultingLifecycle: 'VALIDATED',
    });
    if (transactionCount) expect(transactionCount()).toBe(1);
    await expect(store.recoverStaleFailedPublication(args)).rejects.toMatchObject({
      code: 'content/stale-publication-recovery-precondition', status: 409,
    });
    expect(snapshot()).toEqual(after);
  });

  it.each(invalidCases)('rejects %s without changing any record', async (_reason, alter) => {
    const state = fixture();
    const input = { ...args };
    alter(state, input);
    const { store, snapshot, transactionCount } = createStore(state);
    const before = snapshot();
    await expect(store.recoverStaleFailedPublication(input)).rejects.toMatchObject({
      code: 'content/stale-publication-recovery-precondition', status: 409,
    });
    expect(snapshot()).toEqual(before);
    if (transactionCount) expect(transactionCount()).toBe(1);
  });
});
