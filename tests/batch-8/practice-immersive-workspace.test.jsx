import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/CompilerPanel', () => ({
  CompilerPanel: ({ compiler, activityType, onVerificationChange }) => <div data-testid="compiler" data-activity-type={activityType}><span>{compiler.editor.lines.map(({ text }) => text).join('\n')}</span><button type="button" onClick={() => onVerificationChange('matched')}>Check Output</button><span>Editor</span><span>AI Tutor</span></div>,
}));
vi.mock('../../src/theme/useApplicationTheme', () => ({ useApplicationTheme: () => ({ theme: 'light' }) }));

import { PracticeDetail } from '../../src/practice/PracticeDetail';

const question = {
  id: 'practice-one', title: 'Create a User Label', summary: 'Redundant summary.', language: 'Python',
  topic: 'variables-data-types-expressions', difficulty: 'easy', estimatedMinutes: 5, xp: 20,
  contract: {}, publicTests: [], examples: [{ input: 'name = "Mira"', output: 'Mira: 12', explanation: 'Both values appear.' }],
  constraints: ['name is not empty', 'age is non-negative'], hints: [],
  blocks: [{ id: 'statement', type: 'paragraph', content: 'Canonical statement.' }, { id: 'contract', type: 'note', title: 'Function Contract', content: 'Internal contract' }, { id: 'compiler', type: 'compiler', language: 'Python', starterCode: 'print("ready")', expectedOutput: 'ready' }],
};

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

describe('Practice immersive coding workspace', () => {
  it('uses the immersive content/compiler split without redundant question metadata', () => {
    const { container } = render(<PracticeDetail question={question} solved={false} onBack={() => {}} onComplete={vi.fn()} />);
    expect(container.querySelector('[data-immersive-coding-workspace="practice"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: question.title })).toBeInTheDocument();
    expect(screen.queryByText('Problem Statement')).not.toBeInTheDocument();
    expect(screen.getByText('Canonical statement.')).toBeInTheDocument();
    expect(screen.queryByText('Function Contract')).not.toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('name = "Mira"')).toBeInTheDocument();
    expect(screen.getByText('Mira: 12')).toBeInTheDocument();
    expect(screen.getByText('Constraints')).toBeInTheDocument();
    expect(screen.getByText('name is not empty')).toBeInTheDocument();
    expect(screen.getByText('Hints')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reveal' })).toHaveLength(1);
    expect(screen.queryByText('Hint content will be available soon.')).not.toBeInTheDocument();
    expect(screen.queryByText(question.summary)).not.toBeInTheDocument();
    expect(screen.queryByText(/variables-data-types-expressions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/20 XP/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Previous Problem|Next Problem|Problem 1 of/i)).not.toBeInTheDocument();
  });

  it('keeps Practice compiler semantics and completion callback intact', async () => {
    const onComplete = vi.fn().mockResolvedValue({ rewardStatus: 'credited', rewardAmount: 10 });
    render(<PracticeDetail question={question} solved={false} onBack={() => {}} onComplete={onComplete} />);
    expect(screen.getByTestId('compiler')).toHaveAttribute('data-activity-type', 'practice');
    expect(screen.getByText('print("ready")')).toBeInTheDocument();
    expect(screen.getByText('AI Tutor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check Output' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Completion/ }));
    expect(onComplete).toHaveBeenCalledWith(question);
  });

  it('provides Back to Practice and the shared keyboard-accessible divider', () => {
    const onBack = vi.fn();
    render(<PracticeDetail question={question} solved={false} onBack={onBack} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Practice' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole('separator', { name: 'Resize problem and compiler panes' })).toBeInTheDocument();
  });

  it('renders any number of hints concealed and reveals them independently', () => {
    render(<PracticeDetail question={{ ...question, hints: ['Consider the input values.', 'Build the returned label.'] }} solved={false} onBack={() => {}} onComplete={vi.fn()} />);
    expect(screen.getByText('Hints')).toBeInTheDocument();
    expect(screen.queryByText('Consider the input values.')).not.toBeInTheDocument();
    expect(screen.queryByText('Build the returned label.')).not.toBeInTheDocument();
    const revealButtons = screen.getAllByRole('button', { name: 'Reveal' });
    expect(revealButtons).toHaveLength(2);
    expect(revealButtons[0]).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(revealButtons[0]);
    expect(screen.getByText('Consider the input values.')).toBeInTheDocument();
    expect(screen.queryByText('Build the returned label.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reveals the single development placeholder through the real hint interaction', () => {
    render(<PracticeDetail question={question} solved={false} onBack={() => {}} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText('Hint content will be available soon.')).toBeInTheDocument();
  });

  it('supports one hint without changing the compiler starter code', () => {
    render(<PracticeDetail question={{ ...question, hints: ['One focused hint.'] }} solved={false} onBack={() => {}} onComplete={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Reveal' })).toHaveLength(1);
    expect(screen.getByText('print("ready")')).toBeInTheDocument();
  });

  it('preserves legacy block-backed examples and constraints without their old cards', () => {
    const legacyQuestion = {
      ...question, examples: undefined, constraints: undefined,
      blocks: [
        { id: 'statement', type: 'paragraph', content: 'Canonical statement.' },
        { id: 'example', type: 'code', language: 'text', code: 'Input\n8\n\nOutput\nEven', caption: 'An even input' },
        { id: 'constraints', type: 'note', title: 'Constraints', content: 'Input is an integer.' },
        question.blocks.at(-1),
      ],
    };
    const { container } = render(<PracticeDetail question={legacyQuestion} solved={false} onBack={() => {}} onComplete={vi.fn()} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Even')).toBeInTheDocument();
    expect(screen.getByText('Input is an integer.')).toBeInTheDocument();
    expect(container.querySelector('.practice-document .code-card')).not.toBeInTheDocument();
    expect(container.querySelector('.practice-document .note-card')).not.toBeInTheDocument();
  });
});
