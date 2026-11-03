import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync('src/projects/pages/ProjectWorkspace.jsx', 'utf8');
const css = readFileSync('src/styles/pages/projects.css', 'utf8');

describe('Project workspace separated pane layout', () => {
  it('uses one compact gutter contract for the major IDE regions', () => {
    expect(css).toMatch(/--project-pane-gap:\s*0\.375rem;/);
    expect(css).toMatch(/\.project-ide-main\s*\{[^}]*grid-template-columns:[^;]*var\(--project-pane-gap\)[^;]*var\(--project-pane-gap\)/s);
    expect(css).toMatch(/\.project-center-column\s*\{[^}]*grid-template-rows:[^;]*var\(--project-pane-gap\)/s);
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*?\.project-center-column\s*\{[^}]*var\(--project-pane-gap\)/);
  });

  it.each([
    '.project-explorer-panel',
    '.project-editor-pane',
    '.project-bottom-panel',
    '.project-ai-panel',
  ])('gives %s a restrained bordered and rounded surface', (selector) => {
    const escaped = selector.replace('.', '\\.');
    expect(css).toMatch(new RegExp(`${escaped}\\s*\\{[^}]*border:\\s*1px solid var\\(--project-pane-border\\);[^}]*border-radius:\\s*var\\(--project-pane-radius\\);`, 's'));
  });

  it('uses the approved light border and semantic dark border', () => {
    expect(css).toMatch(/--project-pane-border:\s*#d3dce6;/);
    expect(css).toMatch(/\.project-ide-shell\[data-project-theme="dark"\]\s*\{[^}]*--project-pane-border:\s*var\(--color-border\);/s);
    expect(css).toMatch(/--project-pane-radius:\s*var\(--radius-md\);/);
  });

  it('keeps all three splitters interactive in the pane gutters', () => {
    for (const label of ['Resize left panel', 'Resize Guide and AI', 'Resize bottom panel']) {
      expect(workspace).toContain(`aria-label="${label}"`);
    }
    expect(css).toMatch(/\.project-vertical-resizer\s*\{[^}]*cursor:\s*col-resize;/s);
    expect(css).toMatch(/\.project-horizontal-resizer\s*\{[^}]*cursor:\s*row-resize;[^}]*background:\s*transparent;/s);
  });

  it('keeps the status bar edge-to-edge and the workspace fitted to the viewport', () => {
    expect(css).toMatch(/\.project-ide-shell\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.project-ide-statusbar\s*\{[^}]*background:\s*var\(--project-status-bg\);/s);
    expect(css).not.toMatch(/\.project-ide-statusbar\s*\{[^}]*(?:border-radius|margin):/s);
    expect(css).toMatch(/\.project-ide-main\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
  });
});
