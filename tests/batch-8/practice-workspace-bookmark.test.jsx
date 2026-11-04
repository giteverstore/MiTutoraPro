import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkProvider } from '../../src/bookmarks/BookmarkContext';
import { createPracticeBookmark } from '../../src/bookmarks/bookmarkModel';
import { PracticeDetail } from '../../src/practice/PracticeDetail';

vi.mock('../../src/components/CompilerPanel', () => ({
  CompilerPanel: ({ languageSelector }) => <div data-testid="compiler">{languageSelector}</div>,
}));
vi.mock('../../src/theme/useApplicationTheme', () => ({ useApplicationTheme: () => ({ theme: 'light', brandTheme: 'blue' }) }));

const question = {
  id: 'practice-canonical-7', title: 'Canonical Practice', summary: 'Solve the canonical question.',
  language: 'Python', topic: 'arrays', difficulty: 'easy', version: 'v1', examples: [], constraints: [], hints: [],
  blocks: [{ id: 'compiler', type: 'compiler', language: 'Python', starterCode: 'print(7)', expectedOutput: '7' }],
};

const renderWorkspace = (repository, props = {}) => render(
  <BookmarkProvider userId="learner-1" repository={repository}>
    <PracticeDetail question={question} solved={false} onBack={vi.fn()} onComplete={vi.fn()} allowBookmark {...props} />
  </BookmarkProvider>,
);

beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const values = new Map();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } });
});
afterEach(cleanup);

describe('Practice workspace bookmark and compiler controls', () => {
  it('uses the canonical Practice bookmark identity and toggles without duplicates', async () => {
    let saved = [];
    const repository = {
      load: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (_userId, bookmarks) => { saved = bookmarks; }),
    };
    renderWorkspace(repository);
    const button = await screen.findByRole('button', { name: 'Save Canonical Practice to Library' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(repository.save).toHaveBeenCalled());
    expect(saved).toEqual([expect.objectContaining({
      id: 'practice:practice-canonical-7', contentId: 'practice-canonical-7', type: 'practice',
      target: { page: 'practice', questionId: 'practice-canonical-7' },
    })]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Canonical Practice from Library' }));
    await waitFor(() => expect(saved).toEqual([]));
  });

  it('restores the persisted state on a direct remount and exposes one control', async () => {
    const bookmark = createPracticeBookmark(question);
    const repository = { load: vi.fn().mockResolvedValue([bookmark]), save: vi.fn().mockResolvedValue(undefined) };
    const first = renderWorkspace(repository);
    expect(await screen.findByRole('button', { name: 'Remove Canonical Practice from Library' })).toHaveAttribute('aria-pressed', 'true');
    expect(first.container.querySelectorAll('.practice-workspace-bookmark')).toHaveLength(1);
    first.unmount();
    renderWorkspace(repository);
    expect(await screen.findByRole('button', { name: 'Remove Canonical Practice from Library' })).toBeInTheDocument();
  });

  it('keeps anonymous Practice free of a persistence control', () => {
    const repository = { load: vi.fn().mockResolvedValue([]), save: vi.fn() };
    renderWorkspace(repository, { allowBookmark: false, requireAuthentication: true });
    expect(screen.queryByRole('button', { name: /Canonical Practice.*Library/ })).not.toBeInTheDocument();
  });

  it('uses the shared light and dark compiler selector contract', () => {
    const css = readFileSync('src/styles/pages/learning-engine/compiler-controls.css', 'utf8');
    expect(css).toMatch(/\.compiler-language-trigger\s*\{[^}]*color:\s*var\(--color-text\);[^}]*background:\s*var\(--color-surface\);[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\[data-theme='dark'\] \.compiler-language-trigger\s*\{[^}]*background:\s*var\(--color-surface-interactive\);[^}]*border-color:\s*var\(--color-border\);/s);
    expect(css).toMatch(/\.compiler-language-trigger:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus-ring\);/s);
  });
});
