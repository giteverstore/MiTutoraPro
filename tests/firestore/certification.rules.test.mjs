import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const environment = await initializeTestEnvironment({
  projectId: 'mitutora-certification-rules',
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'examAttempts/attempt-owner'), { ownerUid: 'owner', state: 'RUNNING', expiresAt: 1000, examResult: null, integrityResult: null, certificationDecision: null });
    await setDoc(doc(db, 'examAttempts/attempt-owner/responses/current'), { answers: { q1: 'b' }, revision: 1 });
    await setDoc(doc(db, 'certificates/credential-owner'), { ownerUid: 'owner', courseId: 'python', status: 'ACTIVE' });
    await setDoc(doc(db, 'certificationExams/python-certification'), { published: true, title: 'Python Certification' });
    await setDoc(doc(db, 'users/owner/trustedCourseProgress/python'), { completedLessons: ['lesson-1'] });
    await setDoc(doc(db, 'users/owner/certifications/python'), { eligibilityStatus: 'ELIGIBLE', completionPercentage: 100 });
    await setDoc(doc(db, 'integrityReports/integrity-attempt-owner'), { ownerUid: 'owner', overallStatus: 'CLEAN' });
    await setDoc(doc(db, 'certificationReviews/review-attempt-owner'), { candidateUid: 'owner', status: 'PENDING' });
    await setDoc(doc(db, 'examAttempts/attempt-owner/auditEvents/created'), { type: 'ATTEMPT_CREATED' });
    await setDoc(doc(db, 'examAttempts/attempt-finalized'), { ownerUid: 'owner', state: 'FINALIZED' });
    await setDoc(doc(db, 'examAttempts/attempt-finalized/integrityEvents/private-event'), { type: 'FACE_LOST' });
  });
  const owner = environment.authenticatedContext('owner').firestore();
  const stranger = environment.authenticatedContext('stranger').firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(owner, 'examAttempts/attempt-owner')));
  await assertSucceeds(getDoc(doc(owner, 'examAttempts/attempt-owner/responses/current')));
  await assertSucceeds(getDoc(doc(owner, 'certificates/credential-owner')));
  await assertSucceeds(getDoc(doc(owner, 'integrityReports/integrity-attempt-owner')));
  await assertSucceeds(getDoc(doc(owner, 'certificationReviews/review-attempt-owner')));
  await assertSucceeds(getDoc(doc(owner, 'examAttempts/attempt-owner/auditEvents/created')));
  await assertFails(getDoc(doc(owner, 'examAttempts/attempt-finalized/integrityEvents/private-event')));
  await assertFails(getDoc(doc(stranger, 'examAttempts/attempt-owner')));
  await assertFails(getDoc(doc(stranger, 'certificates/credential-owner')));
  await assertFails(getDoc(doc(stranger, 'integrityReports/integrity-attempt-owner')));
  await assertFails(getDoc(doc(anonymous, 'examAttempts/attempt-owner')));
  await assertFails(updateDoc(doc(owner, 'examAttempts/attempt-owner'), { examResult: { score: 100 } }));
  await assertFails(updateDoc(doc(owner, 'examAttempts/attempt-owner'), { integrityResult: { score: 100 } }));
  await assertFails(updateDoc(doc(owner, 'examAttempts/attempt-owner'), { certificationDecision: { status: 'CERTIFIED' } }));
  await assertFails(updateDoc(doc(owner, 'examAttempts/attempt-owner'), { expiresAt: 999999 }));
  await assertFails(updateDoc(doc(owner, 'examAttempts/attempt-owner'), { ownerUid: 'stranger' }));
  await assertFails(setDoc(doc(owner, 'certificates/fake'), { ownerUid: 'owner', status: 'ACTIVE' }));
  await assertFails(setDoc(doc(owner, 'examAttempts/attempt-owner/responses/current'), { answers: {}, revision: 2 }));
  await assertFails(setDoc(doc(owner, 'users/owner/trustedCourseProgress/python'), { completedLessons: ['fake'] }));
  await assertFails(updateDoc(doc(owner, 'users/owner/certifications/python'), { eligibilityStatus: 'CERTIFIED' }));
  await assertFails(setDoc(doc(owner, 'integrityReports/fake'), { ownerUid: 'owner', overallStatus: 'CLEAN' }));
  await assertFails(setDoc(doc(owner, 'certificationReviews/fake'), { candidateUid: 'owner', status: 'RESOLVED' }));
  await assertFails(setDoc(doc(owner, 'examAttempts/attempt-owner/auditEvents/fake'), { type: 'DECISION_MADE' }));
  await assertSucceeds(getDoc(doc(owner, 'certificationExams/python-certification')));
  assert.ok(true);
  console.log('Certification Firestore rules validation passed.');
} finally {
  await environment.cleanup();
}
