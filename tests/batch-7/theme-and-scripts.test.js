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
    const css = await readFile(resolve('src/styles/theme.css'), 'utf8');
    for (const token of ['canvas', 'surface', 'text', 'text-muted', 'border', 'accent', 'danger', 'focus', 'overlay']) {
      expect(css).toContain(`--color-${token}:`);
    }
    expect(css).toMatch(/:root[^\n]*\[data-theme="dark"\]/);
    expect(css).toContain('--color-accent: #2563eb');
    expect(css).toContain('--color-accent: #60a5fa');
  });

  it('keeps palette values out of the non-color token file', async () => {
    const css = await readFile(resolve('src/design-system/tokens.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i);
  });

  it('centralizes the blue brand palette while preserving semantic and difficulty colors', async () => {
    const css = await readFile(resolve('src/styles/theme.css'), 'utf8');
    expect(css).toMatch(/:root[\s\S]*--color-accent: #2563eb;[\s\S]*--color-accent-hover: #1d4ed8;[\s\S]*--color-accent-soft: #dbeafe;[\s\S]*--color-accent-subtle: #eff6ff;[\s\S]*--color-text-on-accent: #ffffff;/);
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*--color-accent: #60a5fa;[\s\S]*--color-accent-hover: #93c5fd;[\s\S]*--color-accent-soft: #172554;[\s\S]*--color-accent-subtle: #0f172a;[\s\S]*--color-text-on-accent: #0b1220;/);
    expect(css).toContain('--color-success: #3f6658');
    expect(css).toContain('--difficulty-easy-base: #b8e8c5');
    expect(css).toContain('--difficulty-medium-base: #ffd66b');
    expect(css).toContain('--difficulty-hard-base: #ffb3be');
  });

  it('loads the theme palette before non-color and component styles', async () => {
    const source = await readFile(resolve('src/main.jsx'), 'utf8');
    expect(source.indexOf("import './styles/theme.css'")).toBeLessThan(source.indexOf("import './design-system/tokens.css'"));
    expect(source.indexOf("import './design-system/tokens.css'")).toBeLessThan(source.indexOf("import './styles/index.css'"));
  });

  it('does not retain legacy application-theme localStorage writers', async () => {
    for (const path of ['src/app-shell/AppShell.jsx', 'src/components/Layout.jsx', 'src/course-overview/CourseOverview.jsx', 'src/dashboard/Dashboard.jsx']) {
      const source = await readFile(resolve(path), 'utf8');
      expect(source).not.toContain("localStorage.setItem('mi-tutora:theme'");
    }
  });
});
