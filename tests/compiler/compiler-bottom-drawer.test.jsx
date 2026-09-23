import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutputPanel } from '../../src/components/OutputPanel.jsx';
import {
  COMPILER_DRAWER_SIZE,
  useCompilerBottomDrawer,
} from '../../src/compiler/useCompilerBottomDrawer.js';

afterEach(cleanup);

describe('shared compiler bottom drawer', () => {
  it('starts collapsed and restores its bounded default height when opened', () => {
    const { result } = renderHook(() => useCompilerBottomDrawer({ collapsible: true }));
    expect(result.current.collapsed).toBe(true);
    expect(result.current.renderedHeight).toBe(COMPILER_DRAWER_SIZE.collapsed);
    act(() => result.current.expand());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.renderedHeight).toBe(COMPILER_DRAWER_SIZE.defaultExpanded);
  });

  it('gives Course the same collapsed default and remembered expanded height', () => {
    const { result } = renderHook(() => useCompilerBottomDrawer({ collapsible: true }));
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.expand());
    act(() => result.current.setValue(350));
    expect(result.current.renderedHeight).toBe(350);
  });

  it('uses continuous expanded bounds without a release snap threshold', () => {
    expect(COMPILER_DRAWER_SIZE.minExpanded).toBe(140);
    expect(COMPILER_DRAWER_SIZE.maxExpanded).toBeGreaterThan(COMPILER_DRAWER_SIZE.minExpanded);
    expect(COMPILER_DRAWER_SIZE.minimumEditor).toBeGreaterThan(0);
  });

  it('clamps the drawer against its compiler container while reserving editor space', () => {
    let resize;
    globalThis.ResizeObserver = class {
      constructor(callback) { resize = callback; }
      observe() { resize(); }
      disconnect() {}
    };
    const container = { getBoundingClientRect: () => ({ height: 500 }) };
    const { result } = renderHook(() => useCompilerBottomDrawer({ collapsible: true, containerRef: { current: container } }));
    expect(result.current.max).toBe(500 - COMPILER_DRAWER_SIZE.fixedChrome - COMPILER_DRAWER_SIZE.minimumEditor);
  });

  it('minimizes explicitly and restores the most recent expanded height', () => {
    const { result } = renderHook(() => useCompilerBottomDrawer({ collapsible: true }));
    act(() => result.current.expand());
    act(() => result.current.setValue(360));
    act(() => result.current.collapse());
    expect(result.current.renderedHeight).toBe(COMPILER_DRAWER_SIZE.collapsed);
    act(() => result.current.expand());
    expect(result.current.renderedHeight).toBe(360);
  });

  it('shows only result tabs while collapsed and expands from a tab click', () => {
    const onExpand = vi.fn();
    render(<OutputPanel height={48} collapsed onExpand={onExpand} onToggleCollapsed={onExpand} executionStatus="idle" />);
    expect(screen.getByRole('tab', { name: 'Output' })).toBeVisible();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check Output' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore output panel' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Expected' }));
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('shows status and unavailable complexity metadata without fabricating values from runtime duration', () => {
    render(<OutputPanel height={300} executionStatus="success" executionTimeMs={42} canCheckOutput={false} onToggleCollapsed={() => {}} />);
    expect(screen.getByRole('tabpanel')).toBeVisible();
    expect(screen.getByText('Completed')).toBeVisible();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Time complexity: unavailable')).toHaveTextContent('Time —');
    expect(screen.getByLabelText('Space complexity: unavailable')).toHaveTextContent('Space —');
    expect(screen.queryByText('42 ms')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Output' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Minimize output panel' })).toBeVisible();
  });

  it('renders authoritative supplied complexity values', () => {
    render(<OutputPanel
      height={300}
      executionStatus="success"
      complexity={{ time: 'O(n)', space: 'O(1)' }}
      canCheckOutput={false}
      onToggleCollapsed={() => {}}
    />);
    expect(screen.getByLabelText('Time complexity: O(n)')).toHaveTextContent('Time O(n)');
    expect(screen.getByLabelText('Space complexity: O(1)')).toHaveTextContent('Space O(1)');
  });

  it('supports the optional shared Tests tab and conceals content while collapsed', () => {
    const onExpand = vi.fn();
    const { rerender } = render(<OutputPanel height={48} collapsed onExpand={onExpand} onToggleCollapsed={() => {}} tests={[{ name: 'Public case', arguments: ['Ada'], expected: 'Hello Ada' }]} executionStatus="idle" />);
    expect(screen.getByRole('tab', { name: 'Tests' })).toBeVisible();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Tests' }));
    expect(onExpand).toHaveBeenCalledOnce();
    rerender(<OutputPanel height={300} onExpand={onExpand} onToggleCollapsed={() => {}} tests={[{ name: 'Public case', arguments: ['Ada'], expected: 'Hello Ada' }]} executionStatus="idle" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tests' }));
    expect(screen.getByText('Public case')).toBeVisible();
    expect(screen.getByText(/Hello Ada/)).toBeVisible();
  });

  it('dispatches a layout signal when the drawer opens or resizes', () => {
    const listener = vi.fn();
    window.addEventListener('resize', listener);
    const { result } = renderHook(() => useCompilerBottomDrawer({ collapsible: true }));
    act(() => result.current.expand());
    return new Promise((resolve) => window.requestAnimationFrame(() => {
      expect(listener).toHaveBeenCalled();
      window.removeEventListener('resize', listener);
      resolve();
    }));
  });
});
