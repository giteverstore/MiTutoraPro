import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../../src/public/LandingPage';
import { PublicHeader } from '../../src/public/PublicHeader';
import { ProjectsPage } from '../../src/projects/pages/ProjectsPage';
import { PublicBrowseApplication } from '../../src/public/PublicBrowseApplication';

vi.mock('../../src/practice/practiceContentSource', () => ({
  practiceContentSource: {
    listCatalog: vi.fn().mockResolvedValue([{ id: 'question-one', title: 'Add two values', summary: 'Return the sum.', language: 'Python', difficulty: 'easy', topic: 'Functions', estimatedMinutes: 8 }]),
    listPage: vi.fn().mockResolvedValue({ items: [{ id: 'question-one', title: 'Add two values', summary: 'Return the sum.', language: 'Python', difficulty: 'easy', topic: 'Functions', estimatedMinutes: 8 }], cursor: null, hasMore: false, source: 'local', facets: { difficulties: ['easy'], topics: ['Functions'] } }),
  },
}));
vi.mock('../../src/routing/CourseRoute', () => ({
  CourseRoute: ({ anonymous, onEnterCourse }) => <section data-anonymous={anonymous}><h1>Shared Course Overview</h1><button type="button" onClick={onEnterCourse}>Start Course</button></section>,
}));

const session = new Map();
vi.stubGlobal('sessionStorage', {
  getItem: (key) => session.get(key) ?? null,
  setItem: (key, value) => session.set(key, value),
  removeItem: (key) => session.delete(key),
  clear: () => session.clear(),
});

beforeEach(() => {
  session.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(cleanup);

describe('public Y Coders landing page', () => {
  it('renders the public product journey without the authenticated shell', () => {
    const { container } = render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1, name: /From "I Understand" to/ })).toBeVisible();
    expect(screen.getAllByRole('link', { name: /Explore Courses/ })[0]).toHaveAttribute('href', '/library');
    expect(screen.getByRole('link', { name: /Explore Practice/ })).toHaveAttribute('href', '/practice');
    expect(screen.getByRole('link', { name: /Explore Projects/ })).toHaveAttribute('href', '/projects');
    expect(container.querySelector('.app-shell')).not.toBeInTheDocument();
  });

  it('publishes the public navigation and valid footer destinations', () => {
    render(<LandingPage />);
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    for (const [name, href] of [['Courses', '/library'], ['Practice', '/practice'], ['Projects', '/projects'], ['About', '/about'], ['Contact', '/contact'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Refund Policy', '/refund-policy']]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('preserves the intended destination when Login is requested', () => {
    render(<PublicHeader activePath="/projects" />);
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(session.get('ycoders:auth-return')).toBe('/projects');
    expect(window.location.pathname).toBe('/login');
  });

  it('gives Sign Up a visible blue default state without relying on hover', () => {
    const css = readFileSync('src/styles/pages/landing.css', 'utf8');
    expect(css).toMatch(/\.marketing-auth-actions \.button\{[^}]*background:var\(--color-accent\)/);
    expect(css).toMatch(/\.marketing-auth-actions \.button:hover\{[^}]*background:var\(--color-accent-hover\)/);
  });
});

describe('anonymous project browsing boundary', () => {
  it('allows project overview browsing but requests authentication before starting', () => {
    const onRequireAuth = vi.fn();
    render(<ProjectsPage browseOnly onRequireAuth={onRequireAuth} />);
    fireEvent.click(screen.getAllByRole('button', { name: /View Project/ })[0]);
    expect(screen.getByRole('heading', { level: 1, name: 'Simple Calculator' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Start Project' }));
    expect(onRequireAuth).toHaveBeenCalledWith('/projects');
  });
});

describe('public browse routing', () => {
  it('renders the shared Library page in the public shell without private navigation or progress', () => {
    window.history.replaceState({}, '', '/library');
    const { container } = render(<PublicBrowseApplication />);
    expect(container.querySelector('.library-main')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeVisible();
    expect(container.querySelector('.app-sidebar')).not.toBeInTheDocument();
    expect(container.querySelector('.library-course-progress')).not.toBeInTheDocument();
  });

  it('renders a Course Overview without private progress providers', async () => {
    window.history.replaceState({}, '', '/courses/python');
    render(<PublicBrowseApplication />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Shared Course Overview' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Start Course/ })).toBeVisible();
  });

  it('renders Practice metadata without anonymous learner statistics', async () => {
    window.history.replaceState({}, '', '/practice');
    render(<PublicBrowseApplication />);
    expect(await screen.findByText('Add two values')).toBeVisible();
    expect(screen.queryByText('Solved')).not.toBeInTheDocument();
    expect(screen.queryByText('Attempted')).not.toBeInTheDocument();
  });
});
