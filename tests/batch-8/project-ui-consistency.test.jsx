import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { ProjectFoundationCard } from '../../src/projects/components/ProjectFoundationCard';
import { ProjectFoundationDetails } from '../../src/projects/pages/ProjectFoundationDetails';
import { projectArtwork, projectDisplayDifficulty, sortProjectsByDifficulty } from '../../src/projects/presentation/projectPresentation';

afterEach(cleanup);

const easyProject = projectCatalog.getProjectById('simple-calculator');
const legacyProject = projectCatalog.getProjectById('cli-task-manager');
const progress = { status: 'not-started', completedCheckpoints: [] };

describe('Project presentation consistency', () => {
  it('normalizes display difficulty without changing the canonical records', () => {
    expect(['Beginner', 'Intermediate', 'Advanced', 'Easy', 'Medium', 'Hard'].map(projectDisplayDifficulty))
      .toEqual(['easy', 'medium', 'hard', 'easy', 'medium', 'hard']);
    expect(legacyProject.difficulty).toBe('Beginner');
  });

  it('sorts a flat catalog Easy, Medium, Hard while keeping source order within each group', () => {
    const records = [
      { id: 'h1', difficulty: 'Advanced' }, { id: 'm1', difficulty: 'Intermediate' },
      { id: 'e1', difficulty: 'Beginner' }, { id: 'h2', difficulty: 'Hard' },
      { id: 'e2', difficulty: 'Easy' }, { id: 'm2', difficulty: 'Medium' },
    ];
    expect(sortProjectsByDifficulty(records).map(({ id }) => id)).toEqual(['e1', 'e2', 'm1', 'm2', 'h1', 'h2']);
    expect(records[0].id).toBe('h1');
  });

  it('uses shared badges and a clean artwork area when no actual art is supplied', () => {
    const onOpen = vi.fn();
    const { container } = render(<ProjectFoundationCard project={easyProject} progress={progress} onOpen={onOpen} />);
    expect(screen.getByText('Project')).toHaveClass('content-type-badge--project');
    expect(screen.getByText('Easy')).toHaveClass('difficulty-badge--easy');
    expect(container.querySelector('.project-card-artwork')).toHaveClass('is-empty');
    expect(container.querySelector('.project-card-artwork')).toBeEmptyDOMElement();
    expect(container.querySelector('.project-card-meta')).toHaveTextContent('checkpoints');
    expect(screen.queryByRole('button', { name: 'Start Project' })).not.toBeInTheDocument();
    expect(container.querySelector('.project-card-description')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Project progress 0 percent' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('link', { name: easyProject.title }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(easyProject);
  });

  it('preserves explicitly configured terminal artwork and does not invent initials', () => {
    expect(projectArtwork(legacyProject)).toEqual({ kind: 'terminal' });
    const { container } = render(<ProjectFoundationCard project={legacyProject} progress={progress} onOpen={() => {}} />);
    expect(screen.getByText('Easy')).toHaveClass('difficulty-badge--easy');
    expect(container.querySelector('.project-card-artwork svg')).toBeInTheDocument();
    expect(container.querySelector('.project-card-artwork span')).not.toBeInTheDocument();
  });

  it('renders the themed overview hero and project-specific metrics without a back control', () => {
    const { container } = render(<ProjectFoundationDetails project={legacyProject} progress={progress} onStart={() => {}} />);
    expect(container.querySelector('.project-overview-hero')).toHaveClass('hero-pointer-grid-host');
    expect(container.querySelector('.project-overview-grid')).toBeInTheDocument();
    expect(container.querySelector('.project-overview-grid-highlight')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toHaveClass('difficulty-badge--easy');
    expect(screen.getByRole('complementary', { name: 'Project summary' })).toHaveTextContent('Checkpoints');
    expect(screen.getByRole('complementary', { name: 'Project summary' })).toHaveTextContent('Languages');
    expect(screen.getByRole('progressbar', { name: 'Project progress' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('button', { name: 'Start Project' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to Projects' })).not.toBeInTheDocument();
    const css = readFileSync(resolve(process.cwd(), 'src/styles/pages/projects.css'), 'utf8');
    expect(css).toMatch(/\.project-overview-hero\s*\{[^}]*height:\s*300px/);
  });

  it('keeps four/two/one card columns and the shared brand dimensions in CSS', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/pages/projects.css'), 'utf8');
    expect(css).toMatch(/\.project-grid\s*\{[^}]*repeat\(4, minmax\(0, 1fr\)\)/s);
    expect(css).toMatch(/max-width: 1199px[\s\S]*?\.project-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/max-width: 640px[\s\S]*?\.project-grid\s*\{[^}]*minmax\(0, 1fr\)/);
    expect(css).toContain('width: var(--shell-brand-mark-size)');
    expect(css).toContain('width: var(--shell-brand-mark-size)');
    expect(css).toMatch(/\.project-card\s*\{[^}]*width:\s*min\(100%, 14\.8125rem\);[^}]*height:\s*20\.875rem/);
    expect(css).toMatch(/\.project-card-footer\s*\{[^}]*min-height:\s*5rem/);
    const workspace = readFileSync(resolve(process.cwd(), 'src/projects/pages/ProjectWorkspace.jsx'), 'utf8');
    expect(workspace).toContain('className="project-ide-brand workspace-brand-link"');
    expect(workspace).toContain('<BrandMark />');
    expect(workspace).not.toContain('<BrandWordmark');
  });
});
