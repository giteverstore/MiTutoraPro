import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LessonFooter } from '../../src/components/LessonFooter.jsx';
import { QuizBlock } from '../../src/components/blocks/QuizBlock.jsx';
import { ExerciseBlock } from '../../src/components/blocks/ExerciseBlock.jsx';

const progress = {
  quizScores: {},
  exerciseCompletion: {},
  recordQuizScore: vi.fn(),
};

vi.mock('../../src/progress/LearningProgressContext.jsx', () => ({
  useLearningProgress: () => progress,
}));

vi.mock('../../src/compiler/LearningCompilerContext.jsx', () => ({
  useOptionalLearningCompiler: () => ({ expand: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  progress.recordQuizScore.mockClear();
  progress.quizScores = {};
  progress.exerciseCompletion = {};
});

describe('Course learner interaction model', () => {
  it('keeps passive lesson navigation and exposes no completion action or state', () => {
    const onNext = vi.fn();
    render(<LessonFooter previousLesson={null} nextLesson={{ id: 'two' }} onPrevious={vi.fn()} onNext={onNext} lessonCount={3} currentLessonIndex={0} />);
    expect(screen.getByRole('button', { name: 'Previous Lesson' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next Lesson' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Complete Lesson|Lesson completed|Saving|Try Again/i)).not.toBeInTheDocument();
  });

  it('uses Check Answer as the quiz\'s only validation action', () => {
    render(<QuizBlock blockId="quiz-1" question="Two plus two?" options={[{ id: 'four', text: 'Four' }]} correctOptionIds={['four']} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Four' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
    expect(progress.recordQuizScore).toHaveBeenCalledWith('quiz-1', 1, 1, true, ['four']);
    expect(screen.queryByRole('button', { name: /Complete|Verify|Submit|Run/i })).not.toBeInTheDocument();
  });

  it('does not expose a second Verify or Complete action for an exercise', () => {
    progress.exerciseCompletion = { 'exercise-1': { verified: true, completed: true } };
    render(<ExerciseBlock blockId="exercise-1" title="Print hello" />);
    expect(screen.getByText(/Exercise passed/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Mark Complete|Verify|Check Output|Complete Lesson/i })).not.toBeInTheDocument();
  });
});
