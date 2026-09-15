import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { countPracticeDifficulties, PracticeStatistics } from '../../src/practice/PracticeStatistics';

const questions = [
  { id: 'easy-1', difficulty: 'easy' },
  { id: 'easy-2', difficulty: 'easy' },
  { id: 'medium-1', difficulty: 'medium' },
  { id: 'hard-1', difficulty: 'hard' },
];

describe('Practice statistics', () => {
  const valueFor = (container, label) => within(container).getByText(label, { selector: 'small' }).closest('article').querySelector('strong');

  it('shows zero authoritative learner activity for a new user', () => {
    const { container } = render(<PracticeStatistics completedQuestionIds={new Set()} questions={questions} />);
    expect(valueFor(container, 'Solved')).toHaveTextContent('0');
    expect(valueFor(container, 'Attempted')).toHaveTextContent('0');
    expect(valueFor(container, 'Success Rate')).toHaveTextContent('0%');
  });

  it('uses the global canonical catalog distribution and accessible difficulty names', () => {
    const { container } = render(<PracticeStatistics completedQuestionIds={new Set(['easy-1'])} questions={questions} />);
    const view = within(container);
    expect(view.getByLabelText('Easy — 2 questions')).toHaveTextContent('2Easy');
    expect(view.getByLabelText('Medium — 1 question')).toHaveTextContent('1Medium');
    expect(view.getByLabelText('Hard — 1 question')).toHaveTextContent('1Hard');
    expect(view.queryByText(/Very Easy/i)).not.toBeInTheDocument();
  });

  it('derives an arbitrary distribution whose counts equal the supplied catalog total', () => {
    const catalog = [
      { difficulty: 'easy' }, { difficulty: 'easy' }, { difficulty: 'easy' },
      { difficulty: 'medium' }, { difficulty: 'hard' },
    ];
    const counts = countPracticeDifficulties(catalog);
    expect(counts).toEqual({ easy: 3, medium: 1, hard: 1 });
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(catalog.length);
  });

  it('renders an empty resolved catalog honestly and rejects unknown difficulty values', () => {
    const { container } = render(<PracticeStatistics questions={[]} />);
    expect(within(container).getByLabelText('Easy — 0 questions')).toHaveTextContent('0Easy');
    expect(() => countPracticeDifficulties([{ difficulty: 'very_easy' }])).toThrow(/Unsupported Practice difficulty/);
  });

  it('uses a loading state instead of flashing resolved zero counts', () => {
    const { container } = render(<PracticeStatistics questions={[]} catalogStatus="loading" />);
    expect(within(container).getByLabelText('Easy — loading')).toHaveTextContent('—Easy');
  });

  it('does not present failed catalog reads as resolved zero counts', () => {
    const { container } = render(<PracticeStatistics questions={[]} catalogStatus="error" />);
    expect(within(container).getByLabelText('Easy — unavailable')).toHaveTextContent('—Easy');
  });

  it('updates difficulty counts when the supplied catalog changes', () => {
    const { container, rerender } = render(<PracticeStatistics questions={questions} />);
    expect(within(container).getByLabelText('Easy — 2 questions')).toHaveTextContent('2Easy');
    rerender(<PracticeStatistics questions={[...questions, { id: 'easy-3', difficulty: 'easy' }]} />);
    expect(within(container).getByLabelText('Easy — 3 questions')).toHaveTextContent('3Easy');
  });

  it('keeps the compact difficulty values in a wrapping responsive group', () => {
    const { container } = render(<PracticeStatistics completedQuestionIds={new Set()} questions={questions} />);
    const counts = container.querySelector('.practice-difficulty-counts');
    expect(counts).toBeInTheDocument();
    expect(within(counts).getAllByText(/Easy|Medium|Hard/)).toHaveLength(3);
  });

  it('counts deduplicated canonical completion identities', () => {
    const { container } = render(<PracticeStatistics completedQuestionIds={new Set(['easy-1', 'hard-1', 'easy-1'])} questions={questions} />);
    expect(valueFor(container, 'Solved')).toHaveTextContent('2');
    expect(valueFor(container, 'Attempted')).toHaveTextContent('2');
    expect(valueFor(container, 'Success Rate')).toHaveTextContent('100%');
  });

  it('reacts to refreshed canonical completion state without a reload', () => {
    const { container, rerender } = render(<PracticeStatistics completedQuestionIds={new Set()} questions={questions} />);
    expect(valueFor(container, 'Solved')).toHaveTextContent('0');
    rerender(<PracticeStatistics completedQuestionIds={new Set(['medium-1'])} questions={questions} />);
    expect(valueFor(container, 'Solved')).toHaveTextContent('1');
  });
});
