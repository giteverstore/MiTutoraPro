import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearningProgressProvider, useLearningProgress } from '../../src/progress/LearningProgressContext.jsx';

const course = {
  id: 'manual-course',
  modules: [{ id: 'module-one', lessons: [
    { id: 'lesson-1', blocks: [] },
    { id: 'lesson-2', blocks: [{ id: 'exercise-2', type: 'exercise' }] },
    { id: 'lesson-3', blocks: [] },
  ] }],
};

function Controls() {
  const progress = useLearningProgress();
  return <div>
    <span data-testid="status">{progress.status}</span>
    <span data-testid="completed">{progress.completedLessons.join(',')}</span>
    <span data-testid="sequential">{progress.sequentialCompletedLessons}</span>
    <button type="button" onClick={() => progress.markLessonVisited('lesson-3')}>Visit lesson 3</button>
    <button type="button" onClick={() => progress.completeLesson('lesson-3')}>Complete lesson 3</button>
    <button type="button" onClick={() => progress.completeLesson('lesson-1')}>Complete lesson 1</button>
  </div>;
}

afterEach(cleanup);

describe('manual Course lesson progress', () => {
  it('does not complete on visit, retains ordered accounting, and reads historical verification metadata', async () => {
    const repository = {
      load: vi.fn().mockResolvedValue({ completedLessons: [], exerciseCompletion: { 'exercise-2': { verified: true, verifiedAt: '2026-01-01T00:00:00Z' } } }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    render(<LearningProgressProvider course={course} userId="learner" repository={repository}><Controls /></LearningProgressProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Visit lesson 3' }));
    expect(screen.getByTestId('completed')).toBeEmptyDOMElement();
    expect(screen.getByTestId('sequential')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: 'Complete lesson 3' }));
    await waitFor(() => expect(screen.getByTestId('completed')).toHaveTextContent('lesson-3'));
    expect(screen.getByTestId('sequential')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: 'Complete lesson 1' }));
    await waitFor(() => expect(screen.getByTestId('sequential')).toHaveTextContent('1'));
    expect(repository.save).toHaveBeenCalled();
  });

  it('does not show a local lesson as complete when persistence fails', async () => {
    const repository = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockRejectedValue(new Error('Storage unavailable')) };
    let progress;
    function Capture() { progress = useLearningProgress(); return <span data-testid="count">{progress.completedLessonCount}</span>; }
    render(<LearningProgressProvider course={course} userId="learner" repository={repository}><Capture /></LearningProgressProvider>);
    await waitFor(() => expect(progress.status).toBe('ready'));
    await act(async () => { await expect(progress.completeLesson('lesson-1')).rejects.toThrow('Storage unavailable'); });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('records a published lesson through the trusted service without quiz or compiler evidence', async () => {
    const repository = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(undefined) };
    const trustedCompletionService = { recordLessonCompletion: vi.fn().mockResolvedValue({ eligibilityStatus: 'LOCKED' }) };
    let progress;
    function Capture() { progress = useLearningProgress(); return <span data-testid="count">{progress.completedLessonCount}</span>; }
    render(<LearningProgressProvider course={{ ...course, publishedVersion: 'v1' }} userId="learner" repository={repository} trustedCompletionService={trustedCompletionService}><Capture /></LearningProgressProvider>);
    await waitFor(() => expect(progress.status).toBe('ready'));
    await act(async () => { await progress.completeLesson('lesson-2'); });
    expect(trustedCompletionService.recordLessonCompletion).toHaveBeenCalledWith('manual-course', 'v1', 'lesson-2');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('keeps published progress unchanged when trusted recording fails', async () => {
    const repository = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(undefined) };
    const trustedCompletionService = { recordLessonCompletion: vi.fn().mockRejectedValue(new Error('Service unavailable')) };
    let progress;
    function Capture() { progress = useLearningProgress(); return <span data-testid="count">{progress.completedLessonCount}</span>; }
    render(<LearningProgressProvider course={{ ...course, publishedVersion: 'v1' }} userId="learner" repository={repository} trustedCompletionService={trustedCompletionService}><Capture /></LearningProgressProvider>);
    await waitFor(() => expect(progress.status).toBe('ready'));
    await act(async () => { await expect(progress.completeLesson('lesson-1')).rejects.toThrow('Service unavailable'); });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
