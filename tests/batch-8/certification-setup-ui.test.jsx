import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnvironmentChecklist } from '../../src/exam/components/EnvironmentChecklist/EnvironmentChecklist';

const setupSource = readFileSync('src/exam/pages/SetupVerificationExperience.jsx', 'utf8');
const environmentSource = readFileSync('src/exam/components/EnvironmentCheck/EnvironmentCheck.jsx', 'utf8');
const checklistSource = readFileSync('src/exam/components/EnvironmentChecklist/EnvironmentChecklist.jsx', 'utf8');
const examCss = readFileSync('src/styles/pages/exam.css', 'utf8');

const health = Object.fromEntries(
  ['camera', 'lighting', 'face', 'background', 'browser', 'fullscreen', 'internet', 'audio']
    .map((id) => [id, { severity: 'pending', status: 'UNABLE_TO_VERIFY', message: `${id} status detail` }]),
);

describe('certification setup presentation cleanup', () => {
  it('starts with functional verification content and removes passive page copy', () => {
    for (const removed of [
      'Pre-exam system check',
      'Test your certification setup',
      'Verify your browser, camera, lighting, background, connectivity, and audio before booking or attempting a certification exam.',
    ]) expect(setupSource).not.toContain(removed);
    expect(environmentSource).toContain('Verify your exam environment');
    expect(environmentSource).not.toContain('System readiness');
    expect(environmentSource).not.toContain('Remain visible in a well-lit');
    expect(checklistSource).toContain('Environment health');
    expect(checklistSource).not.toContain('Live system health');
    expect(checklistSource).not.toContain('Checks update automatically');
  });

  it('removes only the separate audio-analysis card while retaining Audio health', () => {
    expect(environmentSource).not.toContain('AcousticFeedback');
    for (const removed of ['Audio integrity check', 'Speech', 'Background noise', 'Music / media', 'Keyboard', 'Microphone health']) {
      expect(environmentSource).not.toContain(removed);
    }

    render(<EnvironmentChecklist vision={{ health, readinessScore: 25, minimumReadinessScore: 80 }} />);
    expect(screen.getByRole('heading', { name: 'Environment health' })).toBeInTheDocument();
    for (const label of ['Camera', 'Lighting', 'Face Detection', 'Background', 'Browser', 'Fullscreen', 'Internet', 'Audio']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('removes direct quality metrics without removing health state inputs', () => {
    expect(checklistSource).not.toContain('quality-indicators');
    expect(checklistSource).not.toContain('role="meter"');
    expect(checklistSource).not.toContain('Face stability');
    expect(checklistSource).not.toContain('Camera stability');
    expect(checklistSource).toContain('vision.health[id]');
  });

  it('uses the simplified setup typography and neutral surface contracts', () => {
    expect(examCss).toMatch(/\.vision-verification \.exam-card-heading h2 \{[^}]*font-size: 1\.5rem;/s);
    expect(examCss).toMatch(/\.vision-verification \.button,[\s\S]*?font-size: 1rem;/s);
    expect(examCss).toMatch(/\.environment-health-item p \{[^}]*font-size: \.875rem;/s);
    expect(examCss).toMatch(/\.environment-health-item \{[^}]*background: #f1f5f9;/s);
    expect(examCss).toMatch(/\.exam-experience\[data-theme="dark"\] \.environment-health-item,[\s\S]*?background: var\(--color-surface-subtle\);/s);
    expect(examCss).toMatch(/\.readiness-score\.is-ready \{[^}]*background: var\(--color-accent-soft\);/s);
    expect(examCss).toMatch(/\.readiness-score \{[^}]*background: var\(--color-danger-soft\);/s);
  });

  it('allocates more desktop width to Environment health without creating an inner scroller', () => {
    expect(examCss).toMatch(/\.vision-verification \{[^}]*grid-template-columns: minmax\(0, 1\.8fr\) minmax\(20rem, 1fr\);/s);
    expect(examCss).toMatch(/\.vision-preview-column,\s*\.environment-health \{[^}]*min-width: 0;/s);
    expect(examCss).not.toMatch(/\.environment-health \{[^}]*(?:overflow|block-size|max-height):/s);
    expect(examCss).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.vision-verification \{\s*grid-template-columns: 1fr;/s);
  });
});
