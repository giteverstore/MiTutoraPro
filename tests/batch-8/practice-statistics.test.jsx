import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PracticeStatistics } from '../../src/practice/PracticeStatistics';

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
    expect(view.getByLabelText('Easy — 2 questions')).toHaveTextContent('2');
    expect(view.getByLabelText('Medium — 1 question')).toHaveAttribute('data-tooltip', 'Medium');
    expect(view.getByLabelText('Hard — 1 question')).toHaveTextContent('1');
    expect(view.queryByText(/Very Easy/i)).not.toBeInTheDocument();
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
