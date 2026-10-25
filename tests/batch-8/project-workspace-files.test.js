import { describe, expect, it } from 'vitest';
import { buildProjectTree, createInitialProjectFiles, languageForPath, normalizeProjectPath, supportsMultiFileProjectExecution, validateProjectFilePath } from '../../src/projects/workspace/projectWorkspaceFiles';

describe('project workspace file model', () => {
  const project = { language: 'python', starterCode: 'print("hello")', template: { sourcePath: 'src/main.py' } };

  it('migrates legacy single-source progress without losing learner code', () => {
    expect(createInitialProjectFiles(project, { submission: 'print("saved")' })).toEqual({
      entryFilePath: 'src/main.py',
      folders: [],
      files: { 'src/main.py': { path: 'src/main.py', content: 'print("saved")', language: 'python', editable: true } },
    });
  });

  it('accepts arbitrary safe filenames and rejects traversal, absolute, and duplicate paths', () => {
    expect(normalizeProjectPath('src\\utils.py')).toBe('src/utils.py');
    expect(normalizeProjectPath('../secret.py')).toBeNull();
    expect(normalizeProjectPath('C:\\secret.py')).toBeNull();
    expect(validateProjectFilePath('src/utils.py', {}, 'python')).toMatchObject({ valid: true });
    expect(validateProjectFilePath('src/main.py', { 'src/main.py': {} }, 'python')).toMatchObject({ valid: false });
    for (const path of ['Main.java', 'index.js', 'App.jsx', 'style.css', 'main.cpp', 'main.c', 'hello.go', 'Cargo.toml', 'Dockerfile', 'Makefile', '.gitignore', 'README', 'config.yaml']) {
      expect(validateProjectFilePath(path, {}, 'python')).toEqual({ valid: true, path });
    }
    expect(validateProjectFilePath('src/../secret.py', {}, 'python')).toMatchObject({ valid: false });
  });

  it('maps known editor languages and safely falls back to plaintext', () => {
    expect(validateProjectFilePath('custom.unknown', {}, 'python')).toEqual({ valid: true, path: 'custom.unknown' });
    expect(languageForPath('App.jsx', 'python')).toBe('javascript');
    expect(languageForPath('style.css', 'python')).toBe('css');
    expect(languageForPath('custom.unknown', 'python')).toBe('plaintext');
    expect(languageForPath('README', 'python')).toBe('plaintext');
  });

  it('derives multi-file execution support from runtime capabilities', () => {
    expect(supportsMultiFileProjectExecution({ filesystem: { multiFile: true } })).toBe(true);
    expect(supportsMultiFileProjectExecution({ filesystem: { multiFile: false } })).toBe(false);
  });

  it('derives a sorted folder-first hierarchy from real nested paths', () => {
    const tree = buildProjectTree({ 'README.md': {}, 'src/main.py': {}, 'src/utils/math.py': {}, 'tests/test_main.py': {} });
    expect(tree.children.map(({ type, name }) => [type, name])).toEqual([['folder', 'src'], ['folder', 'tests'], ['file', 'README.md']]);
    expect(tree.children[0].children[0]).toMatchObject({ type: 'folder', path: 'src/utils' });
  });
});
