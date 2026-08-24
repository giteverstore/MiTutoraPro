import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const environment = await initializeTestEnvironment({
  projectId: 'mitutora-content-rules',
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'contentPublications/practice-python'), { status: 'ACTIVE', activeVersion: 'v2' });
    await setDoc(doc(db, 'contentPublications/course-python'), { status: 'READY', activeVersion: 'v2' });
    await setDoc(doc(db, 'practiceQuestions/published'), { published: true, version: 'v2' });
    await setDoc(doc(db, 'practiceQuestions/draft'), { published: false, version: 'v3' });
  });
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, 'contentPublications/practice-python')));
  await assertFails(getDoc(doc(anonymous, 'contentPublications/course-python')));
  await assertSucceeds(getDoc(doc(anonymous, 'practiceQuestions/published')));
  await assertFails(getDoc(doc(anonymous, 'practiceQuestions/draft')));
  await assertFails(setDoc(doc(anonymous, 'contentPublications/attacker'), { status: 'ACTIVE' }));
  console.log('Content publication Firestore rules validation passed.');
} finally {
  await environment.cleanup();
}
