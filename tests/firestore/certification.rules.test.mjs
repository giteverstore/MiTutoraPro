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
    await setDoc(doc(db, 'users/owner/progress/legacy-course'), { courseId: 'legacy-course', completedLessons: ['lesson-1'] });
    await setDoc(doc(db, 'users/owner'), { uid: 'owner', email: 'owner@example.com', name: 'Owner', avatar: '', emailVerified: true, providers: ['password'], createdAt: '2026-01-01', lastLogin: '2026-01-01' });
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
  const newUser = environment.authenticatedContext('new-user', { email: 'new@example.com', email_verified: true }).firestore();
  await assertSucceeds(setDoc(doc(newUser, 'users/new-user'), { uid: 'new-user', email: 'new@example.com', name: 'New learner', avatar: '', emailVerified: true, providers: ['password'], createdAt: '2026-01-01', lastLogin: '2026-01-01' }));
  await assertFails(setDoc(doc(newUser, 'users/new-user-2'), { uid: 'new-user-2', email: 'new@example.com', name: 'Wrong owner', avatar: '', emailVerified: true, providers: [], createdAt: '2026-01-01', lastLogin: '2026-01-01' }));
  await assertFails(setDoc(doc(newUser, 'users/new-user-role'), { uid: 'new-user-role', email: 'new@example.com', name: 'Role', avatar: '', emailVerified: true, providers: [], createdAt: '2026-01-01', lastLogin: '2026-01-01', roles: ['admin'] }));
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
  await assertSucceeds(updateDoc(doc(owner, 'users/owner'), { name: 'Updated learner', avatar: 'https://example.test/avatar.png', lastLogin: '2026-01-02' }));
  await assertFails(updateDoc(doc(owner, 'users/owner'), { role: 'admin' }));
  await assertFails(updateDoc(doc(owner, 'users/owner'), { emailVerified: false }));
  await assertFails(updateDoc(doc(owner, 'users/owner'), { certificationStatus: 'CERTIFIED' }));
  await assertFails(updateDoc(doc(stranger, 'users/owner'), { name: 'Attacker' }));
  await assertSucceeds(setDoc(doc(owner, 'users/owner/progress/python'), { courseId: 'python', revision: 1, completedLessons: ['lesson-1'] }));
  await assertSucceeds(updateDoc(doc(owner, 'users/owner/progress/legacy-course'), { revision: 1, completedLessons: ['lesson-1', 'lesson-2'] }));
  await assertSucceeds(updateDoc(doc(owner, 'users/owner/progress/python'), { revision: 2, completedLessons: ['lesson-1', 'lesson-2'] }));
  await assertFails(updateDoc(doc(owner, 'users/owner/progress/python'), { revision: 2, completedLessons: [] }));
  await assertFails(setDoc(doc(owner, 'users/owner/referrals/profile'), { successfulReferrals: 100, coinsEarned: 9999 }));
  await assertFails(setDoc(doc(owner, 'users/owner/achievements/fake'), { earned: true, points: 9999 }));
  await assertFails(setDoc(doc(owner, 'users/owner/statistics/overview'), { completedLessons: 9999, streak: 9999 }));
  await assertFails(setDoc(doc(owner, 'users/owner/coinTransactions/fake'), { amount: 9999 }));
  await assertFails(setDoc(doc(owner, 'users/owner/certificates/fake'), { status: 'ACTIVE' }));
  await assertSucceeds(getDoc(doc(owner, 'certificationExams/python-certification')));
  assert.ok(true);
  console.log('Certification Firestore rules validation passed.');
} finally {
  await environment.cleanup();
}
