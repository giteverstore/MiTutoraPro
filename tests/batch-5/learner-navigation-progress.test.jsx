import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearningProgressProvider, useLearningProgress } from '../../src/progress/LearningProgressContext.jsx';

const course = { id: 'phase5-course', modules: [{ id: 'module-1', lessons: [{ id: 'lesson-1', blocks: [] }] }] };

function ProgressState() {
  const progress = useLearningProgress();
  return <span>{progress.status}:{progress.completedLessonCount}</span>;
}

afterEach(cleanup);

describe('Course progress handoff after version pinning', () => {
  it('uses a successfully loaded record without reading it a second time', async () => {
    const repository = { load: vi.fn(), save: vi.fn() };
    render(<LearningProgressProvider course={course} userId="learner" repository={repository}
      initialStoredProgress={{ completedLessons: ['lesson-1'] }}><ProgressState /></LearningProgressProvider>);
    await waitFor(() => expect(screen.getByText('ready:1')).toBeInTheDocument());
    expect(repository.load).not.toHaveBeenCalled();
  });

  it('treats a successful empty record as loaded, but retries when no handoff exists', async () => {
    const repository = { load: vi.fn().mockResolvedValue({ completedLessons: ['lesson-1'] }), save: vi.fn() };
    const { rerender } = render(<LearningProgressProvider course={course} userId="learner" repository={repository}
      initialStoredProgress={null}><ProgressState /></LearningProgressProvider>);
    await waitFor(() => expect(screen.getByText('ready:0')).toBeInTheDocument());
    expect(repository.load).not.toHaveBeenCalled();
    rerender(<LearningProgressProvider course={course} userId="learner" repository={repository}
      initialStoredProgress={undefined}><ProgressState /></LearningProgressProvider>);
    await waitFor(() => expect(screen.getByText('ready:1')).toBeInTheDocument());
    expect(repository.load).toHaveBeenCalledOnce();
  });
});
