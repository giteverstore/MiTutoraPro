import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookmarkProvider } from '../../src/bookmarks/BookmarkContext';
import { LibraryPage } from '../../src/bookmarks/LibraryPage';

afterEach(cleanup);

const bookmarks = [
  { id: 'course-1', type: 'course', title: 'Python Basics', language: 'Python', topic: 'Basics' },
  { id: 'practice-1', type: 'practice', title: 'Variables Practice', language: 'Python', topic: 'Variables' },
  { id: 'challenge-1', type: 'challenge', title: 'Daily Variables', language: 'Python', topic: 'Variables' },
];
function renderPage(items = bookmarks) {
  const repository = { load: vi.fn().mockResolvedValue(items), save: vi.fn().mockResolvedValue(undefined) };
  const onOpenBookmark = vi.fn();
  render(<BookmarkProvider userId="test-user" repository={repository}><LibraryPage onOpenBookmark={onOpenBookmark} /></BookmarkProvider>);
  return { repository, onOpenBookmark };
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
});
