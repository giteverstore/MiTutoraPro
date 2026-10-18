import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({ completedLessons: [], completeLesson: vi.fn() }));
vi.mock('../../src/progress/LearningProgressContext', () => ({ useLearningProgress: () => ({ ...progress, quizScores: {}, exerciseCompletion: {} }) }));

import { LessonFooter } from '../../src/components/LessonFooter.jsx';
import { CompletionCelebration } from '../../src/components/CompletionCelebration.jsx';

const lesson = { id: 'final-lesson', blocks: [] };

beforeEach(() => {
  progress.completedLessons = [];
  progress.completeLesson.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('shared completion acknowledgement', () => {
  it('celebrates only after trusted final Course lesson completion succeeds', async () => {
    render(<LessonFooter lesson={lesson} previousLesson={null} nextLesson={null} lessonCount={1} currentLessonIndex={0} />);
    expect(screen.queryByText('Course complete!')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete Lesson' }));
    await waitFor(() => expect(screen.getByText('Course complete!')).toBeVisible());
    expect(progress.completeLesson).toHaveBeenCalledWith('final-lesson');
  });

  it('uses the lighter acknowledgement for a non-final lesson completion', async () => {
    render(<LessonFooter lesson={lesson} previousLesson={null} nextLesson={{ id: 'next' }} lessonCount={2} currentLessonIndex={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Lesson' }));
    await waitFor(() => expect(screen.getByText('Lesson complete!')).toBeVisible());
    expect(screen.queryByText('Course complete!')).not.toBeInTheDocument();
  });

  it('does not celebrate a failed Course completion or an already completed lesson', async () => {
    progress.completeLesson.mockRejectedValueOnce(new Error('unavailable'));
    const { unmount } = render(<LessonFooter lesson={lesson} previousLesson={null} nextLesson={null} lessonCount={1} currentLessonIndex={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Lesson' }));
    await waitFor(() => expect(screen.getByText(/Lesson could not be completed/i)).toBeVisible());
    expect(screen.queryByText('Course complete!')).not.toBeInTheDocument();
    unmount();
    progress.completedLessons = ['final-lesson'];
    render(<LessonFooter lesson={lesson} previousLesson={null} nextLesson={null} lessonCount={1} currentLessonIndex={0} />);
    expect(screen.queryByText('Course complete!')).not.toBeInTheDocument();
  });

  it('is visual-only, short-lived, and has a reduced-motion static fallback', () => {
    const { container } = render(<CompletionCelebration event={{ message: 'Well done!' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Well done!');
    expect(container.querySelector('.completion-celebration')).not.toHaveAttribute('tabindex');
    expect(container.querySelector('.completion-celebration__art')).toHaveAttribute('aria-hidden', 'true');
    const css = readFileSync(resolve(process.cwd(), 'src/components/completion-celebration.css'), 'utf8');
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/animation:\s*none/);
  });

  it('dismisses its visual acknowledgement after the short duration without moving focus', () => {
    vi.useFakeTimers();
    const focus = document.createElement('button');
    document.body.append(focus);
    focus.focus();
    render(<CompletionCelebration event={{ variant: 'task', message: 'Task verified!' }} />);
    expect(screen.getByText('Task verified!')).toBeVisible();
    expect(document.activeElement).toBe(focus);
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.queryByText('Task verified!')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(focus);
    focus.remove();
    vi.useRealTimers();
  });
});
