import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

let environment;
const bytes = new TextEncoder().encode('{"ok":true}');
const active = { contentType: 'application/json', customMetadata: { publicationState: 'ACTIVE' } };
const inactive = { contentType: 'application/json', customMetadata: { publicationState: 'INACTIVE' } };
const ready = { contentType: 'application/json', customMetadata: { publicationState: 'READY' } };
const creating = { contentType: 'application/json', customMetadata: { publicationState: 'CREATING' } };

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'mitutora-storage-rules-test',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.FIREBASE_RULES_TEST_PORT || 9199) },
  });
});
after(async () => environment.cleanup());
beforeEach(async () => {
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();
    await uploadBytes(ref(storage, 'course-content/python/v1/course.json'), bytes, active);
    await uploadBytes(ref(storage, 'course-content/python/v2/course.json'), bytes, inactive);
    await uploadBytes(ref(storage, 'practice/python/v1/question-1.json'), bytes, active);
    await uploadBytes(ref(storage, 'daily-challenges/python/v1/2026-08-01.json'), bytes, active);
    await uploadBytes(ref(storage, 'protected/practice/python/answers.json'), bytes, active);
    await uploadBytes(ref(storage, 'users/alice/private.json'), bytes, active);
    await uploadBytes(ref(storage, 'published-content/projects/project-one/v1.json'), bytes, ready);
    await uploadBytes(ref(storage, 'published-content/projects/project-one/v2.json'), bytes, creating);
    await uploadBytes(ref(storage, 'published-content/courses/course-one/v1.json'), bytes, ready);
    await uploadBytes(ref(storage, 'published-content/practices/practice-one/v1.json'), bytes, ready);
    await uploadBytes(ref(storage, 'published-content/challenges/challenge-one/v1.json'), bytes, ready);
    await uploadBytes(ref(storage, 'admin-content-assets/asset-one.png'), bytes, { contentType: 'image/png' });
  });
});

for (const identity of ['unauthenticated', 'authenticated']) {
  test(`${identity} learners can read only active published content`, async () => {
    const context = identity === 'authenticated' ? environment.authenticatedContext('alice') : environment.unauthenticatedContext();
    const storage = context.storage();
    await assertSucceeds(getBytes(ref(storage, 'course-content/python/v1/course.json')));
    await assertSucceeds(getBytes(ref(storage, 'practice/python/v1/question-1.json')));
    await assertSucceeds(getBytes(ref(storage, 'daily-challenges/python/v1/2026-08-01.json')));
    await assertFails(getBytes(ref(storage, 'course-content/python/v2/course.json')));
    await assertFails(getBytes(ref(storage, 'protected/practice/python/answers.json')));
    await assertFails(getBytes(ref(storage, 'users/alice/private.json')));
    await assertFails(getBytes(ref(storage, 'course-content/python/v1/../private.json')));
    await assertSucceeds(getBytes(ref(storage, 'published-content/projects/project-one/v1.json')));
    await assertSucceeds(getBytes(ref(storage, 'published-content/courses/course-one/v1.json')));
    await assertSucceeds(getBytes(ref(storage, 'published-content/practices/practice-one/v1.json')));
    await assertSucceeds(getBytes(ref(storage, 'published-content/challenges/challenge-one/v1.json')));
    await assertFails(getBytes(ref(storage, 'published-content/projects/project-one/v2.json')));
    await assertFails(getBytes(ref(storage, 'admin-content-assets/asset-one.png')));
  });
}

test('clients cannot create, overwrite, or activate content', async () => {
  const storage = environment.authenticatedContext('alice').storage();
  await assertFails(uploadBytes(ref(storage, 'practice/python/v1/question-2.json'), bytes, active));
  await assertFails(uploadBytes(ref(storage, 'practice/python/v1/question-1.json'), bytes, active));
  await assertFails(uploadBytes(ref(storage, 'course-content/python/v2/course.json'), bytes, active));
  await assertFails(uploadBytes(ref(storage, 'published-content/projects/project-one/v3.json'), bytes, ready));
  await assertFails(uploadBytes(ref(storage, 'published-content/courses/course-one/v1.json'), bytes, ready));
  await assertFails(uploadBytes(ref(storage, 'published-content/practices/practice-one/v2.json'), bytes, ready));
  await assertFails(uploadBytes(ref(storage, 'published-content/challenges/challenge-one/v2.json'), bytes, ready));
  await assertFails(uploadBytes(ref(storage, 'admin-content-assets/asset-two.png'), bytes, { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(storage, 'unversioned/course.json'), bytes, ready));
});
