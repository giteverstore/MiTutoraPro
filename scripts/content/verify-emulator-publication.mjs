import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { FirebaseArtifactStore, FirebaseAssetRegistry, FirebaseContentPublicationStore } from '../../server/admin/content/FirebaseContentPublicationStore.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { adaptCanonicalCourse, adaptCanonicalPractice } from '../../src/content/repositories/CanonicalPublishedRepository.js';
import { createOutputValidatorRegistry } from '../../src/compiler/validators/createOutputValidatorRegistry.js';
import { assertEmulatorOnly } from './migrationCore.mjs';

assertEmulatorOnly();
if (!/^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(process.env.STORAGE_EMULATOR_HOST ?? '')) throw new Error('Publication verification requires a loopback Storage emulator.');
const app = initializeApp({ projectId: 'demo-mitutora', storageBucket: 'demo-mitutora.firebasestorage.app' }, `phase9-publish-${Date.now()}`);
const actor = { uid: 'phase-9-emulator-test', role: 'SUPER_ADMIN' };
try {
  const db = getFirestore(app);
  const store = new FirebaseContentPublicationStore(db);
  const artifacts = new FirebaseArtifactStore(getStorage(app).bucket());
  const service = new ContentPublicationService({ store, artifacts, assets: new FirebaseAssetRegistry(db) });
  const delivery = new PublishedContentService({ store, artifacts });
  const all = await service.listDrafts();
  if (all.length !== 201) throw new Error(`Expected 201 imported drafts; found ${all.length}.`);
  const ids = ['python', 'practice-even-or-odd', 'fund-variables-008'];
  const outcomes = [];
  for (const id of ids) {
    const draft = await service.getDraft(id);
    if (!draft) throw new Error(`Missing draft ${id}.`);
    const validation = await service.validateDraft({ actor, contentId: id, expectedRevision: draft.draftRevision });
    if (!validation.valid) throw new Error(`${id} failed validation: ${JSON.stringify(validation.errors)}`);
    const published = await service.publish({ actor, contentId: id, expectedRevision: draft.draftRevision });
    const active = await delivery.resolveActive(id);
    if (active.document.contentId !== id) throw new Error(`Wrong active content for ${id}.`);
    if (id === 'python') {
      const course = adaptCanonicalCourse(active.document);
      const lessons = course.modules[0].sections.flatMap((section) => section.lessons);
      if (lessons.length !== 109 || !lessons.some((lesson) => lesson.blocks.some((block) => block.type === 'quiz')) || !lessons.some((lesson) => lesson.blocks.some((block) => block.type === 'compiler'))) throw new Error('Published Course parity failed.');
    } else {
      const question = adaptCanonicalPractice(active.document);
      const compiler = question.blocks.at(-1);
      if (compiler.type !== 'compiler' || !compiler.starterCode || !question.publicTests?.length && id === 'fund-variables-008') throw new Error('Published Practice parity failed.');
      const validator = createOutputValidatorRegistry().resolve('normalized-lines');
      const expected = question.verification.expectedOutput;
      if (!validator.validate(expected, ` ${expected}\n`) || validator.validate(expected, 'definitely-wrong')) throw new Error('Expected-output verification changed.');
    }
    outcomes.push({ contentId: id, version: published.version.version, artifactBytes: published.version.artifactSize, active: true });
  }
  console.log(JSON.stringify({ emulator: 'demo-mitutora', importedDrafts: all.length, publishedSubset: outcomes, productionWrites: false }, null, 2));
} finally { await deleteApp(app); }
