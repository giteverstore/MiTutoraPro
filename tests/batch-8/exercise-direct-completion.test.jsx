import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const expand = vi.hoisted(() => vi.fn());
vi.mock('../../src/compiler/LearningCompilerContext', () => ({ useOptionalLearningCompiler: () => ({ expand }) }));

import { ExerciseBlock } from '../../src/components/blocks/ExerciseBlock.jsx';

afterEach(() => { cleanup(); expand.mockReset(); });

describe('Course exercise navigation flow', () => {
  it('removes manual completion and keeps the compiler action functional', () => {
    render(<ExerciseBlock blockId="exercise-1" title="Try the code" description="Write a solution." actionLabel="Start exercise" />);
    expect(screen.queryByRole('button', { name: /Mark Complete/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start exercise/ }));
    expect(expand).toHaveBeenCalledOnce();
  });
});
