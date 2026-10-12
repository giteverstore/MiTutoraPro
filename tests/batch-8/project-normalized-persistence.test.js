import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { ActiveProjectRepository, ACTIVE_PROJECT_SCHEMA_VERSION } from '../../src/projects/repositories/ActiveProjectRepository';

vi.mock('../../src/firebase/firestore.js', () => ({ db: null }));

const at = '2026-10-12T00:00:00.000Z';
const evidence = { validatedAt: at, validatorSetVersion: 1, passed: true, results: [{ validatorId: 'bingo-check', validatorType: 'output', status: 'passed', passed: true }] };
const state = (overrides = {}) => ({
  languageId: 'python', contentVersion: 1, status: 'active', currentCheckpoint: 0, completedCheckpoints: [],
  activeCheckpointId: null, activeTaskId: null, taskProgress: {}, checkpointProgress: {}, finalValidation: {},
  files: { 'bingo.py': { path: 'bingo.py', content: '', editable: true, language: 'python' } },
  folders: ['src'], entryFilePath: 'bingo.py', createdAt: at, startedAt: at, completedAt: null, ...overrides,
});

describe('normalized Project persistence against Firestore rules', () => {
  it('saves pinned state, aggregates progress, selectively updates, resets, and deletes children', async () => {
    const environment = await initializeTestEnvironment({
      projectId: 'demo-normalized-project-persistence',
      firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    });
    try {
      await environment.clearFirestore();
      const firestore = environment.authenticatedContext('bingo-learner').firestore();
      const repository = new ActiveProjectRepository('bingo-learner', firestore);
      const root = 'users/bingo-learner/activeProjects/bingo';
      const task = doc(firestore, `${root}/tasks/bingo-task-1`);
      const checkpoint = doc(firestore, `${root}/checkpoints/bingo-c1`);
      const first = await repository.save('bingo', state(), 0);
      expect(first).toMatchObject({ schemaVersion: ACTIVE_PROJECT_SCHEMA_VERSION, contentVersion: 1, revision: 1 });
      const completedState = state({
        taskProgress: { 'bingo-task-1': { status: 'COMPLETED', startedAt: at, verifiedAt: at, completedAt: at, validationEvidence: evidence } },
        checkpointProgress: { 'bingo-c1': { status: 'COMPLETED', completedAt: at, validationEvidence: evidence } },
        finalValidation: { status: 'PASSED', completedAt: at, validationEvidence: evidence },
      });
      const second = await repository.save('bingo', completedState, 1);
      expect(second.revision).toBe(2);
      const loaded = await repository.load('bingo');
      expect(loaded).toMatchObject({ schemaVersion: 3, contentVersion: 1, revision: 2 });
      expect(loaded.taskProgress['bingo-task-1'].status).toBe('COMPLETED');
      expect(loaded.checkpointProgress['bingo-c1'].status).toBe('COMPLETED');
      expect(loaded.finalValidation.status).toBe('PASSED');
      expect(loaded.files['bingo.py'].content).toBe('');
      expect(loaded.folders).toEqual(['src']);
      expect(loaded.taskProgress['bingo-task-1'].validationEvidence).toMatchObject({ resultCount: 1, passedCount: 1 });
      expect(loaded.taskProgress['bingo-task-1'].validationEvidence).not.toHaveProperty('results');
      const taskBeforeUnrelatedSave = (await getDoc(task)).data();
      await repository.save('bingo', completedState, 2);
      expect((await getDoc(task)).data()).toEqual(taskBeforeUnrelatedSave);
      await repository.save('bingo', state({ languageId: 'cpp', contentVersion: 1, files: {}, folders: [], entryFilePath: null }), 3);
      expect((await getDoc(task)).exists()).toBe(false);
      expect((await getDoc(checkpoint)).exists()).toBe(false);
      expect((await getDocs(collection(firestore, `${root}/final`))).empty).toBe(true);
      expect((await getDocs(collection(firestore, `${root}/files`))).empty).toBe(true);
      expect((await getDocs(collection(firestore, `${root}/folders`))).empty).toBe(true);
      expect((await repository.load('bingo')).languageId).toBe('cpp');
      await repository.save('bingo', state({ languageId: 'cpp', contentVersion: 1, files: {}, folders: [], entryFilePath: null, completedCheckpoints: ['bingo-c1'] }), 4);
      expect((await repository.load('bingo')).completedCheckpoints).toEqual(['bingo-c1']);
      expect((await getDoc(checkpoint)).data().validationEvidence).toBeNull();
      await expect(repository.delete('bingo', 5)).resolves.toBe(true);
      expect((await getDoc(doc(firestore, root))).exists()).toBe(false);
      expect((await getDocs(collection(firestore, `${root}/tasks`))).empty).toBe(true);
    } finally {
      await environment.cleanup();
    }
  }, 15_000);

  it('loads a legacy schema-2 map and migrates it only on the next write', async () => {
    const environment = await initializeTestEnvironment({
      projectId: 'demo-legacy-project-persistence',
      firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    });
    try {
      await environment.clearFirestore();
      const firestore = environment.authenticatedContext('legacy-learner').firestore();
      const repository = new ActiveProjectRepository('legacy-learner', firestore);
      const reference = doc(firestore, 'users/legacy-learner/activeProjects/bingo');
      await environment.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), reference.path), {
        schemaVersion: 2, projectId: 'bingo', contentVersion: 1, languageId: 'python', status: 'active',
        displayName: null, currentCheckpoint: 0, completedCheckpoints: [], activeCheckpointId: 'bingo-c1', activeTaskId: 'bingo-task-1',
        taskProgress: { 'bingo-task-1': { status: 'IN_PROGRESS', startedAt: at } }, checkpointProgress: {}, finalValidation: {},
        folders: [], entryFilePath: null, fileIds: [], revision: 1, createdAt: at, startedAt: at, completedAt: null, updatedAt: at,
      }));
      const legacy = await repository.load('bingo');
      expect(legacy.taskProgress['bingo-task-1'].status).toBe('IN_PROGRESS');
      await repository.save('bingo', { ...legacy, files: {}, taskProgress: legacy.taskProgress }, 1);
      expect((await getDoc(reference)).data()).not.toHaveProperty('taskProgress');
      expect((await repository.load('bingo')).taskProgress['bingo-task-1'].status).toBe('IN_PROGRESS');
      const legacyOne = doc(firestore, 'users/legacy-learner/activeProjects/legacy-cli');
      await environment.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), legacyOne.path), {
          schemaVersion: 1, projectId: 'legacy-cli', languageId: 'python', status: 'active', displayName: null,
          currentCheckpoint: 0, completedCheckpoints: ['setup'], folders: [], entryFilePath: 'main.py', fileIds: ['main.py'],
          revision: 1, createdAt: at, startedAt: at, completedAt: null, updatedAt: at,
        });
        await setDoc(doc(context.firestore(), `${legacyOne.path}/files/main.py`), {
          path: 'main.py', type: 'file', encoding: 'utf-8', content: 'print(1)', editable: true, language: 'python',
        });
      });
      const firstSchema = await repository.load('legacy-cli');
      expect(firstSchema.schemaVersion).toBe(1);
      expect(firstSchema.contentVersion).toBeUndefined();
      expect(firstSchema.taskProgress).toBeUndefined();
      expect(firstSchema.checkpointProgress).toBeUndefined();
      expect(firstSchema.completedCheckpoints).toEqual(['setup']);
      expect(firstSchema.files['main.py'].content).toBe('print(1)');
      await repository.save('legacy-cli', firstSchema, 1);
      const migrated = await repository.load('legacy-cli');
      expect(migrated).toMatchObject({ schemaVersion: 3, revision: 2, contentVersion: null });
      expect(migrated.taskProgress).toEqual({});
      expect(migrated.completedCheckpoints).toEqual(['setup']);
      expect(migrated.checkpointProgress.setup.status).toBe('COMPLETED');
      expect(migrated.finalValidation).toEqual({});
      expect(migrated.files['main.py'].content).toBe('print(1)');
      expect(migrated.workspace.folders).toEqual([]);
      expect((await getDoc(legacyOne)).data()).not.toHaveProperty('fileIds');
      expect((await getDocs(collection(firestore, `${legacyOne.path}/tasks`))).empty).toBe(true);
      expect((await getDoc(doc(firestore, `${legacyOne.path}/checkpoints/setup`))).data().status).toBe('COMPLETED');
    } finally {
      await environment.cleanup();
    }
  });
});
