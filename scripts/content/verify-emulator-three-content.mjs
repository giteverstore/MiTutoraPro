import { performance } from 'node:perf_hooks';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { FirebaseArtifactStore, FirebaseAssetRegistry, FirebaseContentPublicationStore } from '../../server/admin/content/FirebaseContentPublicationStore.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { assertEmulatorOnly } from './migrationCore.mjs';

assertEmulatorOnly();
if (!/^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(process.env.STORAGE_EMULATOR_HOST ?? '')) throw new Error('Publication verification requires a loopback Storage emulator.');
const app = initializeApp({ projectId: 'demo-mitutora', storageBucket: 'demo-mitutora.firebasestorage.app' }, `phase10-publication-${Date.now()}`);
const actor = { uid: 'phase-10-emulator-test', role: 'SUPER_ADMIN' };
const ids = ['cli-task-manager', 'python', 'practice-even-or-odd', 'fund-variables-008', 'fund-variables-001'];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const db = getFirestore(app);
  const store = new FirebaseContentPublicationStore(db);
  const artifacts = new FirebaseArtifactStore(getStorage(app).bucket());
  const publication = new ContentPublicationService({ store, artifacts, assets: new FirebaseAssetRegistry(db) });
  const delivery = new PublishedContentService({ store, artifacts });
  const drafts = await publication.listDrafts();
  assert(drafts.length === 202, `Expected 202 imported drafts; found ${drafts.length}.`);
  const results = [];
  for (const id of ids) {
    const draft = await publication.getDraft(id);
    assert(draft, `Missing draft ${id}.`);
    const start = performance.now();
    const validation = await publication.validateDraft({ actor, contentId: id, expectedRevision: draft.draftRevision });
    assert(validation.valid, `${id} failed validation: ${JSON.stringify(validation.errors)}`);
    const first = await publication.publish({ actor, contentId: id, expectedRevision: draft.draftRevision });
    const firstMs = Math.round(performance.now() - start);
    assert(first.version.status === 'READY' && (await delivery.resolveActive(id))?.document.version === 1, `${id} v1 did not become ACTIVE.`);
    const initial = (await delivery.fetchVersion(id, 1)).document;
    if (id === 'cli-task-manager') assert(initial.content.checkpoints.length === 5 && initial.content.supportedLanguages.length === 4, 'Published Project parity failed.');
    if (id === 'python') assert(initial.content.modules[0].sections.flatMap((section) => section.lessons).length === 109, 'Published Course parity failed.');
    const secondDocument = { ...draft.document, metadata: { ...draft.document.metadata, phase10AcceptanceVersion: 2 } };
    const saved = await publication.saveDraft({ actor, document: secondDocument, expectedRevision: draft.draftRevision });
    const second = await publication.publish({ actor, contentId: id, expectedRevision: saved.draftRevision, expectedActiveRevision: 1 });
    assert(second.version.status === 'READY' && (await delivery.resolveActive(id))?.document.version === 2, `${id} v2 did not become ACTIVE.`);
    assert(JSON.stringify((await delivery.fetchVersion(id, 1)).document.content) === JSON.stringify(initial.content), `${id} v1 changed after v2 publication.`);
    await publication.activate({ actor, contentId: id, version: 1, expectedActiveRevision: 2 });
    assert((await delivery.resolveActive(id))?.document.version === 1 && (await delivery.fetchVersion(id, 2)).document.version === 2, `${id} rollback failed.`);
    await publication.archive({ actor, contentId: id, expectedActiveRevision: 3 });
    assert(!(await delivery.resolveActive(id)) && (await delivery.fetchVersion(id, 1)).document.version === 1, `${id} archive/pinned artifact failed.`);
    results.push({ id, contentType: initial.contentType, draftBytes: Buffer.byteLength(JSON.stringify(draft.document)), artifactV1Bytes: first.version.artifactSize, artifactV2Bytes: second.version.artifactSize, firstPublicationMs: firstMs, v1Ready: true, v2Ready: true, rollback: true, archive: true, pinnedV1Available: true });
  }
  console.log(JSON.stringify({ emulator: 'demo-mitutora', importedDrafts: drafts.length, results, productionWrites: false }, null, 2));
} finally { await deleteApp(app); }
