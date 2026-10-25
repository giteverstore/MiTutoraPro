import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({ completedLessons: [], completeLesson: vi.fn(), quizScores: {}, recordQuizScore: vi.fn(), exerciseCompletion: {}, completeExercise: vi.fn() }));
const runtime = vi.hoisted(() => ({ confetti: vi.fn() }));
vi.mock('../../src/progress/LearningProgressContext', () => ({ useLearningProgress: () => progress }));
vi.mock('../../src/compiler/LearningCompilerContext', () => ({ useOptionalLearningCompiler: () => null }));
vi.mock('canvas-confetti', () => ({ default: runtime.confetti }));

import { CompletionCelebration } from '../../src/components/CompletionCelebration.jsx';
import { ExerciseBlock } from '../../src/components/blocks/ExerciseBlock.jsx';
import { QuizBlock } from '../../src/components/blocks/QuizBlock.jsx';
import { LessonFooter } from '../../src/components/LessonFooter.jsx';

const setReducedMotion = (matches) => { window.matchMedia = vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }); };

beforeEach(() => {
  setReducedMotion(false); runtime.confetti.mockReset(); progress.completedLessons = []; progress.quizScores = {}; progress.exerciseCompletion = {};
  progress.completeLesson.mockReset().mockResolvedValue(undefined); progress.recordQuizScore.mockReset(); progress.completeExercise.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('shared completion celebration', () => {
  it('keeps canvas-confetti behind a normal dynamic import without workers', () => {
    const playerSource = readFileSync(resolve(process.cwd(), 'src/components/CompletionCelebration.jsx'), 'utf8');
    expect(playerSource).toContain("import('canvas-confetti')");
    expect(playerSource).not.toMatch(/^import .*canvas-confetti/m);
    expect(playerSource).not.toMatch(/worker/i);
  });

  it('loads on demand, fires a multi-burst pattern, ignores overlap, and allows a later event', async () => {
    vi.useFakeTimers();
    const confetti = vi.fn();
    const loader = vi.fn().mockResolvedValue({ default: confetti });
    const { container, rerender } = render(<CompletionCelebration event={null} duration={1000} confettiLoader={loader} />);
    expect(loader).not.toHaveBeenCalled();
    rerender(<CompletionCelebration event={{ id: 1 }} duration={1000} confettiLoader={loader} />);
    await act(async () => {});
    expect(loader).toHaveBeenCalledOnce();
    expect(confetti).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.completion-celebration')).toHaveAttribute('aria-hidden', 'true');
    rerender(<CompletionCelebration event={{ id: 2 }} duration={1000} confettiLoader={loader} />);
    expect(loader).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(1000));
    expect(confetti).toHaveBeenCalledTimes(4);
    expect(container.querySelector('.completion-celebration')).not.toBeInTheDocument();
    rerender(<CompletionCelebration event={{ id: 3 }} duration={1000} confettiLoader={loader} />);
    await act(async () => {});
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not import or invoke canvas-confetti when reduced motion is requested', async () => {
    const loader = vi.fn().mockResolvedValue({ default: vi.fn() });
    setReducedMotion(true);
    render(<CompletionCelebration event={{ id: 1 }} confettiLoader={loader} />);
    await act(async () => {});
    expect(loader).not.toHaveBeenCalled();
    expect(runtime.confetti).not.toHaveBeenCalled();
  });

  it('does not celebrate ordinary lesson completion', async () => {
    render(<LessonFooter lesson={{ id: 'lesson-1' }} previousLesson={null} nextLesson={null} lessonCount={1} currentLessonIndex={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Lesson' }));
    await waitFor(() => expect(progress.completeLesson).toHaveBeenCalledWith('lesson-1'));
    expect(document.querySelector('.completion-celebration')).not.toBeInTheDocument();
  });

  it('celebrates only the first correct Quiz completion', async () => {
    const props = { blockId: 'quiz-1', question: 'Pick A', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionIds: ['a'] };
    const { unmount } = render(<QuizBlock {...props} />);
    fireEvent.click(screen.getByLabelText('A')); fireEvent.click(screen.getByRole('button', { name: /Check answer/ }));
    await waitFor(() => expect(document.querySelector('.completion-celebration')).toBeInTheDocument());
    unmount(); progress.quizScores = { 'quiz-1': { passed: true, percentage: 100, attempts: 1 } };
    render(<QuizBlock {...props} />);
    fireEvent.click(screen.getByLabelText('A')); fireEvent.click(screen.getByRole('button', { name: /Check answer/ }));
    expect(document.querySelector('.completion-celebration')).not.toBeInTheDocument();
  });

  it('does not celebrate an incorrect Quiz attempt', () => {
    render(<QuizBlock blockId="quiz-1" question="Pick A" options={[{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]} correctOptionIds={['a']} />);
    fireEvent.click(screen.getByLabelText('B')); fireEvent.click(screen.getByRole('button', { name: /Check answer/ }));
    expect(document.querySelector('.completion-celebration')).not.toBeInTheDocument();
  });

  it('celebrates only a newly completed Exercise', async () => {
    const { unmount } = render(<ExerciseBlock blockId="exercise-1" title="Exercise" />);
    fireEvent.click(screen.getByRole('button', { name: /Mark Complete/ }));
    await waitFor(() => expect(document.querySelector('.completion-celebration')).toBeInTheDocument());
    expect(progress.completeExercise).toHaveBeenCalledWith('exercise-1');
    unmount(); progress.exerciseCompletion = { 'exercise-1': { completed: true } };
    render(<ExerciseBlock blockId="exercise-1" title="Exercise" />);
    expect(screen.getByRole('button', { name: 'Completed' })).toBeDisabled();
    expect(document.querySelector('.completion-celebration')).not.toBeInTheDocument();
  });
});
