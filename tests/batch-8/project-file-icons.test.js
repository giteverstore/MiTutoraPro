import { describe, expect, it } from 'vitest';
import { projectFileIcon } from '../../src/projects/workspace/projectFileIcons.js';

describe('Project Explorer file icons', () => {
  it.each([
    ['main.py', 'python'],
    ['Main.java', 'java'],
    ['sourceSnapshot.js', 'javascript'],
    ['Component.jsx', 'javascript'],
    ['policy.ts', 'typescript'],
    ['Panel.tsx', 'typescript'],
    ['main.c', 'c'],
    ['main.cpp', 'cpp'],
    ['native.cc', 'cpp'],
    ['native.cxx', 'cpp'],
    ['main.go', 'go'],
    ['main.rs', 'rust'],
    ['index.html', 'html'],
    ['styles.css', 'css'],
    ['package.json', 'json'],
    ['guide.md', 'markdown'],
    ['pipeline.yml', 'yaml'],
    ['pipeline.yaml', 'yaml'],
    ['build.sh', 'shell'],
  ])('maps %s to the %s icon', (path, id) => {
    expect(projectFileIcon(path).id).toBe(id);
  });

  it.each([
    ['Dockerfile', 'dockerfile'],
    ['README', 'readme'],
    ['README.md', 'readme'],
    ['.gitignore', 'gitignore'],
    ['Cargo.toml', 'rust'],
  ])('maps special file %s to the %s icon', (path, id) => {
    expect(projectFileIcon(path).id).toBe(id);
  });

  it('uses the generic file icon for unknown and extensionless files', () => {
    expect(projectFileIcon('notes.custom')).toMatchObject({ id: 'file', lucide: 'file' });
    expect(projectFileIcon('LICENSE')).toMatchObject({ id: 'file', lucide: 'file' });
  });
});
