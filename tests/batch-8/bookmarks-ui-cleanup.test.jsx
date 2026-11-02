import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookmarkProvider } from '../../src/bookmarks/BookmarkContext';
import { LibraryPage } from '../../src/bookmarks/LibraryPage';

afterEach(cleanup);

const bookmarks = [
  { id: 'course-1', type: 'course', title: 'Python Basics', language: 'Python', topic: 'Basics', target: { page: 'course', courseId: 'python', lessonId: 'lesson-1' } },
  { id: 'practice-1', type: 'practice', title: 'Variables Practice', language: 'Python', topic: 'Variables' },
  { id: 'challenge-1', type: 'challenge', title: 'Daily Variables', language: 'Python', topic: 'Variables' },
];
function renderPage(items = bookmarks) {
  const repository = { load: vi.fn().mockResolvedValue(items), save: vi.fn().mockResolvedValue(undefined) };
  const onOpenBookmark = vi.fn();
  const view = render(<BookmarkProvider userId="test-user" repository={repository}><LibraryPage onOpenBookmark={onOpenBookmark} /></BookmarkProvider>);
  return { repository, onOpenBookmark, ...view };
}

describe('Bookmarks compact layout', () => {
  it('removes redundant copy and preserves live tab counts', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: 'All3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Courses1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Practice1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Challenges1' })).toBeInTheDocument();
    expect(screen.queryByText('Everything you saved, in one place.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Return to useful lessons/)).not.toBeInTheDocument();
    expect(screen.queryByText('Saved Items')).not.toBeInTheDocument();
    expect(screen.queryByText('3 saved')).not.toBeInTheDocument();
  });

  it('filters categories and opens the preserved saved card action', async () => {
    const { onOpenBookmark } = renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Practice1' }));
    expect(screen.getByText('Variables Practice')).toBeInTheDocument();
    expect(screen.queryByText('Python Basics')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenBookmark).toHaveBeenCalledWith(expect.objectContaining({ id: 'practice-1' }));
  });

  it('preserves unbookmark behavior and updates counts', async () => {
    const { repository } = renderPage([bookmarks[0]]);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Python Basics from Library' }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith('test-user', []));
    expect(screen.getByRole('tab', { name: 'All0' })).toBeInTheDocument();
    expect(screen.getByText('Your Library is ready')).toBeInTheDocument();
  });

  it('preserves the empty and filtered-empty states', async () => {
    renderPage([]);
    expect(await screen.findByText('Your Library is ready')).toBeInTheDocument();
    cleanup();
    renderPage([bookmarks[0]]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Challenges0' }));
    expect(screen.getByText('No saved items match')).toBeInTheDocument();
  });

  it('uses authoritative Course metadata for contextual icons and retains a safe fallback', async () => {
    const items = [
      bookmarks[0],
      { id: 'course-java', type: 'course', title: 'Java Basics', language: '', topic: 'Basics', target: { page: 'course', courseId: 'java', lessonId: 'java-lesson-1' } },
      { id: 'course-generic', type: 'course', title: 'General Basics', language: '', topic: 'Basics', target: { page: 'course', courseId: 'general', lessonId: 'lesson-1' } },
    ];
    const { container } = renderPage(items);
    await screen.findByText('Python Basics');
    const icons = [...container.querySelectorAll('.saved-item-icon img')];
    expect(icons.map((icon) => icon.getAttribute('src'))).toEqual([
      '/assets/languages/python.svg',
      '/assets/languages/java.svg',
    ]);
    expect(container.querySelector('.saved-item-icon:not(.has-context-icon) svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Python Basics from Library' })).toBeInTheDocument();
  });
});
