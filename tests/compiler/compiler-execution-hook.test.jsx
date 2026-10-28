import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCompilerExecution } from '../../src/compiler/useCompilerExecution.js';

const definition = {
  id: 'python', language: 'python', stdin: '', expectedOutput: 'done', exerciseId: 'exercise-1',
  editor: { fileName: 'main.py' },
};

function setup(overrides = {}) {
  const compilerManager = {
    execute: vi.fn().mockResolvedValue({ status: 'success', output: 'done', errors: [], executionTimeMs: 4 }),
    format: vi.fn(), reset: vi.fn().mockResolvedValue(), validateOutput: vi.fn(() => true),
    ...overrides.compilerManager,
  };
  const activeCompilerRef = { current: definition };
  const currentCodeRef = { current: 'print("done")' };
  const props = {
    compilerManager,
    settings: { editor: { autoFormatOnRun: false } },
    instanceId: 'compiler-test',
    activeCompilerRef,
    currentCodeRef,
    onFormattedSource: vi.fn((source) => { currentCodeRef.current = source; }),
    expandOutput: vi.fn(),
    verifyExercise: vi.fn(),
    invalidateExerciseVerification: vi.fn(),
    onVerificationChange: vi.fn(),
    ...overrides.props,
  };
  return { compilerManager, props, ...renderHook(() => useCompilerExecution(props)) };
}

describe('useCompilerExecution', () => {
  it('cancels the previous execution before starting another', async () => {
    const signals = [];
    const execute = vi.fn(({ signal }) => {
      signals.push(signal);
      if (signals.length === 2) return Promise.resolve({ status: 'success', output: 'second', errors: [], executionTimeMs: 2 });
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true }));
    });
    const { result } = setup({ compilerManager: { execute } });
    let firstRun;
    await act(async () => {
      firstRun = result.current.run();
      await Promise.resolve();
      await result.current.run();
      await firstRun;
    });
    expect(signals[0].aborted).toBe(true);
    expect(result.current.result).toBe('second');
  });

  it('aborts an active execution on unmount', async () => {
    let signal;
    const execute = vi.fn((request) => {
      signal = request.signal;
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true }));
    });
    const { result, unmount } = setup({ compilerManager: { execute } });
    await act(async () => { result.current.run(); await Promise.resolve(); });
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('formats before execution and publishes complete compiler evidence', async () => {
    const formatted = 'print("formatted")';
    const compilerManager = {
      format: vi.fn().mockResolvedValue(formatted),
      execute: vi.fn().mockResolvedValue({
        status: 'success', output: 'done', stdout: 'done', stderr: '', errors: [], exitCode: 0,
        diagnostics: ['diagnostic'], warnings: ['warning'], compileTimeMs: 2, executionTimeMs: 5,
      }),
    };
    const { result, props } = setup({ compilerManager, props: { settings: { editor: { autoFormatOnRun: true } } } });
    await act(() => result.current.run());
    expect(props.onFormattedSource).toHaveBeenCalledWith(formatted);
    expect(compilerManager.execute).toHaveBeenCalledWith(expect.objectContaining({ source: formatted }));
    expect(result.current.compilerEvidence).toEqual(expect.objectContaining({
      source: formatted, language: 'python', status: 'success', stdout: 'done', stderr: '', exitCode: 0,
      diagnostics: ['diagnostic'], warnings: ['warning'], compileTimeMs: 2, executionTimeMs: 5,
    }));
    expect(result.current.compilerEvidence.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('preserves verification transitions and exercise evidence', async () => {
    const { result, props, compilerManager } = setup();
    await act(() => result.current.run());
    act(() => result.current.checkOutput());
    expect(compilerManager.validateOutput).toHaveBeenCalledWith(expect.objectContaining({ expectedOutput: 'done', programOutput: 'done' }));
    expect(result.current.verificationStatus).toBe('matched');
    expect(props.onVerificationChange).toHaveBeenLastCalledWith('matched');
    expect(props.verifyExercise).toHaveBeenCalledWith('exercise-1', expect.objectContaining({ sourceCode: 'print("done")' }));
  });

  it('propagates reset failure without clearing source or execution state', async () => {
    const resetError = new Error('reset failed');
    const { result } = setup({ compilerManager: { reset: vi.fn().mockRejectedValue(resetError) } });
    await act(() => result.current.run());
    const resetSource = vi.fn();
    await expect(result.current.reset(definition, resetSource)).rejects.toBe(resetError);
    expect(resetSource).not.toHaveBeenCalled();
    expect(result.current.result).toBe('done');
    expect(result.current.executionStatus).toBe('success');
  });
});
