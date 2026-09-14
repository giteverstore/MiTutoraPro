import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutputPanel } from '../../src/components/OutputPanel.jsx';
import { PracticeTestPanel } from '../../src/practice/PracticeTestPanel.jsx';
import {
  COMPILER_DRAWER_SIZE,
  shouldCollapseCompilerDrawer,
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

  it('uses a bounded snap threshold without violating expanded limits', () => {
    expect(shouldCollapseCompilerDrawer(COMPILER_DRAWER_SIZE.snapThreshold - 1)).toBe(true);
    expect(shouldCollapseCompilerDrawer(COMPILER_DRAWER_SIZE.snapThreshold)).toBe(false);
    expect(COMPILER_DRAWER_SIZE.minExpanded).toBeGreaterThan(COMPILER_DRAWER_SIZE.snapThreshold);
    expect(COMPILER_DRAWER_SIZE.maxExpanded).toBeGreaterThan(COMPILER_DRAWER_SIZE.minExpanded);
  });

  it('shows only result tabs while collapsed and expands from a tab click', () => {
    const onExpand = vi.fn();
    render(<OutputPanel height={48} collapsed onExpand={onExpand} executionStatus="idle" />);
    expect(screen.getByRole('tab', { name: 'Output' })).toBeVisible();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check Output' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Expected' }));
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('shows Course runtime state, exit/time, and Check Output only while expanded', () => {
    render(<OutputPanel height={300} executionStatus="idle" canCheckOutput={false} />);
    expect(screen.getByRole('tabpanel')).toBeVisible();
    expect(screen.getByText('Ready')).toBeVisible();
    expect(screen.getByText('Exit')).toBeVisible();
    expect(screen.getByText('Time')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check Output' })).toBeVisible();
  });

  it('keeps Practice tabs accessible but conceals testcase content while collapsed', () => {
    const onExpand = vi.fn();
    render(<PracticeTestPanel height={48} collapsed onExpand={onExpand} tests={[]} executionStatus="idle" />);
    expect(screen.getByRole('tab', { name: 'Testcase' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Test Result' })).toBeVisible();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Test Result' }));
    expect(onExpand).toHaveBeenCalledOnce();
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
