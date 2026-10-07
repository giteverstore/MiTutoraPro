import { describe, expect, it } from 'vitest';
import { PROJECT_CHECKPOINT_STATUS, PROJECT_TASK_STATUS } from '../../shared/content/index.js';
import { deriveTaskProgress, isTaskBasedProject, recordCheckpointValidation, recordFinalValidation, recordTaskVerification, startTaskState } from '../../src/projects/services/ProjectTaskProgression.js';
import { ProjectProgressService } from '../../src/projects/services/ProjectProgressService.js';

const validator = (validatorId) => ({ validatorId, type: 'execution_succeeds' });
const task = (taskId, order) => ({ taskId, order, title: taskId, objective: `Build ${taskId}`, blocks: [], validators: [validator(`${taskId}-validator`)] });
const project = {
  projectId: 'progress-fixture', supportedLanguages: ['python', 'javascript'], implementationContracts: [], finalValidators: [validator('final')],
  checkpoints: [
    { checkpointId: 'cp-1', order: 1, title: 'First', tasks: [task('task-1', 1), task('task-2', 2)], validators: [validator('cp-1-validator')] },
    { checkpointId: 'cp-2', order: 2, title: 'Second', tasks: [task('task-3', 1)], validators: [validator('cp-2-validator')] },
  ],
};
const pass = (...ids) => ({ passed: true, results: ids.map((validatorId) => ({ validatorId, type: 'execution_succeeds', status: 'success', passed: true, stdout: 'not persisted' })) });
const fail = (...ids) => ({ passed: false, results: ids.map((validatorId) => ({ validatorId, type: 'execution_succeeds', status: 'failed', passed: false, stderr: 'not persisted' })) });

describe('canonical Project task progression', () => {
  it('detects canonical task capability without forcing it onto legacy projects', () => {
    expect(isTaskBasedProject(project)).toBe(true);
    expect(isTaskBasedProject({ id: 'legacy', checkpoints: [{ id: 'one' }] })).toBe(false);
  });

  it('unlocks tasks and checkpoints strictly in authored order', () => {
    let state = startTaskState({}, 'cp-1', 'task-1');
    let model = deriveTaskProgress(project, state);
    expect(model.checkpoints[0].tasks.map(({ unlocked }) => unlocked)).toEqual([true, false]);
    expect(model.checkpoints[1].status).toBe(PROJECT_CHECKPOINT_STATUS.LOCKED);
    state = recordTaskVerification(state, 'task-1', pass('task-1-validator'), '2026-01-01T00:00:00.000Z');
    model = deriveTaskProgress(project, state);
    expect(model.checkpoints[0].tasks[0].progress.status).toBe(PROJECT_TASK_STATUS.COMPLETED);
    expect(model.checkpoints[0].tasks[1].unlocked).toBe(true);
  });

  it('does not complete a task on failure and keeps successful reruns idempotent', () => {
    let state = startTaskState({}, 'cp-1', 'task-1');
    state = recordTaskVerification(state, 'task-1', fail('task-1-validator'));
    expect(state.taskProgress['task-1'].status).toBe(PROJECT_TASK_STATUS.IN_PROGRESS);
    state = recordTaskVerification(state, 'task-1', pass('task-1-validator'), '2026-01-01T00:00:00.000Z');
    state = recordTaskVerification(state, 'task-1', pass('task-1-validator'), '2026-01-02T00:00:00.000Z');
    expect(state.taskProgress['task-1'].completedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(state.taskProgress['task-1'].verifiedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(state.taskProgress['task-1'].validationEvidence.results[0]).not.toHaveProperty('stdout');
  });

  it('requires cumulative checkpoint success before unlocking the next checkpoint', () => {
    let state = recordTaskVerification({}, 'task-1', pass('task-1-validator'));
    state = recordTaskVerification(state, 'task-2', pass('task-2-validator'));
    expect(deriveTaskProgress(project, state).checkpoints[0].status).toBe(PROJECT_CHECKPOINT_STATUS.READY);
    state = recordCheckpointValidation(state, 'cp-1', fail('cp-1-validator'));
    expect(deriveTaskProgress(project, state).checkpoints[1].unlocked).toBe(false);
    state = recordCheckpointValidation(state, 'cp-1', pass('cp-1-validator'));
    expect(deriveTaskProgress(project, state).checkpoints[1].unlocked).toBe(true);
  });

  it('blocks project completion until every checkpoint passes and preserves state on final failure', () => {
    let state = {};
    for (const id of ['task-1', 'task-2', 'task-3']) state = recordTaskVerification(state, id, pass(`${id}-validator`));
    state = recordCheckpointValidation(state, 'cp-1', pass('cp-1-validator'));
    state = recordCheckpointValidation(state, 'cp-2', pass('cp-2-validator'));
    expect(deriveTaskProgress(project, state).allCheckpointsComplete).toBe(true);
    const failed = recordFinalValidation(state, fail('final'));
    expect(failed.finalValidation.status).toBe('FAILED');
    expect(failed.checkpointProgress['cp-2'].status).toBe(PROJECT_CHECKPOINT_STATUS.COMPLETED);
    expect(recordFinalValidation(failed, pass('final')).finalValidation.status).toBe('PASSED');
  });

  it('persists task state and clears it on language reset without changing pinned start behavior', () => {
    const memory = new Map();
    const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
    const service = new ProjectProgressService({ storage });
    service.start('progress-fixture', 'python', 3);
    service.saveTaskProgress('progress-fixture', { ...recordTaskVerification({}, 'task-1', pass('task-1-validator')), currentCheckpoint: 1 });
    expect(service.get('progress-fixture')).toMatchObject({ contentVersion: 3, languageId: 'python', currentCheckpoint: 1, taskProgress: { 'task-1': { status: PROJECT_TASK_STATUS.COMPLETED } } });
    service.resetForLanguage('progress-fixture', 'javascript', null, 3);
    expect(service.get('progress-fixture')).toMatchObject({ languageId: 'javascript', contentVersion: 3, currentCheckpoint: 0, taskProgress: {}, checkpointProgress: {}, finalValidation: {} });
  });

  it('normalizes malformed older progress maps without discarding the rest of the record', () => {
    const memory = new Map([['mi-tutora:projects:v1', JSON.stringify({ 'progress-fixture': { status: 'started', languageId: 'python', taskProgress: [], checkpointProgress: 'bad', finalValidation: null } })]]);
    const service = new ProjectProgressService({ storage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) } });
    expect(service.get('progress-fixture')).toMatchObject({ status: 'active', languageId: 'python', taskProgress: {}, checkpointProgress: {}, finalValidation: {} });
  });
});
