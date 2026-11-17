import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const environment = await initializeTestEnvironment({
  projectId: 'demo-v2-progress-rules',
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/learner/v2CourseProgress/v2_course_course-a_version_1'), {
      namespace: 'v2', contentId: 'course-a', publicationVersion: 1, revision: 1,
    });
  });
  const learner = environment.authenticatedContext('learner').firestore();
  const otherLearner = environment.authenticatedContext('other-learner').firestore();
  const progress = doc(learner, 'users/learner/v2CourseProgress/v2_course_course-a_version_1');
  await assertFails(getDoc(progress));
  await assertFails(setDoc(progress, { namespace: 'v2', contentId: 'course-a', publicationVersion: 1, revision: 2 }));
  await assertFails(getDoc(doc(otherLearner, 'users/learner/v2CourseProgress/v2_course_course-a_version_1')));
  console.log('V2 progress browser access remains denied; server Admin SDK access is authoritative.');
} finally {
  await environment.cleanup();
}
