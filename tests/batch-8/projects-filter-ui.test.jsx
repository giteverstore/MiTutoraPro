import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT_FILTERS, filterProjects, projectResultsHeading, ProjectsPage } from '../../src/projects/pages/ProjectsPage';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog.js';

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
    render(<ProjectsPage publishedRepository={{
      listProjects: async () => [],
      resolveProject: async (projectId) => ({ project: projectCatalog.getProjectById(projectId) }),
    }} />);
    expect(screen.getByRole('status', { name: 'Loading projects' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Project/ })).not.toBeInTheDocument();
    await screen.findByRole('link', { name: /Simple Calculator/ });
  }

  it('starts directly with three balanced filters and no retired hero or tabs', async () => {
    await renderCatalog();
    expect(screen.queryByText('Build projects you can keep.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Implement focused Python utilities/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Project difficulty' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(DEFAULT_PROJECT_FILTERS.difficulty).toBe('all');
    expect(screen.getByRole('combobox', { name: 'Difficulty' })).toHaveTextContent('All difficulties');
    expect(document.querySelector('.project-filters select')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ projects?$/)).not.toBeInTheDocument();
  });

  it.each([
    ['easy', 'Easy Projects', 1],
    ['medium', 'Medium Projects', 0],
    ['hard', 'Hard Projects', 0],
  ])('filters %s projects and updates the heading without rendering a count', async (difficulty, heading, count) => {
    await renderCatalog();
    fireEvent.click(screen.getByRole('combobox', { name: 'Difficulty' }));
    fireEvent.click(screen.getByRole('option', { name: difficulty[0].toUpperCase() + difficulty.slice(1) }));
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.queryByText(`${count} ${count === 1 ? 'project' : 'projects'}`)).not.toBeInTheDocument();
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

  it('opens an overview from the whole project card', async () => {
    await renderCatalog();
    fireEvent.click(screen.getAllByRole('link', { name: /Simple Calculator/ })[0]);
    expect(await screen.findByRole('button', { name: /Start Project/ })).toBeInTheDocument();
  });

  it('keeps project cards and overview available without Premium access', async () => {
    await renderCatalog();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Start Project/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('link', { name: /Simple Calculator/ })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Simple Calculator' })).toBeInTheDocument();
    expect(screen.queryByText('Premium required')).not.toBeInTheDocument();
  });
});
