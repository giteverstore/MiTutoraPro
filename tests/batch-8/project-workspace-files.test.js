import { describe, expect, it } from 'vitest';
import { buildProjectTree, createInitialProjectFiles, normalizeProjectPath, supportsMultiFileProjectExecution, validateProjectFilePath } from '../../src/projects/workspace/projectWorkspaceFiles';

describe('project workspace file model', () => {
  const project = { language: 'python', starterCode: 'print("hello")', template: { sourcePath: 'src/main.py' } };

  it('migrates legacy single-source progress without losing learner code', () => {
    expect(createInitialProjectFiles(project, { submission: 'print("saved")' })).toEqual({
      entryFilePath: 'src/main.py',
      folders: [],
      files: { 'src/main.py': { path: 'src/main.py', content: 'print("saved")', language: 'python', editable: true } },
    });
  });

  it('accepts bounded virtual paths and rejects traversal, absolute, duplicate, and invalid extensions', () => {
    expect(normalizeProjectPath('src\\utils.py')).toBe('src/utils.py');
    expect(normalizeProjectPath('../secret.py')).toBeNull();
    expect(normalizeProjectPath('C:\\secret.py')).toBeNull();
    expect(validateProjectFilePath('src/utils.py', {}, 'python')).toMatchObject({ valid: true });
    expect(validateProjectFilePath('src/main.py', { 'src/main.py': {} }, 'python')).toMatchObject({ valid: false });
    expect(validateProjectFilePath('script.exe', {}, 'python')).toMatchObject({ valid: false });
  });

  it('truthfully keeps project runtime execution entry-file-only', () => {
    expect(supportsMultiFileProjectExecution('python')).toBe(false);
  });

  it('derives a sorted folder-first hierarchy from real nested paths', () => {
    const tree = buildProjectTree({ 'README.md': {}, 'src/main.py': {}, 'src/utils/math.py': {}, 'tests/test_main.py': {} });
    expect(tree.children.map(({ type, name }) => [type, name])).toEqual([['folder', 'src'], ['folder', 'tests'], ['file', 'README.md']]);
    expect(tree.children[0].children[0]).toMatchObject({ type: 'folder', path: 'src/utils' });
  });
});
