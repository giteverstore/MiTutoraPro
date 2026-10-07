import { describe, expect, it } from 'vitest';
import { createBingoContractFixture } from '../../../tests/content-contracts/fixtures.js';
import { createProjectDraft, newCheckpoint, newContract, newHint, newTask, newValidator, reindex, validateProjectDraft } from '../src/content-studio/projects/projectAuthoring.js';

describe('Phase 4 Project authoring model', () => {
  it('creates a local-only canonical Project draft with a stable identity', () => {
    const draft = createProjectDraft('my-project');
    expect(draft.contentId).toBe('my-project');
    expect(draft.content.projectId).toBe('my-project');
    expect(draft.content.supportedLanguages).toEqual(['python']);
    expect(draft.content.starterWorkspaces.python.files[0].path).toBe('main.py');
    expect(validateProjectDraft(draft).valid).toBe(false);
  });

  it('generates fresh stable IDs and deterministic order', () => {
    const checkpoints = reindex([newCheckpoint(), newCheckpoint()]);
    const tasks = reindex([newTask(), newTask(), newTask()]);
    expect(new Set(checkpoints.map((x) => x.checkpointId)).size).toBe(2);
    expect(new Set(tasks.map((x) => x.taskId)).size).toBe(3);
    expect(tasks.map((x) => x.order)).toEqual([1, 2, 3]);
    expect(newContract().kind).toBe('constant');
    expect(newValidator().type).toBe('execution_succeeds');
    expect(newHint().level).toBe('hint');
  });

  it('validates the non-production 8-checkpoint / 17-task capability fixture', () => {
    const fixture = createBingoContractFixture();
    expect(fixture.content.checkpoints).toHaveLength(8);
    expect(fixture.content.checkpoints.flatMap((x) => x.tasks)).toHaveLength(17);
    expect(validateProjectDraft({ ...fixture, documentId: fixture.contentId }).valid).toBe(true);
  });

  it('rejects unsafe starter workspace paths', () => {
    const fixture = createBingoContractFixture();
    fixture.content.starterWorkspaces.python.files[0].path = '../secret.txt';
    const result = validateProjectDraft({ ...fixture, documentId: fixture.contentId });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'security.unsafe_path')).toBe(true);
  });
});
