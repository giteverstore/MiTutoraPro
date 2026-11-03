import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync('src/projects/pages/ProjectWorkspace.jsx', 'utf8');
const css = readFileSync('src/styles/pages/projects.css', 'utf8');

describe('Project Explorer row alignment', () => {
  it('uses separate chevron, icon, and filename slots for root, folder, and file rows', () => {
    expect(workspace).toContain('className="project-tree-chevron"');
    expect(workspace).toContain('className="project-tree-icon"');
    expect(workspace).toContain('className="project-tree-name"');
    expect(workspace).toContain('<FolderOpen className="project-tree-icon"');
    expect(workspace).toContain('<Folder className="project-tree-icon"');
    expect(workspace).toContain('<ProjectFileIcon path={node.path} />');
  });

  it('bounds every icon independently of SVG or image intrinsic dimensions', () => {
    expect(css).toMatch(/\.project-tree-icon\s*\{[^}]*width:\s*1rem;[^}]*height:\s*1rem;[^}]*max-width:\s*1rem;[^}]*max-height:\s*1rem;[^}]*flex:\s*0 0 1rem;[^}]*object-fit:\s*contain;/s);
    expect(css).toMatch(/\.project-tree-chevron\s*\{[^}]*width:\s*1rem;[^}]*height:\s*1rem;[^}]*flex:\s*0 0 1rem;/s);
  });

  it('keeps compact rows and truncates long names at narrow Explorer widths', () => {
    expect(css).toMatch(/\.project-tree-root,\.project-tree-row\s*\{[^}]*height:\s*1\.625rem;/s);
    expect(css).toMatch(/\.project-tree-root>button,\.project-tree-main\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.project-tree-name\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  });

  it('preserves depth-based indentation and selected/hover states', () => {
    expect(css).toContain('padding-left: calc(var(--tree-depth) * .875rem);');
    expect(css).toContain('.project-tree-row:hover,.project-tree-row:focus-within { background: var(--color-surface-hover); }');
    expect(css).toContain('.project-tree-row.is-selected { background: var(--color-accent-subtle); }');
  });

  it('never renders project or file artwork in tree icon slots', () => {
    expect(workspace).not.toContain('src={icon.asset}');
    expect(workspace).not.toMatch(/<img[^>]+src=/);
  });

  it('uses the same canonical icon renderer in editor tabs without disturbing tab controls', () => {
    expect(workspace).toContain('<ProjectFileIcon path={path} className="project-editor-tab-icon" />');
    expect(workspace).toContain('className="project-editor-tab-name"');
    expect(workspace).toContain('className="project-editor-tab-dirty" aria-label="Modified"');
    expect(workspace).toContain('aria-label={`Close ${path}`}');
    expect(css).toMatch(/\.project-editor-tab-icon\s*\{[^}]*width:\s*\.9rem;[^}]*height:\s*\.9rem;[^}]*flex:\s*0 0 \.9rem;/s);
    expect(css).toMatch(/\.project-editor-tab-name\s*\{[^}]*min-width:\s*0;[^}]*text-overflow:\s*ellipsis;/s);
  });
});
