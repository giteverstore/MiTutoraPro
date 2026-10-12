import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const environment = await initializeTestEnvironment({
  projectId: 'demo-projects-rules',
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
await environment.clearFirestore();
const metadata = { schemaVersion: 1, projectId: 'task-manager', displayName: 'My Task Manager', languageId: 'python', status: 'active', currentCheckpoint: 0, completedCheckpoints: [], folders: ['data'], entryFilePath: 'main.py', fileIds: ['main.py'], revision: 1, createdAt: '2026-01-01T00:00:00.000Z', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' };
try {
  const owner = environment.authenticatedContext('owner').firestore();
  const attacker = environment.authenticatedContext('attacker').firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const project = doc(owner, 'users/owner/activeProjects/task-manager');
  const file = doc(owner, 'users/owner/activeProjects/task-manager/files/main.py');
  const courseProgress = doc(owner, 'users/owner/progress/intro-python');
  await assertSucceeds(setDoc(courseProgress, { courseId: 'intro-python', revision: 1, completed: false }));
  await assertFails(getDoc(doc(attacker, 'users/owner/progress/intro-python')));
  await assertFails(setDoc(project, metadata));
  await environment.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), project.path), metadata));
  await assertSucceeds(setDoc(file, { path: 'main.py', type: 'file', encoding: 'utf-8', content: 'print(1)', editable: true, language: 'python' }));
  await assertSucceeds(getDoc(project));
  await assertFails(getDoc(doc(attacker, 'users/owner/activeProjects/task-manager')));
  await assertFails(getDoc(doc(anonymous, 'users/owner/activeProjects/task-manager')));
  await assertFails(updateDoc(project, { revision: 3 }));
  await assertFails(updateDoc(project, { revision: 2, updatedAt: '2026-01-02T00:00:00.000Z' }));
  const metadataV3 = {
    ...Object.fromEntries(Object.entries(metadata).filter(([key]) => !['completedCheckpoints', 'folders', 'fileIds'].includes(key))),
    schemaVersion: 3, contentVersion: 1, activeCheckpointId: null, activeTaskId: null,
    revision: 2, updatedAt: '2026-01-02T00:00:00.000Z',
  };
  await assertSucceeds(setDoc(project, metadataV3));
  const publishedProgress = { schemaVersion: 3, contentVersion: 1, activeCheckpointId: 'bingo-c1', activeTaskId: 'bingo-task-1', revision: 3, updatedAt: '2026-01-03T00:00:00.000Z' };
  await assertSucceeds(setDoc(project, { ...metadataV3, ...publishedProgress }));
  await assertFails(updateDoc(project, { revision: 4, contentVersion: -1 }));
  await assertFails(updateDoc(doc(attacker, 'users/owner/activeProjects/task-manager'), { revision: 4 }));
  const base = 'users/owner/activeProjects/task-manager';
  const task = doc(owner, `${base}/tasks/bingo-task-1`);
  const checkpoint = doc(owner, `${base}/checkpoints/bingo-c1`);
  const final = doc(owner, `${base}/final/validation`);
  const evidence = { validatedAt: '2026-01-03T00:00:00.000Z', validatorSetVersion: 1, passed: true, resultCount: 2, passedCount: 2 };
  const taskState = { projectId: 'task-manager', taskId: 'bingo-task-1', status: 'IN_PROGRESS', startedAt: '2026-01-03T00:00:00.000Z', verifiedAt: null, completedAt: null, validationEvidence: null };
  await assertSucceeds(setDoc(task, taskState));
  await assertSucceeds(updateDoc(task, { status: 'COMPLETED', verifiedAt: evidence.validatedAt, completedAt: evidence.validatedAt, validationEvidence: evidence }));
  await assertSucceeds(setDoc(checkpoint, { projectId: 'task-manager', checkpointId: 'bingo-c1', status: 'COMPLETED', completedAt: evidence.validatedAt, validationEvidence: evidence }));
  await assertSucceeds(setDoc(final, { projectId: 'task-manager', status: 'PASSED', completedAt: evidence.validatedAt, validationEvidence: evidence }));
  await assertFails(setDoc(doc(attacker, `${base}/tasks/other-task`), { ...taskState, taskId: 'other-task' }));
  await assertFails(setDoc(doc(owner, `${base}/tasks/other-task`), { ...taskState, taskId: 'wrong' }));
  await assertFails(setDoc(doc(owner, `${base}/checkpoints/other-checkpoint`), { ...taskState, checkpointId: 'other-checkpoint', status: 'READY' }));
  await assertFails(setDoc(doc(owner, `${base}/tasks/extra`), { ...taskState, taskId: 'extra', unexpected: { arbitrary: true } }));
  await assertFails(setDoc(doc(owner, `${base}/tasks/bad-status`), { ...taskState, taskId: 'bad-status', status: 'HACKED' }));
  await assertFails(setDoc(doc(owner, `${base}/tasks/bad-evidence`), { ...taskState, taskId: 'bad-evidence', status: 'COMPLETED', verifiedAt: evidence.validatedAt, completedAt: evidence.validatedAt, validationEvidence: { ...evidence, secret: 'extra' } }));
  await assertFails(setDoc(doc(owner, `${base}/final/other`), { projectId: 'task-manager', status: 'PASSED', completedAt: evidence.validatedAt, validationEvidence: evidence }));
  await assertFails(updateDoc(project, { revision: 4, taskProgress: { fake: { arbitrary: 'map' } } }));
  await assertFails(updateDoc(project, { revision: 4, completedCheckpoints: [{ arbitrary: true }] }));
  await assertFails(updateDoc(project, { revision: 4, contentVersion: '1' }));
  await assertFails(updateDoc(project, { revision: 4, currentCheckpoint: 101 }));
  await assertFails(setDoc(doc(owner, `${base}/tasks/bad-count`), { ...taskState, taskId: 'bad-count', status: 'COMPLETED', verifiedAt: evidence.validatedAt, completedAt: evidence.validatedAt, validationEvidence: { ...evidence, resultCount: 51 } }));
  await assertFails(setDoc(doc(owner, `${base}/folders/evil`), { projectId: 'task-manager', path: '../outside' }));
  await assertFails(setDoc(doc(owner, 'users/owner/activeProjects/orphan/tasks/bingo-task-1'), taskState));
  await assertFails(setDoc(doc(owner, 'users/owner/activeProjects/task-manager/files/huge'), { path: 'huge.txt', type: 'file', encoding: 'utf-8', content: 'x'.repeat(262145), editable: true }));
  console.log('Projects cloud persistence Firestore rules validation passed.');
} finally {
  await environment.cleanup();
}
