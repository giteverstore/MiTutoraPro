import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({ exerciseCompletion: {}, completeExercise: vi.fn() }));
vi.mock('../../src/progress/LearningProgressContext', () => ({ useLearningProgress: () => progress }));
vi.mock('../../src/compiler/LearningCompilerContext', () => ({ useOptionalLearningCompiler: () => ({ expand: vi.fn() }) }));

import { ExerciseBlock } from '../../src/components/blocks/ExerciseBlock.jsx';

beforeEach(() => { progress.exerciseCompletion = {}; progress.completeExercise.mockReset(); });
afterEach(cleanup);

describe('Course exercise completion', () => {
  it('keeps compiler practice optional and allows explicit completion without output verification', () => {
    render(<ExerciseBlock blockId="exercise-1" title="Try the code" description="Write a solution." actionLabel="Open compiler" />);
    expect(screen.getByRole('button', { name: /Open compiler/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Mark Complete/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Mark Complete/ }));
    expect(progress.completeExercise).toHaveBeenCalledWith('exercise-1');
    expect(screen.queryByText(/Check output to continue/)).not.toBeInTheDocument();
  });

  it('loads historical verification fields without requiring them', () => {
    progress.exerciseCompletion = { 'exercise-1': { verified: false, verifiedAt: '2026-01-01T00:00:00Z' } };
    const { unmount } = render(<ExerciseBlock blockId="exercise-1" title="Try the code" description="Write a solution." />);
    expect(screen.getByRole('button', { name: /Mark Complete/ })).toBeEnabled();
    unmount();
    progress.exerciseCompletion = { 'exercise-1': { verified: true, completed: true } };
    render(<ExerciseBlock blockId="exercise-1" title="Try the code" description="Write a solution." />);
    expect(screen.getByRole('button', { name: 'Completed' })).toBeDisabled();
  });
});
