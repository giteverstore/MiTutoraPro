import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({ completedLessons: [], completeLesson: vi.fn() }));
vi.mock('../../src/progress/LearningProgressContext', () => ({ useLearningProgress: () => progress }));

import { LessonFooter } from '../../src/components/LessonFooter.jsx';

beforeEach(() => { progress.completedLessons = []; progress.completeLesson.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

describe('explicit Course lesson completion', () => {
  it.each([
    ['reading', []],
    ['unanswered quiz', [{ id: 'quiz-1', type: 'quiz' }]],
    ['unrun exercise', [{ id: 'exercise-1', type: 'exercise' }, { id: 'compiler-1', type: 'compiler' }]],
  ])('offers Complete Lesson immediately for %s without completing on open', async (_, blocks) => {
    render(<LessonFooter lesson={{ id: 'lesson-1', blocks }} previousLesson={null} nextLesson={{ id: 'lesson-2' }} lessonCount={2} currentLessonIndex={0} />);
    const complete = screen.getByRole('button', { name: 'Complete Lesson' });
    expect(complete).toBeEnabled();
    expect(progress.completeLesson).not.toHaveBeenCalled();
    fireEvent.click(complete);
    await waitFor(() => expect(progress.completeLesson).toHaveBeenCalledWith('lesson-1'));
    expect(progress.completeLesson).toHaveBeenCalledOnce();
  });

  it('keeps Previous and Next behavior tied to completed state', () => {
    const onPrevious = vi.fn(); const onNext = vi.fn();
    const props = { lesson: { id: 'lesson-2', blocks: [] }, previousLesson: { id: 'lesson-1' }, nextLesson: { id: 'lesson-3' }, onPrevious, onNext, lessonCount: 3, currentLessonIndex: 1 };
    const { rerender } = render(<LessonFooter {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous Lesson' }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Next Lesson' })).not.toBeInTheDocument();
    progress.completedLessons = ['lesson-2'];
    rerender(<LessonFooter {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next Lesson' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
