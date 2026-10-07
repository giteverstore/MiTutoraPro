import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ChallengeAssignmentService } from '../../server/admin/content/ChallengeAssignmentService.js';

const environment = await initializeTestEnvironment({
  projectId: 'mitutora-content-rules',
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.FIREBASE_RULES_TEST_PORT || 8080) },
});
try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'contentPublications/practice-python'), { status: 'ACTIVE', activeVersion: 'v2' });
    await setDoc(doc(db, 'contentPublications/course-python'), { status: 'READY', activeVersion: 'v2' });
    await setDoc(doc(db, 'practiceQuestions/published'), { published: true, version: 'v2' });
    await setDoc(doc(db, 'practiceQuestions/draft'), { published: false, version: 'v3' });
    await setDoc(doc(db, 'publishedContent/project-one'), { publicationStatus: 'ACTIVE', activeVersion: 2 });
    await setDoc(doc(db, 'publishedContent/course-one'), { contentType: 'COURSE', publicationStatus: 'ACTIVE', activeVersion: 1 });
    await setDoc(doc(db, 'publishedContent/practice-one'), { contentType: 'PRACTICE', publicationStatus: 'ACTIVE', activeVersion: 1 });
    await setDoc(doc(db, 'publishedContent/challenge-one'), { contentType: 'CHALLENGE', publicationStatus: 'ACTIVE', activeVersion: 1 });
    await setDoc(doc(db, 'dailyChallenges/2026-10-07'), { published: true, canonicalContentId: 'challenge-one', canonicalVersion: 1, version: 'v1' });
    await setDoc(doc(db, 'publishedContent/project-archived'), { publicationStatus: 'ARCHIVED', activeVersion: 1 });
    await setDoc(doc(db, 'publishedContent/project-one/versions/2'), { status: 'READY', version: 2 });
    await setDoc(doc(db, 'adminContentDrafts/project-one'), { draftRevision: 1 });
    await setDoc(doc(db, 'adminContentDrafts/course-one'), { contentType: 'COURSE', draftRevision: 1 });
    await setDoc(doc(db, 'adminContentDrafts/practice-one'), { contentType: 'PRACTICE', draftRevision: 1 });
    await setDoc(doc(db, 'adminContentDrafts/challenge-one'), { contentType: 'CHALLENGE', draftRevision: 1 });
    await setDoc(doc(db, 'adminContentAssets/asset-one'), { storagePath: 'admin-assets/asset-one.png' });
    await setDoc(doc(db, 'adminContentAudit/event-one'), { event: 'CONTENT_PUBLISHED' });
  });
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, 'contentPublications/practice-python')));
  await assertFails(getDoc(doc(anonymous, 'contentPublications/course-python')));
  await assertSucceeds(getDoc(doc(anonymous, 'practiceQuestions/published')));
  await assertFails(getDoc(doc(anonymous, 'practiceQuestions/draft')));
  await assertFails(setDoc(doc(anonymous, 'contentPublications/attacker'), { status: 'ACTIVE' }));
  await assertSucceeds(getDoc(doc(anonymous, 'publishedContent/project-one')));
  await assertSucceeds(getDoc(doc(anonymous, 'publishedContent/course-one')));
  await assertSucceeds(getDoc(doc(anonymous, 'publishedContent/practice-one')));
  await assertSucceeds(getDoc(doc(anonymous, 'publishedContent/challenge-one')));
  await assertSucceeds(getDoc(doc(anonymous, 'dailyChallenges/2026-10-07')));
  await assertFails(getDoc(doc(anonymous, 'publishedContent/project-archived')));
  await assertFails(getDoc(doc(anonymous, 'publishedContent/project-one/versions/2')));
  await assertFails(getDoc(doc(anonymous, 'adminContentDrafts/project-one')));
  await assertFails(getDoc(doc(anonymous, 'adminContentDrafts/course-one')));
  await assertFails(getDoc(doc(anonymous, 'adminContentDrafts/practice-one')));
  await assertFails(getDoc(doc(anonymous, 'adminContentDrafts/challenge-one')));
  await assertFails(getDoc(doc(anonymous, 'adminContentAssets/asset-one')));
  await assertFails(getDoc(doc(anonymous, 'adminContentAudit/event-one')));
  await assertFails(setDoc(doc(anonymous, 'publishedContent/attacker'), { publicationStatus: 'ACTIVE' }));
  await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'adminContentDrafts/course-one'), { draftRevision: 2 }));
  await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'adminContentAssets/asset-one'), { storagePath: 'forged' }));
  await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'adminContentAudit/forged'), { event: 'CONTENT_PUBLISHED' }));
  await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'publishedContent/project-one/versions/3'), { status: 'READY' }));
  await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'publishedContent/practice-one'), { activeVersion: 2 }));
  await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'publishedContent/challenge-one'), { activeVersion: 2 }));
  await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'dailyChallenges/2026-10-07'), { published: false }));
  process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${process.env.FIREBASE_RULES_TEST_PORT || 8080}`;
  const adminApp = initializeApp({ projectId: 'mitutora-content-rules' }, 'phase13-assignment-test');
  try {
    const adminDb = getFirestore(adminApp);
    const contentId = 'phase13-emulator-challenge';
    await adminDb.doc(`publishedContent/${contentId}`).set({ contentType: 'CHALLENGE', publicationStatus: 'ACTIVE', activeVersion: 1 });
    const challenge = { contentId, contentType: 'CHALLENGE', version: 1, content: { date: '2027-01-02', difficulty: 'easy', reward: { coins: 20, streakIncrement: 1 } } };
    const assignmentService = new ChallengeAssignmentService({ db: adminDb, delivery: { resolveActive: async () => ({ document: challenge }) }, now: () => new Date('2026-10-07T00:00:00Z') });
    const assigned = await assignmentService.assign({ contentId, actor: { uid: 'admin' } });
    if (assigned.canonicalVersion !== 1 || assigned.version !== 'v1') throw new Error('Assignment version pin failed.');
    await assertFails(setDoc(doc(environment.authenticatedContext('learner').firestore(), 'dailyChallenges/2027-01-02'), { rewardCoins: 999 }));
    await assert.rejects(() => assignmentService.assign({ contentId, actor: { uid: 'admin' } }), { code: 'challenge/date-occupied' });
  } finally { await deleteApp(adminApp); }
  console.log('Content publication Firestore rules validation passed.');
} finally {
  await environment.cleanup();
}
