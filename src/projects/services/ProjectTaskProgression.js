import {
  MAX_EVIDENCE_RESULTS,
  PROJECT_CHECKPOINT_STATUS,
  PROJECT_TASK_STATUS,
  PROJECT_VALIDATION_STATUS,
  VALIDATION_EVIDENCE_VERSION,
} from '../../../shared/content/progression.js';

const now = () => new Date().toISOString();
const own = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const clipped = (value, limit = 300) => String(value ?? '').slice(0, limit);

export const isTaskBasedProject = (project) => Boolean(project?.projectId && project.checkpoints?.length
  && project.checkpoints.every((checkpoint) => checkpoint.checkpointId && checkpoint.tasks?.length));

export function compactValidationEvidence(validation, validatedAt = now()) {
  return {
    validatedAt,
    validatorSetVersion: VALIDATION_EVIDENCE_VERSION,
    passed: validation?.passed === true,
    results: (validation?.results ?? []).slice(0, MAX_EVIDENCE_RESULTS).map((item) => ({
      validatorId: clipped(item.validatorId, 128),
      validatorType: clipped(item.type, 64),
      status: clipped(item.status, 32),
      passed: item.passed === true,
    })),
  };
}

export function normalizeTaskProgressState(state = {}) {
  return {
    taskProgress: own(state.taskProgress),
    checkpointProgress: own(state.checkpointProgress),
    activeCheckpointId: typeof state.activeCheckpointId === 'string' ? state.activeCheckpointId : null,
    activeTaskId: typeof state.activeTaskId === 'string' ? state.activeTaskId : null,
    finalValidation: own(state.finalValidation),
  };
}

export function deriveTaskProgress(project, state = {}) {
  const progress = normalizeTaskProgressState(state);
  if (!isTaskBasedProject(project)) return { supported: false, ...progress, checkpoints: [] };
  let previousCheckpointComplete = true;
  const checkpoints = project.checkpoints.map((checkpoint) => {
    const tasks = checkpoint.tasks.map((task, index) => {
      const saved = own(progress.taskProgress[task.taskId]);
      const priorComplete = index === 0 || progress.taskProgress[checkpoint.tasks[index - 1].taskId]?.status === PROJECT_TASK_STATUS.COMPLETED;
      const unlocked = previousCheckpointComplete && priorComplete;
      return { ...task, progress: saved, completed: saved.status === PROJECT_TASK_STATUS.COMPLETED, unlocked };
    });
    const requiredComplete = tasks.every((task) => task.completed);
    const saved = own(progress.checkpointProgress[checkpoint.checkpointId]);
    const completed = saved.status === PROJECT_CHECKPOINT_STATUS.COMPLETED;
    const unlocked = previousCheckpointComplete;
    const status = completed ? PROJECT_CHECKPOINT_STATUS.COMPLETED : !unlocked ? PROJECT_CHECKPOINT_STATUS.LOCKED : requiredComplete ? PROJECT_CHECKPOINT_STATUS.READY : PROJECT_CHECKPOINT_STATUS.IN_PROGRESS;
    previousCheckpointComplete = completed;
    return { ...checkpoint, tasks, completed, unlocked, requiredComplete, status, completedCount: tasks.filter((task) => task.completed).length, totalCount: tasks.length, progress: saved };
  });
  return { supported: true, ...progress, checkpoints, allCheckpointsComplete: checkpoints.every((checkpoint) => checkpoint.completed) };
}

export function startTaskState(state, checkpointId, taskId) {
  const current = normalizeTaskProgressState(state);
  const previous = own(current.taskProgress[taskId]);
  return { ...current, activeCheckpointId: checkpointId, activeTaskId: taskId, taskProgress: { ...current.taskProgress, [taskId]: previous.status === PROJECT_TASK_STATUS.COMPLETED ? previous : { ...previous, status: PROJECT_TASK_STATUS.IN_PROGRESS, startedAt: previous.startedAt ?? now() } } };
}

export function recordTaskVerification(state, taskId, validation, timestamp = now()) {
  const current = normalizeTaskProgressState(state);
  if (!validation?.passed) return current;
  const previous = own(current.taskProgress[taskId]);
  return { ...current, taskProgress: { ...current.taskProgress, [taskId]: { ...previous, status: PROJECT_TASK_STATUS.COMPLETED, startedAt: previous.startedAt ?? timestamp, verifiedAt: timestamp, completedAt: previous.completedAt ?? timestamp, validationEvidence: compactValidationEvidence(validation, timestamp) } } };
}

export function recordCheckpointValidation(state, checkpointId, validation, timestamp = now()) {
  const current = normalizeTaskProgressState(state);
  const previous = own(current.checkpointProgress[checkpointId]);
  const passed = validation?.passed === true;
  return { ...current, checkpointProgress: { ...current.checkpointProgress, [checkpointId]: { ...previous, status: passed ? PROJECT_CHECKPOINT_STATUS.COMPLETED : PROJECT_CHECKPOINT_STATUS.READY, completedAt: passed ? previous.completedAt ?? timestamp : null, validationEvidence: compactValidationEvidence(validation, timestamp) } } };
}

export function recordFinalValidation(state, validation, timestamp = now()) {
  return { ...normalizeTaskProgressState(state), finalValidation: { status: validation?.passed ? PROJECT_VALIDATION_STATUS.PASSED : PROJECT_VALIDATION_STATUS.FAILED, completedAt: validation?.passed ? timestamp : null, validationEvidence: compactValidationEvidence(validation, timestamp) } };
}
