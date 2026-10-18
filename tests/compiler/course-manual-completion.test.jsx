import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({ completedLessons: [], completeLesson: vi.fn() }));
vi.mock('../../src/progress/LearningProgressContext', () => ({ useLearningProgress: () => progress, useOptionalLearningProgress: () => null }));
vi.mock('../../src/components/EditorPlaceholder.jsx', () => ({ EditorPlaceholder: ({ value }) => <textarea aria-label="Code editor" value={value} readOnly /> }));

import { CompilerProvider } from '../../src/compiler/CompilerProvider.jsx';
import { CompilerPanel } from '../../src/components/CompilerPanel.jsx';
import { LessonFooter } from '../../src/components/LessonFooter.jsx';

const compiler = {
  id: 'lesson-compiler', language: 'python', resizeLabel: 'Resize output', expectedOutput: 'expected',
  editor: { fileName: 'main.py', lines: [{ number: 1, text: 'print("actual")' }] }, output: {},
};

afterEach(cleanup);

describe('Course manual completion after execution failure', () => {
  it('keeps Complete Lesson available after a failed Run and never auto-completes on Run', async () => {
    progress.completedLessons = [];
    progress.completeLesson.mockReset().mockResolvedValue(undefined);
    const manager = {
      execute: vi.fn().mockResolvedValue({ status: 'error', output: '', errors: ['Runtime failed'] }),
      format: vi.fn(), reset: vi.fn(), validateOutput: vi.fn(), dispose: vi.fn(),
    };
    render(<CompilerProvider manager={manager}>
      <CompilerPanel compiler={compiler} activityType="lesson" />
      <LessonFooter lesson={{ id: 'lesson-1', blocks: [{ id: 'compiler-1', type: 'compiler' }] }} previousLesson={null} nextLesson={{ id: 'lesson-2' }} lessonCount={2} currentLessonIndex={0} />
    </CompilerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    await screen.findByText('Runtime failed');
    expect(progress.completeLesson).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Complete Lesson' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Complete Lesson' }));
    await waitFor(() => expect(progress.completeLesson).toHaveBeenCalledWith('lesson-1'));
  });
});
