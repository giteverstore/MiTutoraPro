import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/progress/LearningProgressContext', () => ({ useOptionalLearningProgress: () => null }));
vi.mock('../../src/components/EditorPlaceholder.jsx', () => ({ EditorPlaceholder: ({ value }) => <textarea aria-label="Code editor" value={value} readOnly /> }));

import { CompilerProvider } from '../../src/compiler/CompilerProvider';
import { CompilerPanel } from '../../src/components/CompilerPanel';

const compiler = {
  id: 'blind150-001-javascript', language: 'javascript', resizeLabel: 'Resize output',
  editor: { fileName: 'main.js', lines: [{ number: 1, text: 'function containsDuplicate(nums) { return true; }' }] }, output: {},
};

const execution = (allPassed) => ({
  status: allPassed ? 'success' : 'error', output: `${allPassed ? 3 : 2}/3 public tests passed`, errors: [], executionTimeMs: 3, allPassed,
  functionResults: [
    { id: 'T1', passed: allPassed, status: allPassed ? 'passed' : 'wrong_answer', actual: allPassed, expected: true },
    { id: 'T2', passed: true, status: 'passed', actual: false, expected: false },
    { id: 'T3', passed: true, status: 'passed', actual: false, expected: false },
  ],
});

afterEach(cleanup);

describe('Practice Mode B submit gate', () => {
  it('keeps Run diagnostic and completes exactly once only after a passing Submit', async () => {
    const strategy = { mode: 'function', execute: vi.fn().mockResolvedValue(execution(true)), validate: vi.fn(({ execution: result }) => result.allPassed) };
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const manager = { format: vi.fn(), reset: vi.fn(), dispose: vi.fn(), validateOutput: vi.fn() };
    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType="practice" executionStrategy={strategy} onSubmit={onSubmit} /></CompilerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    await waitFor(() => expect(strategy.execute).toHaveBeenCalledOnce());
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(strategy.execute).toHaveBeenCalledTimes(2);
  });

  it('does not complete when any public fixture fails', async () => {
    const strategy = { mode: 'function', execute: vi.fn().mockResolvedValue(execution(false)), validate: vi.fn(({ execution: result }) => result.allPassed) };
    const onSubmit = vi.fn();
    const manager = { format: vi.fn(), reset: vi.fn(), dispose: vi.fn(), validateOutput: vi.fn() };
    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType="practice" executionStrategy={strategy} onSubmit={onSubmit} /></CompilerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(strategy.execute).toHaveBeenCalledOnce());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
