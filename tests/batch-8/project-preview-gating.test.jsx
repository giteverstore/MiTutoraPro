import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canAccessProjectPage, FREE_PROJECT_PREVIEW_PAGE_COUNT } from '../../src/access/accessPolicy';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { ProjectWorkspace, PROJECT_WORKSPACE_PAGES } from '../../src/projects/pages/ProjectWorkspace';

vi.mock('../../src/compiler/CompilerProvider', () => ({ useCompilerManager: () => ({}) }));
vi.mock('../../src/components/EditorPlaceholder', () => ({ EditorPlaceholder: ({ editor }) => <div aria-label={editor.ariaLabel}>Editor</div> }));

const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
});

const project = projectCatalog.getProjects()[0];
beforeEach(() => storage.clear());
afterEach(cleanup);

describe('project Premium preview boundary', () => {
  it('defines the existing workspace sections as three free pages followed by implementation', () => {
    expect(FREE_PROJECT_PREVIEW_PAGE_COUNT).toBe(3);
    expect(PROJECT_WORKSPACE_PAGES.map(({ id }) => id)).toEqual(['requirements', 'contract', 'example', 'implementation']);
    expect([0, 1, 2].every((pageIndex) => canAccessProjectPage({ tier: 'FREE', pageIndex }))).toBe(true);
    expect(canAccessProjectPage({ tier: 'FREE', pageIndex: 3 })).toBe(false);
    expect(canAccessProjectPage({ tier: 'PREMIUM', pageIndex: 3 })).toBe(true);
  });

  it('lets a Free learner traverse three pages and shows the in-context boundary on page four', () => {
    render(<ProjectWorkspace project={project} tier="FREE" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'Function contract' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'Example' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'Continue this project with Premium' })).toBeInTheDocument();
    expect(screen.queryByLabelText(`${project.title} implementation editor`)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Premium Plans' })).toBeInTheDocument();
  });

  it('protects a direct page-four request and resumes there after upgrade without losing progress', () => {
    const first = render(<ProjectWorkspace project={project} tier="FREE" initialPageIndex={3} onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Continue this project with Premium' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Implementation/ }));
    first.unmount();
    render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Continue this project with Premium' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(`${project.title} implementation editor`)).toBeInTheDocument();
  });
});
