import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({ completedLessons: [], completeLesson: vi.fn(), quizScores: {}, recordQuizScore: vi.fn(), exerciseCompletion: {}, completeExercise: vi.fn() }));
const runtime = vi.hoisted(() => ({ mounts: 0 }));
vi.mock('../../src/progress/LearningProgressContext', () => ({ useLearningProgress: () => progress }));
vi.mock('../../src/compiler/LearningCompilerContext', () => ({ useOptionalLearningCompiler: () => null }));
vi.mock('../../src/components/CelebrationLottiePlayer.jsx', () => ({ default: ({ onComplete }) => { runtime.mounts += 1; return <button data-testid="celebration-player" type="button" onClick={onComplete}>finish</button>; } }));

import { CompletionCelebration } from '../../src/components/CompletionCelebration.jsx';
import { ExerciseBlock } from '../../src/components/blocks/ExerciseBlock.jsx';
import { QuizBlock } from '../../src/components/blocks/QuizBlock.jsx';
import { LessonFooter } from '../../src/components/LessonFooter.jsx';

const setReducedMotion = (matches) => { window.matchMedia = vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }); };

beforeEach(() => {
  setReducedMotion(false); runtime.mounts = 0; progress.completedLessons = []; progress.quizScores = {}; progress.exerciseCompletion = {};
  progress.completeLesson.mockReset().mockResolvedValue(undefined); progress.recordQuizScore.mockReset(); progress.completeExercise.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('shared completion celebration', () => {
  it('uses the reviewed asset as a one-shot non-worker player', () => {
    const playerSource = readFileSync(resolve(process.cwd(), 'src/components/CelebrationLottiePlayer.jsx'), 'utf8');
    expect(playerSource).toContain("const CELEBRATION_ASSET = '/assets/animations/celebration.lottie'");
    expect(playerSource).toContain('src={CELEBRATION_ASSET}');
    expect(playerSource).toContain('autoplay');
    expect(playerSource).toContain('loop={false}');
    expect(playerSource).toContain("addEventListener('complete'");
    expect(playerSource).not.toMatch(/worker/i);
  });

  it('mounts one lazy decorative player, ignores overlap, and cleans up on completion', async () => {
    const { container, rerender } = render(<CompletionCelebration event={{ id: 1 }} />);
    expect(await screen.findByTestId('celebration-player')).toBeInTheDocument();
    expect(container.querySelector('.completion-celebration')).toHaveAttribute('aria-hidden', 'true');
    rerender(<CompletionCelebration event={{ id: 2 }} />);
    expect(screen.getAllByTestId('celebration-player')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('celebration-player'));
    expect(screen.queryByTestId('celebration-player')).not.toBeInTheDocument();
  });

  it('uses a bounded cleanup fallback', async () => {
    vi.useFakeTimers();
    render(<CompletionCelebration event={{ id: 1 }} fallbackDuration={1000} />);
    await act(async () => {});
    expect(screen.getByTestId('celebration-player')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByTestId('celebration-player')).not.toBeInTheDocument();
  });

  it('does not load the player when reduced motion is requested', async () => {
    setReducedMotion(true);
    render(<CompletionCelebration event={{ id: 1 }} />);
    await act(async () => {});
    expect(screen.queryByTestId('celebration-player')).not.toBeInTheDocument();
    expect(runtime.mounts).toBe(0);
  });

  it('does not celebrate ordinary lesson completion', async () => {
    render(<LessonFooter lesson={{ id: 'lesson-1' }} previousLesson={null} nextLesson={null} lessonCount={1} currentLessonIndex={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Lesson' }));
    await waitFor(() => expect(progress.completeLesson).toHaveBeenCalledWith('lesson-1'));
    expect(screen.queryByTestId('celebration-player')).not.toBeInTheDocument();
  });

  it('celebrates only the first correct Quiz completion', async () => {
    const props = { blockId: 'quiz-1', question: 'Pick A', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionIds: ['a'] };
    const { unmount } = render(<QuizBlock {...props} />);
    fireEvent.click(screen.getByLabelText('A')); fireEvent.click(screen.getByRole('button', { name: /Check answer/ }));
    expect(await screen.findByTestId('celebration-player')).toBeInTheDocument();
    unmount(); progress.quizScores = { 'quiz-1': { passed: true, percentage: 100, attempts: 1 } };
    render(<QuizBlock {...props} />);
    fireEvent.click(screen.getByLabelText('A')); fireEvent.click(screen.getByRole('button', { name: /Check answer/ }));
    expect(screen.queryByTestId('celebration-player')).not.toBeInTheDocument();
  });

  it('does not celebrate an incorrect Quiz attempt', () => {
    render(<QuizBlock blockId="quiz-1" question="Pick A" options={[{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]} correctOptionIds={['a']} />);
    fireEvent.click(screen.getByLabelText('B')); fireEvent.click(screen.getByRole('button', { name: /Check answer/ }));
    expect(screen.queryByTestId('celebration-player')).not.toBeInTheDocument();
  });

  it('celebrates only a newly completed Exercise', async () => {
    const { unmount } = render(<ExerciseBlock blockId="exercise-1" title="Exercise" />);
    fireEvent.click(screen.getByRole('button', { name: /Mark Complete/ }));
    expect(await screen.findByTestId('celebration-player')).toBeInTheDocument();
    expect(progress.completeExercise).toHaveBeenCalledWith('exercise-1');
    unmount(); progress.exerciseCompletion = { 'exercise-1': { completed: true } };
    render(<ExerciseBlock blockId="exercise-1" title="Exercise" />);
    expect(screen.getByRole('button', { name: 'Completed' })).toBeDisabled();
    expect(screen.queryByTestId('celebration-player')).not.toBeInTheDocument();
  });
});
