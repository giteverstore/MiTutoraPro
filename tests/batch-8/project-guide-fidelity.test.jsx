import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { PROJECT_GUIDE_SOURCE_CONTRACTS } from '../../src/projects/catalog/projectGuideSourcePages';
import { buildProjectSourcePages, resolveSavedGuidePageIndex } from '../../src/projects/guide/projectSourcePages';
import { validateProjectGuideFidelity } from '../../src/projects/guide/projectGuideFidelity';
import { ProjectGuideRenderer } from '../../src/projects/components/ProjectGuideRenderer';
import { guidePageText } from '../../src/projects/pages/ProjectWorkspace';

describe('physical DOCX Project Guide fidelity', () => {
  it.each(Object.entries(PROJECT_GUIDE_SOURCE_CONTRACTS))('%s covers every physical source page once', (projectId, contract) => {
    const project = projectCatalog.getProjectById(projectId);
    expect(validateProjectGuideFidelity(project, contract)).toEqual([]);
    expect(project.guidePages.every(({ sourcePageStart, sourcePageEnd }) => sourcePageStart === sourcePageEnd)).toBe(true);
    expect(project.guidePages.some(({ blocks }) => blocks.some(({ type }) => type === 'table' || type === 'code' || type === 'expected-output'))).toBe(true);
  });

  it('renders preserved diagrams as real responsive images', () => {
    const project = projectCatalog.getProjectById('blackjack');
    const imagePage = project.guidePages.find(({ blocks }) => blocks.some(({ type }) => type === 'image'));
    render(<ProjectGuideRenderer blocks={imagePage.blocks} project={project} runtime="python" />);
    expect(screen.getByRole('img', { name: 'Blackjack game flow diagram' })).toHaveAttribute('src', '/assets/projects/guides/blackjack/image1.png');
  });

  it('wraps source-styled monospace prose while preserving genuine code blocks', () => {
    const { container, rerender } = render(<ProjectGuideRenderer blocks={[{ type: 'code', code: 'This sentence was styled with a monospace source font but remains prose.' }]} />);
    expect(container.querySelector('.project-guide-monospace-prose')).toHaveTextContent('This sentence was styled with a monospace source font but remains prose.');
    expect(container.querySelector('pre')).not.toBeInTheDocument();

    rerender(<ProjectGuideRenderer blocks={[{ type: 'code', code: 'FUNCTION main():\n    PRINT "Hello"' }]} />);
    expect(container.querySelector('.project-guide-code-block')).toHaveTextContent('FUNCTION main():');
  });

  it('keeps Hangman physical page 7 as its exact sparse two-step continuation', () => {
    const page = projectCatalog.getProjectById('hangman').guidePages[6];
    expect(page).toMatchObject({
      id: 'hangman-source-page-07',
      sourcePageStart: 7,
      sourcePageEnd: 7,
      sourcePages: [7],
      title: '3.  If the character has not been guessed yet, replace it with an underscore (_).',
    });
    expect(page.blocks).toEqual([{ type: 'heading', level: 3, text: '4.  Join the resulting characters with single space delimiters (e.g., "P _ _ _ E _" for "PLANET" with guesses [\'P\', \'E\']).' }]);
  });

  it('restores by stable ID/source page and safely migrates a legacy condensed index', () => {
    const guide = buildProjectSourcePages(projectCatalog.getProjectById('hangman'));
    expect(resolveSavedGuidePageIndex(guide, { guidePageId: 'hangman-source-page-09', guidePageIndex: 2 })).toBe(8);
    expect(resolveSavedGuidePageIndex(guide, { guideSourcePage: 23 })).toBe(22);
    expect(resolveSavedGuidePageIndex(guide, { guidePageIndex: 20, currentCheckpoint: 4 })).toBe(guide.checkpointFirstPageIndices[4]);
  });

  it('sends the full current physical page content to Project AI', () => {
    const project = projectCatalog.getProjectById('currency-converter');
    const page = project.guidePages.find(({ blocks }) => blocks.some(({ type }) => type === 'table'));
    const context = guidePageText(page, 'fallback');
    expect(context).toContain(page.title);
    expect(context.length).toBeGreaterThan(page.title.length);
  });
});
