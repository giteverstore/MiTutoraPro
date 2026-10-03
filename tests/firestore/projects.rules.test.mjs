import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const environment = await initializeTestEnvironment({
  projectId: 'demo-projects-rules',
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
const metadata = { schemaVersion: 1, projectId: 'task-manager', languageId: 'python', status: 'active', currentCheckpoint: 0, completedCheckpoints: [], folders: ['data'], entryFilePath: 'main.py', fileIds: ['main.py'], revision: 1, createdAt: '2026-01-01T00:00:00.000Z', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' };
try {
  const owner = environment.authenticatedContext('owner').firestore();
  const attacker = environment.authenticatedContext('attacker').firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const project = doc(owner, 'users/owner/activeProjects/task-manager');
  const file = doc(owner, 'users/owner/activeProjects/task-manager/files/main.py');
  await assertSucceeds(setDoc(project, metadata));
  await assertSucceeds(setDoc(file, { path: 'main.py', type: 'file', encoding: 'utf-8', content: 'print(1)', editable: true, language: 'python' }));
  await assertSucceeds(getDoc(project));
  await assertFails(getDoc(doc(attacker, 'users/owner/activeProjects/task-manager')));
  await assertFails(getDoc(doc(anonymous, 'users/owner/activeProjects/task-manager')));
  await assertFails(updateDoc(project, { revision: 3 }));
  await assertSucceeds(updateDoc(project, { revision: 2, updatedAt: '2026-01-02T00:00:00.000Z' }));
  await assertFails(setDoc(doc(owner, 'users/owner/activeProjects/task-manager/files/huge'), { path: 'huge.txt', type: 'file', encoding: 'utf-8', content: 'x'.repeat(262145), editable: true }));
  console.log('Projects cloud persistence Firestore rules validation passed.');
} finally {
  await environment.cleanup();
}
