import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { resolveApplicationTheme } from '../../src/theme/useApplicationTheme';
import { resolve } from 'node:path';

describe('theme ownership', () => {
  it('resolves light, dark, and system preferences deterministically', () => {
    expect(resolveApplicationTheme('light', 'dark')).toBe('light');
    expect(resolveApplicationTheme('dark', 'light')).toBe('dark');
    expect(resolveApplicationTheme('system', 'dark')).toBe('dark');
    expect(resolveApplicationTheme('system', 'light')).toBe('light');
  });

  it('provides critical semantic tokens for both theme layers', async () => {
    const css = await readFile(resolve('src/design-system/tokens.css'), 'utf8');
    for (const token of ['canvas', 'surface', 'text', 'text-muted', 'border', 'accent', 'danger', 'focus', 'overlay']) {
      expect(css).toContain(`--color-${token}:`);
    }
    expect(css).toMatch(/:root[^\n]*\[data-theme="dark"\]/);
  });

  it('does not retain legacy application-theme localStorage writers', async () => {
    for (const path of ['src/app-shell/AppShell.jsx', 'src/components/Layout.jsx', 'src/course-overview/CourseOverview.jsx', 'src/dashboard/Dashboard.jsx']) {
      const source = await readFile(resolve(path), 'utf8');
      expect(source).not.toContain("localStorage.setItem('mi-tutora:theme'");
    }
  });
});
