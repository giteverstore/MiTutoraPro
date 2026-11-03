import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { readFileSync } from 'node:fs';

const progress = vi.hoisted(() => ({ completedLessons: [], completeLesson: vi.fn() }));
vi.mock('../../src/progress/LearningProgressContext', () => ({ useLearningProgress: () => progress }));

import { LessonFooter } from '../../src/components/LessonFooter.jsx';
import { QuizBlock } from '../../src/components/blocks/QuizBlock.jsx';
import { SolutionBlock } from '../../src/components/blocks/SolutionBlock.jsx';

beforeEach(() => { progress.completedLessons = []; progress.completeLesson.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

describe('explicit Course lesson completion', () => {
  it('keeps explicit completion for ordinary reading lessons', async () => {
    const blocks = [];
    render(<LessonFooter lesson={{ id: 'lesson-1', blocks }} previousLesson={null} nextLesson={{ id: 'lesson-2' }} lessonCount={2} currentLessonIndex={0} />);
    const complete = screen.getByRole('button', { name: 'Complete Lesson' });
    expect(complete).toBeEnabled();
    expect(progress.completeLesson).not.toHaveBeenCalled();
    fireEvent.click(complete);
    await waitFor(() => expect(progress.completeLesson).toHaveBeenCalledWith('lesson-1'));
    expect(progress.completeLesson).toHaveBeenCalledOnce();
  });

  it('uses validation-gated Next Lesson without a completion write', async () => {
    const onNext = vi.fn();
    const validationRef = createRef();
    validationRef.current = vi.fn().mockReturnValue(true);
    render(<LessonFooter lesson={{ id: 'quiz-lesson' }} previousLesson={{ id: 'previous' }} nextLesson={{ id: 'next' }} onPrevious={vi.fn()} onNext={onNext} lessonCount={3} currentLessonIndex={1} forwardMode="validated" onValidateForward={() => validationRef.current()} />);
    expect(screen.queryByRole('button', { name: 'Complete Lesson' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next Lesson' }));
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(progress.completeLesson).not.toHaveBeenCalled();
  });

  it('keeps quiz navigation blocked until the selected answer is correct', async () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const validationRef = createRef();
    render(<>
      <QuizBlock blockId="quiz-1" question="Pick A" options={[{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]} correctOptionIds={['a']} validationRef={validationRef} />
      <LessonFooter lesson={{ id: 'quiz-lesson' }} previousLesson={{ id: 'previous' }} nextLesson={{ id: 'next' }} onPrevious={onPrevious} onNext={onNext} lessonCount={3} currentLessonIndex={1} forwardMode="validated" onValidateForward={() => validationRef.current()} />
    </>);
    const next = screen.getByRole('button', { name: 'Next Lesson' });
    expect(screen.queryByRole('button', { name: /Check answer|Complete Lesson/ })).not.toBeInTheDocument();

    fireEvent.click(next);
    expect(await screen.findByText('Choose an answer before checking.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('B'));
    fireEvent.click(next);
    expect(await screen.findByText('Not quite. Review the lesson and try again.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('A'));
    fireEvent.click(next);
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(progress.completeLesson).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous Lesson' }));
    expect(onPrevious).toHaveBeenCalledOnce();
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

  it('keeps the solution disclosure native and aligns expanded content to one inset', () => {
    const { container } = render(<SolutionBlock title="View solution" description="Explain it." language="js" code="return true;" />);
    const details = container.querySelector('details');
    expect(details).toHaveClass('solution-block');
    expect(details?.querySelector('summary')).toHaveTextContent('View solution');
    expect(details?.querySelector('.solution-block-content')).toHaveTextContent('Explain it.');
    expect(details?.querySelector('.solution-block-content pre code')).toHaveTextContent('return true;');
    fireEvent.click(details.querySelector('summary'));
    expect(details).toHaveAttribute('open');
    const css = readFileSync('src/styles/pages/learning-engine/lesson-content.css', 'utf8');
    expect(css).toMatch(/\.solution-block>summary\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s);
    expect(css).toMatch(/\.solution-block-content\s*\{[^}]*padding:\s*0 var\(--space-4\) var\(--space-4\);/s);
  });
});
