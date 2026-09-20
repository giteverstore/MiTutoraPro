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
  it('starts directly with three balanced filters and no retired hero or tabs', () => {
    render(<ProjectsPage />);
    expect(screen.queryByText('Build projects you can keep.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Implement focused Python utilities/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Project difficulty' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Difficulty')).toHaveValue(DEFAULT_PROJECT_FILTERS.difficulty);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('5 projects available')).toBeInTheDocument();
  });

  it.each([
    ['easy', 'Easy Projects', 5],
    ['intermediate', 'Intermediate Projects', 0],
    ['advanced', 'Advanced Projects', 0],
  ])('filters %s projects and updates heading/count', (difficulty, heading, count) => {
    render(<ProjectsPage />);
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: difficulty } });
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(`${count} projects available`)).toBeInTheDocument();
    if (count === 0) expect(screen.getByText('No projects match these filters yet.')).toBeInTheDocument();
  });

  it('composes language, category, and difficulty without changing project records', () => {
    const projects = [
      { id: 'one', language: 'python', category: 'Utilities', difficulty: 'Easy' },
      { id: 'two', language: 'python', category: 'Games', difficulty: 'Easy' },
      { id: 'three', language: 'java', category: 'Utilities', difficulty: 'Intermediate' },
    ];
    expect(filterProjects(projects, { language: 'python', category: 'Utilities', difficulty: 'easy' })).toEqual([projects[0]]);
    expect(filterProjects(projects, { language: 'java', category: 'Utilities', difficulty: 'advanced' })).toEqual([]);
    expect(projectResultsHeading('all')).toBe('Projects');
  });

  it('preserves existing project actions', () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /View Project/ })[0]);
    expect(screen.getByRole('button', { name: /Start Project/ })).toBeInTheDocument();
  });

  it('keeps project cards and overview available without Premium access', () => {
    render(<ProjectsPage />);
    expect(screen.getAllByRole('button', { name: /View Project/ })).toHaveLength(5);
    fireEvent.click(screen.getAllByRole('button', { name: /View Project/ })[0]);
    expect(screen.getByRole('heading', { level: 1, name: 'Simple Calculator' })).toBeInTheDocument();
    expect(screen.queryByText('Premium required')).not.toBeInTheDocument();
  });
});
