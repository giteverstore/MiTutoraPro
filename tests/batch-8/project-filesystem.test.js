import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ProjectExecutionService } from '../../src/projects/execution/ProjectExecutionService';
import { diffProjectFileSnapshots, mergeProjectExecutionSnapshot, normalizeProjectFilePath, normalizeProjectFileSnapshot } from '../../src/projects/execution/projectFilesystem';
import { executeJavaScriptSource } from '../../src/compiler/runtimes/javascript/javascriptExecution';

describe('project virtual filesystem contract', () => {
  it('normalizes nested text files and rejects traversal or absolute paths', () => {
    expect(normalizeProjectFilePath('src/models/task.js')).toBe('src/models/task.js');
    for (const path of ['../secret', 'src/../../secret', '/etc/passwd', 'C:\\secret.txt']) expect(() => normalizeProjectFilePath(path)).toThrow(/project/i);
  });

  it('reports creations, modifications, deletions, and filters runtime artifacts', () => {
    const before = { 'main.py': { content: 'old' }, 'remove.txt': { content: 'remove' } };
    const after = { 'main.py': { content: 'new' }, 'data/tasks.json': { content: '[]' }, 'app': { content: 'binary' }, 'Main.class': { content: 'binary' } };
    expect(diffProjectFileSnapshots(before, after).map(({ type, path }) => `${type}:${path}`)).toEqual(['modified:main.py', 'created:data/tasks.json', 'deleted:remove.txt']);
  });

  it('merges runtime mutations without overwriting unrelated concurrent editor changes', () => {
    const mounted = { 'main.py': { content: 'run source' }, 'notes.txt': { content: 'old note' } };
    const editor = { 'main.py': { content: 'edited while running' }, 'notes.txt': { content: 'old note' } };
    const runtime = { 'main.py': { content: 'run source' }, 'notes.txt': { content: 'runtime note' }, 'tasks.json': { content: '[1]' } };
    const merged = mergeProjectExecutionSnapshot(editor, mounted, runtime).files;
    expect(merged['main.py'].content).toBe('edited while running');
    expect(merged['notes.txt'].content).toBe('runtime note');
    expect(merged['tasks.json'].content).toBe('[1]');
  });

  it('restores a captured snapshot on a second isolated project execution', async () => {
    const execute = vi.fn(async ({ projectFiles, stdin }) => {
      const files = normalizeProjectFileSnapshot(projectFiles);
      if (stdin === 'write') files['data/tasks.json'] = { path: 'data/tasks.json', content: '["persisted"]' };
      return { status: 'success', output: stdin === 'read' ? files['data/tasks.json']?.content ?? 'missing' : 'saved', projectFiles: Object.values(files), filesystemSupported: true };
    });
    const service = new ProjectExecutionService({ execute });
    const request = { projectId: 'one', languageId: 'python', files: { 'main.py': { content: 'print(1)' } }, entrypoint: 'main.py', runCommand: 'python main.py' };
    const first = await service.execute({ ...request, stdin: 'write' });
    const second = await service.execute({ ...request, files: first.projectFiles, stdin: 'read' });
    expect(first.fileMutations).toEqual([expect.objectContaining({ type: 'created', path: 'data/tasks.json' })]);
    expect(second.output).toBe('["persisted"]');
    const isolated = await service.execute({ ...request, projectId: 'two', stdin: 'read' });
    expect(isolated.output).toBe('missing');
  });

  it('provides JavaScript multi-file CommonJS and confined fs persistence', async () => {
    const result = await executeJavaScriptSource({
      filename: 'index.js', entrypoint: 'index.js', source: 'const fs = require("fs"); const task = require("./task"); fs.writeFileSync("data/tasks.json", JSON.stringify([task])); fs.unlinkSync("old.txt"); console.log(task.title);',
      projectFiles: [
        { path: 'index.js', content: '' },
        { path: 'task.js', content: 'module.exports = { title: "Persisted task", completed: false };' },
        { path: 'old.txt', content: 'old' },
      ],
    });
    expect(result).toMatchObject({ status: 'success', stdout: 'Persisted task', filesystemSupported: true });
    expect(result.projectFiles).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'task.js' }), expect.objectContaining({ path: 'data/tasks.json', content: '[{"title":"Persisted task","completed":false}]' })]));
    expect(result.projectFiles.some(({ path }) => path === 'old.txt')).toBe(false);
  });

  it('blocks JavaScript filesystem escape attempts', async () => {
    const result = await executeJavaScriptSource({ filename: 'index.js', entrypoint: 'index.js', source: 'require("fs").writeFileSync("../escape.txt", "no");', projectFiles: [{ path: 'index.js', content: '' }] });
    expect(result.status).toBe('error');
    expect(result.stderr).toMatch(/restricted to the project workspace/i);
  });

  it('keeps Python, C++, and Java differences behind worker/runtime adapters', () => {
    const python = readFileSync(resolve(process.cwd(), 'src/compiler/runtimes/python/python.worker.js'), 'utf8');
    const native = readFileSync(resolve(process.cwd(), 'src/compiler/runtimes/native/nativeCompiler.worker.js'), 'utf8');
    const java = readFileSync(resolve(process.cwd(), 'src/compiler/runtimes/java/TeaVMJavaEngine.js'), 'utf8');
    expect(python).toMatch(/mountProjectFiles/); expect(python).toMatch(/snapshotProjectFiles/);
    expect(native).toMatch(/workspaceFiles/); expect(native).toMatch(/snapshotWasiDirectory/);
    expect(java).toMatch(/projectFiles\.filter/); expect(java).toMatch(/filesystemSupported: false/);
  });
});
