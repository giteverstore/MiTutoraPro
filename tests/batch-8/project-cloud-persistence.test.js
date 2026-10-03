import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProgressService } from '../../src/projects/services/ProjectProgressService';
import { ActiveProjectConflictError, ACTIVE_PROJECT_SCHEMA_VERSION } from '../../src/projects/repositories/ActiveProjectRepository';

const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }; };
const state = (overrides = {}) => ({ projectId: 'task-manager', languageId: 'python', status: 'active', currentCheckpoint: 1, completedCheckpoints: ['setup'], files: { 'src/main.py': { path: 'src/main.py', content: 'print("hi")', language: 'python', editable: true }, 'data/tasks.json': { path: 'data/tasks.json', content: '[]', language: 'json', editable: true } }, folders: ['src', 'data'], entryFilePath: 'src/main.py', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1, schemaVersion: ACTIVE_PROJECT_SCHEMA_VERSION, ...overrides });

describe('Projects cloud persistence', () => {
  let repository;
  let service;
  beforeEach(() => {
    repository = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockImplementation(async (_id, value, revision) => ({ ...value, revision: revision + 1, schemaVersion: 1 })) };
    service = new ProjectProgressService({ storage: storage(), repositoryFactory: () => repository, debounceMs: 20 });
    service.connect('learner-1');
  });

  it('migrates a local active project only when no cloud project exists', async () => {
    service.cache('task-manager', state({ revision: 0 }));
    await service.hydrate('task-manager');
    expect(repository.save).toHaveBeenCalledWith('task-manager', expect.objectContaining({ languageId: 'python' }), 0);
    repository.load.mockResolvedValue(state({ languageId: 'cpp', revision: 4 }));
    await service.hydrate('task-manager');
    expect(service.get('task-manager').languageId).toBe('cpp');
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('hydrates checkpoint, completion, nested files, and runtime-created files', async () => {
    repository.load.mockResolvedValue(state({ status: 'completed', completedCheckpoints: ['setup', 'finish'], revision: 7 }));
    const loaded = await service.hydrate('task-manager');
    expect(loaded).toMatchObject({ status: 'completed', revision: 7, completedCheckpoints: ['setup', 'finish'] });
    expect(loaded.files['data/tasks.json'].content).toBe('[]');
  });

  it('debounces editor writes and reports confirmed save state', async () => {
    vi.useFakeTimers();
    const statuses = []; service.subscribe('task-manager', ({ status }) => statuses.push(status));
    await service.hydrate('task-manager');
    service.saveWorkspace('task-manager', state().files, 'src/main.py', ['src', 'data']);
    service.saveWorkspace('task-manager', { ...state().files, 'src/main.py': { ...state().files['src/main.py'], content: 'print(2)' } }, 'src/main.py', ['src', 'data']);
    await vi.advanceTimersByTimeAsync(25);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(statuses).toContain('saving'); expect(statuses.at(-1)).toBe('saved');
    vi.useRealTimers();
  });

  it('persists deleted files as the complete replacement snapshot', async () => {
    await service.hydrate('task-manager');
    service.saveWorkspace('task-manager', { 'src/main.py': state().files['src/main.py'] }, 'src/main.py', ['src'], { immediate: true });
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalled());
    expect(repository.save.mock.calls.at(-1)[1].files).not.toHaveProperty('data/tasks.json');
  });

  it('resets language and prevents an older scheduled save from restoring it', async () => {
    vi.useFakeTimers(); await service.hydrate('task-manager');
    service.saveWorkspace('task-manager', state().files, 'src/main.py');
    service.resetForLanguage('task-manager', 'cpp');
    await vi.runAllTimersAsync();
    expect(service.get('task-manager')).toMatchObject({ languageId: 'cpp', currentCheckpoint: 0, completedCheckpoints: [] });
    expect(repository.save.mock.calls.at(-1)[1].languageId).toBe('cpp');
    vi.useRealTimers();
  });

  it('surfaces conflicts and save failures without discarding the local recovery copy', async () => {
    await service.hydrate('task-manager');
    const conflict = new ActiveProjectConflictError(state({ revision: 2 })); repository.save.mockRejectedValueOnce(conflict);
    const events = []; service.subscribe('task-manager', (event) => events.push(event));
    service.update('task-manager', { languageId: 'python' }, { save: false });
    await expect(service.saveNow('task-manager')).rejects.toBe(conflict);
    expect(events.at(-1).status).toBe('conflict'); expect(service.get('task-manager').languageId).toBe('python');
  });

  it('retries a temporary save failure using the same local recovery state', async () => {
    await service.hydrate('task-manager');
    repository.save.mockRejectedValueOnce(new Error('offline'));
    service.update('task-manager', { currentCheckpoint: 2 }, { save: false });
    await expect(service.saveNow('task-manager')).rejects.toThrow('offline');
    await expect(service.retry('task-manager')).resolves.toMatchObject({ currentCheckpoint: 2, revision: 1 });
  });

  it('waits for an in-flight cloud write before an export flush resolves', async () => {
    let release;
    repository.save.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ ...state(), revision: 1, schemaVersion: 1 }); }));
    const saving = service.saveNow('task-manager');
    let flushed = false;
    const flushing = service.flush('task-manager').then(() => { flushed = true; });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(flushed).toBe(false);
    release();
    await saving;
    await flushing;
    expect(flushed).toBe(true);
  });

  it('ignores a previous learner save that settles after an account switch', async () => {
    let release;
    repository.save.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ ...state(), revision: 9, schemaVersion: 1 }); }));
    const saving = service.saveNow('task-manager');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    service.connect('learner-2');
    release();
    await saving;
    expect(service.get('task-manager')).toMatchObject({ status: 'not-started', revision: 0 });
  });

  it('persists checkpoint completion immediately', async () => {
    await service.hydrate('task-manager');
    service.update('task-manager', { status: 'active', languageId: 'python' }, { save: false });
    service.completeCheckpoint('task-manager', 'finish', 1, 1);
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalled());
    expect(repository.save.mock.calls.at(-1)[1]).toMatchObject({ status: 'completed', completedCheckpoints: ['finish'] });
  });

  it('disconnects cloud writes while preserving the local cache', async () => {
    await service.hydrate('task-manager'); service.connect(null);
    service.update('task-manager', { currentCheckpoint: 2 });
    expect(service.get('task-manager').currentCheckpoint).toBe(2);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('isolates local recovery caches between authenticated learners', () => {
    service.cache('task-manager', state({ languageId: 'python' }));
    service.connect('learner-2');
    expect(service.get('task-manager')).toMatchObject({ status: 'not-started', languageId: null });
    service.cache('task-manager', state({ languageId: 'cpp' }));
    service.connect('learner-1');
    expect(service.get('task-manager').languageId).toBe('python');
  });

  it('moves the legacy local cache once into the first authenticated learner namespace', () => {
    const legacyStorage = storage();
    legacyStorage.setItem('mi-tutora:projects:v1', JSON.stringify({ 'task-manager': state({ revision: 0 }) }));
    const migrating = new ProjectProgressService({ storage: legacyStorage, repositoryFactory: () => repository });
    migrating.connect('legacy-owner');
    expect(migrating.get('task-manager').languageId).toBe('python');
    expect(legacyStorage.getItem('mi-tutora:projects:v1')).toBeNull();
    migrating.connect('another-learner');
    expect(migrating.get('task-manager').status).toBe('not-started');
  });
});
