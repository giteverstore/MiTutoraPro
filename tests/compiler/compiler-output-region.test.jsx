import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompilerOutputRegion } from '../../src/components/CompilerOutputRegion.jsx';

vi.mock('../../src/components/PreviewPanel.jsx', () => ({ PreviewPanel: () => <div data-testid="preview-output" /> }));
vi.mock('../../src/components/DatabaseResultPanel.jsx', () => ({ DatabaseResultPanel: () => <div data-testid="database-output" /> }));
vi.mock('../../src/components/EmulatorResultPanel.jsx', () => ({ EmulatorResultPanel: () => <div data-testid="emulator-output" /> }));
vi.mock('../../src/components/OutputPanel.jsx', () => ({ OutputPanel: () => <div data-testid="terminal-output" /> }));
vi.mock('../../src/components/ResizeHandle.jsx', () => ({
  ResizeHandle: ({ label, onKeyDown }) => <button type="button" aria-label={label} onKeyDown={onKeyDown}>Resize</button>,
}));

afterEach(cleanup);

const compiler = {
  language: 'python',
  resizeLabel: 'Resize compiler output',
  output: {},
  expectedOutput: 'Hello',
  stdin: 'Ada',
  complexity: { time: 'O(1)' },
};
const drawer = {
  renderedHeight: 240,
  collapsed: false,
  min: 48,
  max: 500,
  value: 240,
  expand: vi.fn(),
  toggle: vi.fn(),
  startDragging: vi.fn(),
  handleKeyDown: vi.fn(),
};
const execution = {
  preview: { srcDoc: '<h1>Hello</h1>' },
  database: { resultSets: [] },
  emulator: { registers: {} },
  result: 'Hello',
  error: '',
  isRunning: false,
  executionTimeMs: 3,
  executionStatus: 'success',
};

function renderRegion(overrides = {}) {
  return render(
    <CompilerOutputRegion
      compiler={compiler}
      drawer={drawer}
      execution={execution}
      verificationStatus="matched"
      publicTests={[]}
      contract={null}
      onCheckOutput={vi.fn()}
      {...overrides}
    />,
  );
}

describe('CompilerOutputRegion', () => {
  it.each([
    ['preview', 'preview-output'],
    ['database', 'database-output'],
    ['emulator', 'emulator-output'],
  ])('gives %s mode precedence over custom and terminal output', (executionMode, expectedTestId) => {
    const renderOutput = vi.fn(() => <div data-testid="custom-output" />);
    renderRegion({ compiler: { ...compiler, executionMode }, renderOutput });

    expect(screen.getByTestId(expectedTestId)).toBeInTheDocument();
    expect(screen.queryByTestId('custom-output')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-output')).not.toBeInTheDocument();
    expect(renderOutput).not.toHaveBeenCalled();
  });

  it('selects the custom renderer and passes the existing output contract', () => {
    const onCheckOutput = vi.fn();
    const renderOutput = vi.fn(() => <div data-testid="custom-output" />);
    renderRegion({ renderOutput, onCheckOutput });

    expect(screen.getByTestId('custom-output')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-output')).not.toBeInTheDocument();
    expect(renderOutput).toHaveBeenCalledWith({
      height: 240,
      collapsed: false,
      onExpand: drawer.expand,
      onToggleCollapsed: drawer.toggle,
      result: 'Hello',
      error: '',
      isRunning: false,
      executionTimeMs: 3,
      expectedOutput: 'Hello',
      inputs: 'Ada',
      executionStatus: 'success',
      verificationStatus: 'matched',
      language: 'python',
      complexity: { time: 'O(1)' },
      onCheckOutput,
      canCheckOutput: true,
    });
  });

  it('falls back to terminal output when a custom renderer returns null', () => {
    renderRegion({ renderOutput: vi.fn(() => null) });
    expect(screen.getByTestId('terminal-output')).toBeInTheDocument();
  });

  it('keeps collapsed resize keyboard behavior with the output region', () => {
    const expand = vi.fn();
    const handleKeyDown = vi.fn();
    renderRegion({ drawer: { ...drawer, collapsed: true, expand, handleKeyDown } });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize compiler output' }), { key: 'ArrowUp' });
    expect(expand).toHaveBeenCalledOnce();
    expect(handleKeyDown).toHaveBeenCalledOnce();
  });
});
