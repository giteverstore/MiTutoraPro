import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const questions = Array.from({ length: 49 }, (_, index) => ({
  id: `question-${index + 1}`,
  title: `Question ${index + 1}`,
  summary: `Summary ${index + 1}`,
  language: 'Python',
  topic: index % 2 ? 'Loops' : 'Variables',
  category: 'Fundamentals',
  difficulty: index % 3 ? 'Easy' : 'Hard',
  estimatedMinutes: 5,
  xp: 10,
}));

const { listPage, loadQuestion, loadQuestionById } = vi.hoisted(() => ({
  listPage: vi.fn(),
  loadQuestion: vi.fn(() => new Promise(() => {})),
  loadQuestionById: vi.fn(() => new Promise(() => {})),
}));

vi.mock('../../src/practice/practiceContentSource', () => ({
  practiceContentSource: { listPage, loadQuestion, loadQuestionById },
}));

import { PracticePage } from '../../src/practice/PracticePage';
import { getVisiblePracticePages } from '../../src/practice/PracticePagination';

function pageFor({ cursor, filters }) {
  const search = String(filters?.search ?? '').toLowerCase();
  const matches = questions.filter((question) => (
    (!filters?.difficulty || filters.difficulty === 'all' || question.difficulty === filters.difficulty)
    && (!filters?.topic || filters.topic === 'all' || question.topic === filters.topic)
    && (!search || `${question.title} ${question.summary}`.toLowerCase().includes(search))
  ));
  const offset = Number(cursor?.offset ?? 0);
  const items = matches.slice(offset, offset + 24);
  const nextOffset = offset + items.length;
  return Promise.resolve({
    items,
    cursor: nextOffset < matches.length ? { offset: nextOffset } : null,
    hasMore: nextOffset < matches.length,
    facets: { difficulties: ['Easy', 'Hard'], topics: ['Loops', 'Variables'] },
  });
}

beforeEach(() => {
  listPage.mockReset();
  listPage.mockImplementation(pageFor);
  loadQuestion.mockClear();
  loadQuestionById.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn(() => ({ matches: false }));
});

afterEach(cleanup);

describe('Practice cursor pagination', () => {
  it('presents only established pages in a compact window', () => {
    expect(getVisiblePracticePages(1, 2)).toEqual([1, 2]);
    expect(getVisiblePracticePages(2, 3)).toEqual([1, 2, 3]);
    expect(getVisiblePracticePages(3, 4)).toEqual([2, 3, 4]);
  });

  it('navigates forward and backward without duplicate page content', async () => {
    render(<PracticePage />);
    expect((await screen.findByText('Question 1')).closest('button')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect((await screen.findByText('Question 25')).closest('button')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect((await screen.findByText('Question 49')).closest('button')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect((await screen.findByText('Question 25')).closest('button')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect((await screen.findByText('Question 1')).closest('button')).toBeVisible();
    expect(screen.queryByText('Question 25')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.practice-question-card')).toHaveLength(24);
  }, 30_000);

  it('resets to page one when filters or search change', async () => {
    render(<PracticePage />);
    await screen.findByText('Question 1');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Question 25');

    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'Hard' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page'));
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Question 49' } });
    expect((await screen.findByText('Question 49')).closest('button')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  }, 30_000);

  it('does not let a stale search response replace the current page', async () => {
    let resolveSlow;
    listPage.mockImplementation((options) => {
      if (options.filters.search === 'Question 2') return new Promise((resolve) => { resolveSlow = () => pageFor(options).then(resolve); });
      return pageFor(options);
    });
    render(<PracticePage />);
    await screen.findByText('Question 1');

    const search = screen.getByLabelText('Search');
    fireEvent.change(search, { target: { value: 'Question 2' } });
    await waitFor(() => expect(resolveSlow).toBeTypeOf('function'));
    fireEvent.change(search, { target: { value: 'Question 49' } });
    expect((await screen.findByText('Question 49')).closest('button')).toBeVisible();
    resolveSlow();
    await waitFor(() => expect(screen.getByText('Question 49')).toBeVisible());
    expect(screen.queryByText('Question 2')).not.toBeInTheDocument();
  }, 30_000);

  it('keeps question selection connected to the existing detail loader', async () => {
    const onQuestionChange = vi.fn();
    render(<PracticePage onQuestionChange={onQuestionChange} />);
    const catalog = await screen.findByRole('region', { name: '24 questions' });
    fireEvent.click(within(catalog).getByText('Question 1').closest('button'));
    expect(onQuestionChange).toHaveBeenCalledWith('question-1');
    expect(loadQuestion).toHaveBeenCalledWith(expect.objectContaining({ id: 'question-1' }));
  }, 30_000);
});
