import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT_FILTERS, filterProjects, projectResultsHeading, ProjectsPage } from '../../src/projects/pages/ProjectsPage';

const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
});
beforeEach(() => storage.clear());
afterEach(cleanup);

describe('Projects filter cleanup', () => {
  async function renderCatalog() {
    render(<ProjectsPage publishedRepository={{ listProjects: async () => [] }} />);
    expect(screen.getByRole('status', { name: 'Loading projects' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Project/ })).not.toBeInTheDocument();
    await screen.findByText('6 projects available');
  }

  it('starts directly with three balanced filters and no retired hero or tabs', async () => {
    await renderCatalog();
    expect(screen.queryByText('Build projects you can keep.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Implement focused Python utilities/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Project difficulty' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Difficulty')).toHaveValue(DEFAULT_PROJECT_FILTERS.difficulty);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('6 projects available')).toBeInTheDocument();
  });

  it.each([
    ['easy', 'Easy Projects', 6],
    ['medium', 'Medium Projects', 0],
    ['hard', 'Hard Projects', 0],
  ])('filters %s projects and updates heading/count', async (difficulty, heading, count) => {
    await renderCatalog();
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: difficulty } });
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(`${count} ${count === 1 ? 'project' : 'projects'} available`)).toBeInTheDocument();
    if (count === 0) expect(screen.getByText('No projects match these filters yet.')).toBeInTheDocument();
  });

  it('composes language, category, and difficulty without changing project records', () => {
    const projects = [
      { id: 'one', supportedLanguages: ['python'], category: 'Utilities', difficulty: 'Easy' },
      { id: 'two', supportedLanguages: ['python'], category: 'Games', difficulty: 'Easy' },
      { id: 'three', supportedLanguages: ['java'], category: 'Utilities', difficulty: 'Intermediate' },
    ];
    expect(filterProjects(projects, { language: 'python', category: 'Utilities', difficulty: 'easy' })).toEqual([projects[0]]);
    expect(filterProjects(projects, { language: 'java', category: 'Utilities', difficulty: 'advanced' })).toEqual([]);
    expect(filterProjects(projects, { language: 'java', category: 'Utilities', difficulty: 'medium' })).toEqual([projects[2]]);
    expect(projectResultsHeading('all')).toBe('Projects');
  });

  it('preserves existing project actions', async () => {
    await renderCatalog();
    fireEvent.click(screen.getAllByRole('button', { name: /Start Project/ })[0]);
    expect(screen.getByRole('button', { name: /Start Project/ })).toBeInTheDocument();
  });

  it('keeps project cards and overview available without Premium access', async () => {
    await renderCatalog();
    expect(screen.getAllByRole('button', { name: /Start Project/ })).toHaveLength(6);
    fireEvent.click(screen.getAllByRole('button', { name: /Start Project/ })[0]);
    expect(screen.getByRole('heading', { level: 1, name: 'Simple Calculator' })).toBeInTheDocument();
    expect(screen.queryByText('Premium required')).not.toBeInTheDocument();
  });
});
