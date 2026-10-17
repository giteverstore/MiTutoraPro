import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const learningCss = readFileSync('src/styles/pages/learning-engine.css', 'utf8');
const dashboardCss = readFileSync('src/styles/pages/dashboard.css', 'utf8');
const editorCss = readFileSync('src/styles/editor-themes.css', 'utf8');
const applicationCss = learningCss.slice(0, learningCss.indexOf('.desktop-compiler'));

describe('Learning Engine application-theme ownership', () => {
  it('establishes semantic foreground and surfaces at the course shell', () => {
    expect(learningCss).toMatch(/\.app-shell\s*\{[^}]*color: var\(--color-text\);[^}]*background: var\(--color-canvas\);/s);
    expect(learningCss).toMatch(/\.topbar\s*\{[^}]*background: color-mix\(in srgb, var\(--color-surface\) 94%, transparent\);/s);
    expect(learningCss).toMatch(/\.course-sidebar\s*\{[^}]*background: var\(--color-surface-raised\);/s);
    expect(learningCss).toMatch(/\.lesson-panel\s*\{[^}]*background: var\(--color-canvas\);/s);
    expect(learningCss).toMatch(/\.lesson-completion-footer\s*\{[^}]*background: color-mix\(in srgb, var\(--color-surface\) 94%, transparent\);/s);
  });

  it('does not consume root-resolved legacy aliases in application-owned lesson surfaces', () => {
    expect(applicationCss).not.toMatch(/var\(--(?:canvas|surface|surface-muted|surface-dark|ink|muted|line|accent|accent-soft|danger)\)/);
    expect(dashboardCss).toMatch(/\.app-shell\[data-theme="dark"\] \.lesson-link\.is-active\s*\{[^}]*color: var\(--color-accent\);/s);
  });

  it('uses a theme-aware active lesson and readable lesson copy', () => {
    expect(learningCss).toMatch(/\.lesson-link\.is-active\s*\{[^}]*color: var\(--color-accent\);[^}]*background: var\(--color-accent-subtle\);[^}]*inset 3px 0 0 var\(--color-accent\);/s);
    expect(learningCss).toMatch(/\.reading-copy p,[\s\S]*?color: var\(--color-text\);/);
    expect(dashboardCss).toMatch(/\.app-shell\[data-theme="dark"\] \.reading-copy p,[\s\S]*?color: var\(--color-text-secondary\);/);
  });

  it('does not let application dark mode style compiler internals', () => {
    expect(dashboardCss).not.toMatch(/\.app-shell\[data-theme="dark"\][^{]*(?:compiler|editor|console|language-select|resize-handle-horizontal)/);
    expect(editorCss).toContain('.compiler-ide[data-editor-theme="github-light"]');
    expect(editorCss).toContain('.compiler-ide[data-editor-theme="amoled"]');
    expect(editorCss).toContain('.compiler-ide[data-editor-theme] .compiler-workspace');
  });

  it('keeps the themed overview hero and elevated summary readable in dark mode', () => {
    expect(dashboardCss).toMatch(/\.overview-hero\s*\{[^}]*color: #fff;[^}]*background: linear-gradient\(to bottom, var\(--color-accent\) 0%,[^;]*#05070b 100%\);/s);
    expect(dashboardCss).toMatch(/\.application-shell\[data-theme="dark"\] \.overview-hero\s*\{[^}]*border-color: rgb\(255 255 255 \/ 18%\);/s);
    expect(dashboardCss).toMatch(/\.overview-hero-summary\s*\{[^}]*color: var\(--color-text\);[^}]*background: var\(--color-surface-raised\);/s);
    expect(dashboardCss).toMatch(/\.overview-hero-progress>div\[role="progressbar"\]\s*\{[^}]*background: var\(--color-border\);/s);
    expect(dashboardCss).toMatch(/\.overview-hero-copy>p\s*\{[^}]*color: #fff;/s);
    expect(dashboardCss).toMatch(/\.overview-hero h1\s*\{[^}]*color: #fff;/s);
  });
});
