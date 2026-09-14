import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PracticeProblemContent, resolvePracticeHints } from '../../src/practice/PracticeProblemContent';

const question = {
  blocks: [{ id: 'statement', type: 'paragraph', content: 'Solve the problem.' }],
  examples: [], constraints: [], hints: [],
};

afterEach(cleanup);

describe('Practice hint environment boundary', () => {
  it('omits zero-hint UI in the production-mode path', () => {
    render(<PracticeProblemContent question={question} developmentHints={[]} />);
    expect(screen.queryByText('Hints')).not.toBeInTheDocument();
    expect(screen.queryByText('Hint 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Hint content will be available soon.')).not.toBeInTheDocument();
  });

  it('lets real hints override the development placeholder', () => {
    expect(resolvePracticeHints(['Real hint'], ['Hint content will be available soon.'])).toEqual(['Real hint']);
    render(<PracticeProblemContent question={{ ...question, hints: ['Real hint'] }} />);
    expect(screen.getAllByRole('button', { name: 'Reveal' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText('Real hint')).toBeInTheDocument();
    expect(screen.queryByText('Hint content will be available soon.')).not.toBeInTheDocument();
  });

  it('keeps multiple real hints dynamic in the production-mode path', () => {
    render(<PracticeProblemContent question={{ ...question, hints: ['First real hint', 'Second real hint'] }} developmentHints={[]} />);
    expect(screen.getAllByRole('button', { name: 'Reveal' })).toHaveLength(2);
  });
});
