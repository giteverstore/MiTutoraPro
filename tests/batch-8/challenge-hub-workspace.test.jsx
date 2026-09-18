import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resource: { data: null, error: null, loading: false },
  activity: { completions: [], refresh: vi.fn() },
  complete: vi.fn(),
}));

vi.mock('../../src/content/hooks/useContentResource', () => ({ useContentResource: () => state.resource }));
vi.mock('../../src/activity/LearnerActivityContext', () => ({ useLearnerActivity: () => state.activity }));
vi.mock('../../src/home/challengeCalendar', () => ({ kolkataDate: () => '2026-09-13' }));
vi.mock('../../src/coins/ActivityCompletionClient', () => ({ activityCompletionClient: { complete: state.complete } }));
vi.mock('../../src/theme/useApplicationTheme', () => ({ useApplicationTheme: () => ({ theme: 'light' }) }));
vi.mock('../../src/hooks/useCompilerPaneResize', () => ({ useCompilerPaneResize: () => ({ workspaceRef: { current: null }, value: 640, max: 900, startDragging: vi.fn(), handleKeyDown: vi.fn() }) }));
vi.mock('../../src/compiler/useSelectableCompilerLanguage', () => ({ useSelectableCompilerLanguage: (definitions) => ({ activeDefinition: definitions[0], language: 'python', options: [{ value: 'python', label: 'Python' }], switching: false, selectLanguage: vi.fn(), panelRef: { current: null } }) }));
vi.mock('../../src/components/CompilerPanel', () => ({ CompilerPanel: ({ onVerificationChange }) => <div data-testid="challenge-compiler"><button type="button" onClick={() => onVerificationChange('matched')}>Verify output</button></div> }));
vi.mock('../../src/components/ResizeHandle', () => ({ ResizeHandle: () => <div data-testid="resize-handle" /> }));

import { buildChallengeHistory, ChallengeHub, ChallengeWorkspace } from '../../src/challenges/ChallengesPage';

const content = (date, title) => ({
  schemaVersion: '1.0.0', id: `challenge-${date}`, date, title,
  summary: `${title} summary`, motivation: 'Practice daily.', language: 'Python', difficulty: 'medium',
  topic: 'Strings', estimatedMinutes: 15, reward: { coins: 20, streakIncrement: 1 }, version: 'v1',
  hints: ['Inspect each character.'],
  blocks: [
    { id: 'description', type: 'paragraph', content: 'Solve this focused challenge.', format: 'markdown' },
    { id: 'example', type: 'code', language: 'text', code: 'Input\nabc\n\nOutput\n3', caption: 'A small example.' },
    { id: 'constraints', type: 'note', title: 'Constraints', content: 'Input is non-empty.', format: 'plain' },
    { id: 'compiler', type: 'compiler', language: 'python', starterCode: 'print(3)', stdin: 'abc', expectedOutput: '3', validator: 'normalized' },
  ],
});
const entry = (date, title) => ({ metadata: { id: `challenge-${date}`, date, difficulty: 'easy', rewardCoins: 20, version: 'v1' }, content: content(date, title) });

afterEach(cleanup);
beforeEach(() => {
  state.activity.completions = [];
  state.activity.refresh.mockReset();
  state.activity.refresh.mockResolvedValue(undefined);
  state.resource = { data: null, error: null, loading: false };
  state.complete.mockReset();
});

describe('Daily Challenge Hub', () => {
  it('renders the real today card and history without the monolithic workspace', () => {
    state.resource = { data: [entry('2026-09-13', 'Balanced Brackets'), entry('2026-09-12', 'Count Vowels'), entry('2026-09-11', 'Rotate a List'), entry('2026-09-14', 'Future Challenge')], error: null, loading: false };
    state.activity.completions = [{ activityType: 'DAILY_CHALLENGE', occurrenceDate: '2026-09-12', completionStatus: 'COMPLETED' }];
    const open = vi.fn();
    render(<ChallengeHub onOpenChallenge={open} />);

    expect(screen.getByRole('heading', { name: 'Balanced Brackets' })).toBeInTheDocument();
    expect(screen.getByText('+20 coins')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toHaveClass('difficulty-badge', 'difficulty-badge--medium');
    fireEvent.click(screen.getByRole('button', { name: /Start Today.s Challenge/ }));
    expect(open).toHaveBeenCalledWith('2026-09-13');
    expect(screen.getByText('Count Vowels')).toBeInTheDocument();
    expect(screen.getByText('Rotate a List')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.queryByText('Future Challenge')).not.toBeInTheDocument();
    expect(screen.queryByText(/Current Streak/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Challenge compiler')).not.toBeInTheDocument();
    expect(screen.queryByText('Problem Statement')).not.toBeInTheDocument();
  });

  it('renders canonical completed state and review navigation without a Start action', () => {
    state.resource = { data: [entry('2026-09-13', 'Balanced Brackets')], error: null, loading: false };
    state.activity.completions = [{ activityType: 'DAILY_CHALLENGE', occurrenceDate: '2026-09-13', completionStatus: 'COMPLETED' }];
    const open = vi.fn();
    render(<ChallengeHub onOpenChallenge={open} />);
    expect(screen.getByText(/Today.s challenge completed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Today.s Challenge/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review Challenge' }));
    expect(open).toHaveBeenCalledWith('2026-09-13');
  });

  it('derives completed and missed history only from published past occurrences', () => {
    const catalog = [entry('2026-09-12', 'Completed'), entry('2026-09-11', 'Missed'), entry('2026-09-14', 'Future')];
    expect(buildChallengeHistory(catalog, [{ activityType: 'DAILY_CHALLENGE', occurrenceDate: '2026-09-12', completionStatus: 'COMPLETED' }], '2026-09-13'))
      .toEqual([expect.objectContaining({ date: '2026-09-12', completed: true }), expect.objectContaining({ date: '2026-09-11', completed: false })]);
  });
});

describe('dated Daily Challenge workspace', () => {
  it('reuses immersive problem, hints, compiler and shared drawer surfaces', () => {
    state.resource = { data: content('2026-09-13', 'Balanced Brackets'), error: null, loading: false };
    const back = vi.fn();
    render(<ChallengeWorkspace occurrenceDate="2026-09-13" onBack={back} />);
    expect(screen.getByText('Solve this focused challenge.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Example' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Constraints' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hints' })).toBeInTheDocument();
    expect(screen.getByTestId('challenge-compiler')).toBeInTheDocument();
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Challenges' }));
    expect(back).toHaveBeenCalledOnce();
  });

  it('completes today once through the canonical activity client after verification', async () => {
    state.resource = { data: content('2026-09-13', 'Balanced Brackets'), error: null, loading: false };
    state.complete.mockResolvedValue({ completionStatus: 'completed', rewardStatus: 'credited', rewardAmount: 20, streak: { currentStreak: 4 } });
    render(<ChallengeWorkspace occurrenceDate="2026-09-13" onBack={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify output' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Completion' }));
    await waitFor(() => expect(state.complete).toHaveBeenCalledOnce());
    expect(state.activity.refresh).toHaveBeenCalledOnce();
    expect(state.complete).toHaveBeenCalledWith({ activityType: 'DAILY_CHALLENGE', activityId: 'challenge-2026-09-13', activityVersion: 'v1' });
    const completedButton = await screen.findByRole('button', { name: 'Completed' });
    const dialog = screen.getByRole('dialog', { name: 'Daily Challenge Completed!' });
    expect(dialog).toHaveTextContent('Balanced Brackets');
    expect(dialog).toHaveTextContent('+20');
    expect(dialog).toHaveTextContent('4 day streak');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(completedButton).toBeDisabled();
    fireEvent.click(completedButton);
    expect(state.complete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes and returns to Challenges from a first-completion popup', async () => {
    state.resource = { data: content('2026-09-13', 'Balanced Brackets'), error: null, loading: false };
    state.complete.mockResolvedValue({ completionStatus: 'completed', rewardStatus: 'credited', rewardAmount: 20, streak: { currentStreak: 2 } });
    const back = vi.fn();
    render(<ChallengeWorkspace occurrenceDate="2026-09-13" onBack={back} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify output' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Completion' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to Challenges' }));
    expect(back).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the completion popup with Escape without navigating away', async () => {
    state.resource = { data: content('2026-09-13', 'Balanced Brackets'), error: null, loading: false };
    state.complete.mockResolvedValue({ completionStatus: 'completed', rewardStatus: 'credited', rewardAmount: 20, streak: { currentStreak: 2 } });
    const back = vi.fn();
    render(<ChallengeWorkspace occurrenceDate="2026-09-13" onBack={back} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify output' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Completion' }));
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(back).not.toHaveBeenCalled();
  });

  it('does not celebrate duplicate or failed canonical completion attempts', async () => {
    state.resource = { data: content('2026-09-13', 'Balanced Brackets'), error: null, loading: false };
    state.complete.mockResolvedValueOnce({ completionStatus: 'already_completed', rewardStatus: 'already_credited', rewardAmount: 0, streak: { currentStreak: 3 } });
    const { unmount } = render(<ChallengeWorkspace occurrenceDate="2026-09-13" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify output' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Completion' }));
    await waitFor(() => expect(state.complete).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    state.complete.mockReset();
    state.complete.mockRejectedValue(new Error('Completion could not be saved.'));
    render(<ChallengeWorkspace occurrenceDate="2026-09-13" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify output' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Completion' }));
    expect(await screen.findByText('Completion could not be saved.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps historical content in review mode and cannot issue completion', () => {
    state.resource = { data: content('2026-09-12', 'Count Vowels'), error: null, loading: false };
    render(<ChallengeWorkspace occurrenceDate="2026-09-12" onBack={vi.fn()} />);
    expect(screen.getByText('Review mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review only' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Verify output' }));
    expect(state.complete).not.toHaveBeenCalled();
  });

  it('fails safely when a dated challenge is invalid or unpublished', () => {
    state.resource = { data: null, error: new Error('internal detail'), loading: false };
    render(<ChallengeWorkspace occurrenceDate="2026-09-10" onBack={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('This daily challenge is unavailable.');
    expect(screen.queryByText('internal detail')).not.toBeInTheDocument();
  });
});
