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
