import { describe, expect, it } from 'vitest';
import { migrateCliTaskManager, assertEmulatorOnly, runMigration } from '../../scripts/content/migrationCore.mjs';
import { cliTaskManagerProject } from '../../src/projects/catalog/cliTaskManagerProject.js';
import { adaptPublishedProject } from '../../src/projects/repositories/PublishedContentRepository.js';
import { mergeProjectCatalog } from '../../src/projects/pages/ProjectsPage.jsx';
import { TrustedDescriptorExecutor } from '../../src/projects/validation/TrustedDescriptorExecutor.js';
import { deriveTaskProgress, recordCheckpointValidation, recordFinalValidation, recordTaskVerification } from '../../src/projects/services/ProjectTaskProgression.js';
import { InMemoryContentPublicationStore, InMemoryArtifactStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';

const actor = { uid: 'phase-10-test', role: 'SUPER_ADMIN' };
const documentOf = ({ documentId, ...document }) => document;

describe('Phase 10 CLI Task Manager migration', () => {
  it('converts the real Project deterministically with checkpoint, guide, starter and validator parity', () => {
    const first = migrateCliTaskManager();
    expect(first.drafts).toEqual(migrateCliTaskManager().drafts);
    expect(first.report).toMatchObject({ contentId: 'cli-task-manager', languages: ['python', 'javascript', 'java', 'cpp'], checkpoints: 5, adapterDerivedTasks: 5, guideBlocks: 33, checkpointValidators: [1, 3, 5, 5, 16], finalValidators: 16, validation: 'passed' });
    const content = first.drafts[0].content;
    expect(content.checkpoints.map(({ checkpointId }) => checkpointId)).toEqual(cliTaskManagerProject.checkpoints.map(({ id }) => id));
    expect(content.checkpoints.map(({ blocks }) => blocks.length)).toEqual([7, 6, 7, 7, 6]);
    expect(content.checkpoints.map(({ tasks }) => tasks.map(({ taskId }) => taskId))).toEqual(cliTaskManagerProject.checkpoints.map(({ id }) => [`${id}-task`]));
    for (const [language, workspace] of Object.entries(content.starterWorkspaces)) {
      expect(workspace.files).toHaveLength(1);
      expect(workspace.entrypoint).toBe(workspace.files[0].path);
      expect(workspace.runtimeId).toBe(language);
    }
    const migrated = adaptPublishedProject(content, 1, first.drafts[0].metadata);
    expect(migrated.contentVersion).toBe(1);
    expect(migrated.checkpoints.map(({ executionMode }) => executionMode)).toEqual(cliTaskManagerProject.checkpoints.map(({ executionMode }) => executionMode));
    expect(migrated.export).toEqual(cliTaskManagerProject.export);
    expect(migrated.whatYouWillBuild).toBe(cliTaskManagerProject.whatYouWillBuild);
  });

  it('rejects changed source shapes and production seeding, while default CLI is read-only', async () => {
    const source = structuredClone(cliTaskManagerProject);
    source.unexpected = 'loss';
    expect(() => migrateCliTaskManager(source)).toThrow(/Unknown Project root field/);
    const nested = structuredClone(cliTaskManagerProject);
    nested.checkpoints[0].guide[0].unsupported = 'loss';
    expect(() => migrateCliTaskManager(nested)).toThrow(/Unknown checkpoint guide block field/);
    expect(() => assertEmulatorOnly({ FIREBASE_PROJECT_ID: 'production', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toThrow(/demo-mitutora/);
    const previous = console.log; const output = []; console.log = (value) => output.push(value);
    try { await runMigration('project', []); } finally { console.log = previous; }
    expect(JSON.parse(output[0]).mode).toBe('dry-run');
  });

  it('publishes v1/v2, rolls back, archives, and keeps canonical catalog precedence', async () => {
    const store = new InMemoryContentPublicationStore(); const artifacts = new InMemoryArtifactStore();
    const publication = new ContentPublicationService({ store, artifacts });
    const delivery = new PublishedContentService({ store, artifacts });
    const first = documentOf(migrateCliTaskManager().drafts[0]);
    const saved = await publication.saveDraft({ actor, document: first });
    const v1 = await publication.publish({ actor, contentId: first.contentId, expectedRevision: saved.draftRevision });
    expect(v1.version.status).toBe('READY');
    expect((await delivery.resolveActive(first.contentId)).document.version).toBe(1);
    const second = structuredClone(first); second.content.description += ' Updated metadata.';
    const updated = await publication.saveDraft({ actor, document: second, expectedRevision: saved.draftRevision });
    await publication.publish({ actor, contentId: first.contentId, expectedRevision: updated.draftRevision, expectedActiveRevision: 1 });
    expect((await delivery.fetchVersion(first.contentId, 1)).document.content.description).toBe(first.content.description);
    expect((await delivery.resolveActive(first.contentId)).document.version).toBe(2);
    const canonical = adaptPublishedProject((await delivery.resolveActive(first.contentId)).document.content, 2, first.metadata);
    expect(mergeProjectCatalog([cliTaskManagerProject], [canonical])).toHaveLength(1);
    expect(mergeProjectCatalog([cliTaskManagerProject], [canonical])[0].contentVersion).toBe(2);
    await publication.activate({ actor, contentId: first.contentId, version: 1, expectedActiveRevision: 2 });
    expect((await delivery.resolveActive(first.contentId)).document.version).toBe(1);
    expect((await delivery.fetchVersion(first.contentId, 2)).document.version).toBe(2);
    await publication.archive({ actor, contentId: first.contentId, expectedActiveRevision: 3 });
    expect(await delivery.resolveActive(first.contentId)).toBeNull();
    expect((await delivery.fetchVersion(first.contentId, 1)).document.version).toBe(1);
  });

  it('retains legacy case-insensitive checks and filesystem evidence across scenarios', async () => {
    const content = migrateCliTaskManager().drafts[0].content;
    const source = content.checkpoints[1].tasks[0].validators.find(({ type }) => type === 'source_pattern');
    const descriptor = content.checkpoints[3].tasks[0].validators.slice(0, 2);
    const manager = { execute: async ({ stdin, projectFiles }) => ({ status: 'success', stdout: stdin.includes('Persisted task') ? 'task manager' : 'PERSISTED TASK', stderr: '', filesystemSupported: true, projectFiles: stdin.includes('Persisted task') ? [...projectFiles, { path: 'tasks.json', content: '[]' }] : projectFiles }) };
    const executor = new TrustedDescriptorExecutor(manager);
    const files = { 'main.py': { path: 'main.py', content: 'class Task:\n  TITLE = 1\n  completed = False' } };
    expect((await executor.run({ descriptor: source, project: content, language: 'python', files, entrypoint: 'main.py' })).passed).toBe(true);
    const result = await executor.runScope({ project: content, language: 'python', files, entrypoint: 'main.py' }, descriptor);
    expect(result.passed).toBe(true);
  });

  it('reaches final completion through every migrated checkpoint in source order', () => {
    const project = migrateCliTaskManager().drafts[0].content;
    const passed = (validators) => ({ passed: true, results: validators.map(({ validatorId, type }) => ({ validatorId, type, status: 'success', passed: true })) });
    let state = {};
    for (const checkpoint of project.checkpoints) {
      expect(deriveTaskProgress(project, state).checkpoints.find(({ checkpointId }) => checkpointId === checkpoint.checkpointId).unlocked).toBe(true);
      for (const task of checkpoint.tasks) state = recordTaskVerification(state, task.taskId, passed(task.validators));
      state = recordCheckpointValidation(state, checkpoint.checkpointId, passed(checkpoint.validators));
    }
    expect(deriveTaskProgress(project, state).allCheckpointsComplete).toBe(true);
    state = recordFinalValidation(state, passed(project.finalValidators));
    expect(state.finalValidation.status).toBe('PASSED');
  });
});
