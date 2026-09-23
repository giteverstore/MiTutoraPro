import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AITutorWorkspace } from '../../src/ai/AITutorWorkspace.jsx';
import { LearningWorkspaceToolbar } from '../../src/components/LearningWorkspaceToolbar.jsx';

afterEach(cleanup);

const course = { id: 'python-foundations', title: 'Python Foundations' };
const lesson = { id: 'variables-1', title: 'Variables' };
const compilerContext = {
  code: 'name = "Ada"\nprint(name)',
  language: 'python',
  fileName: 'main.py',
  compilerStatus: 'success',
};
const response = {
  schemaVersion: '1',
  policyVersion: 'ai-tutor-v1',
  operation: 'explain-selection',
  evidence: { basis: 'static', note: null },
  summary: 'The selected line stores a string in a variable.',
  sections: [],
  codeReferences: [],
  concepts: [],
  issues: [],
  nextStep: { kind: 'experiment', text: 'Change the value.' },
};

describe('Learning workspace controls', () => {
  it('switches between Course and AI and only exposes Compiler restore while minimized', () => {
    const onViewChange = vi.fn();
    const onRestoreCompiler = vi.fn();
    const { rerender } = render(
      <LearningWorkspaceToolbar activeView="course" onViewChange={onViewChange} compilerMinimized={false} onRestoreCompiler={onRestoreCompiler} />,
    );

    expect(screen.getByRole('tab', { name: 'Course' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /compiler/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'AI Tutor' }));
    expect(onViewChange).toHaveBeenCalledWith('ai');

    rerender(<LearningWorkspaceToolbar activeView="ai" onViewChange={onViewChange} compilerMinimized onRestoreCompiler={onRestoreCompiler} />);
    fireEvent.click(screen.getByRole('button', { name: /compiler/i }));
    expect(onRestoreCompiler).toHaveBeenCalledOnce();
  });

  it('keeps the Monaco selection action available through an overlay and context menu', () => {
    const source = readFileSync('src/components/MonacoCodeEditor.jsx', 'utf8');
    expect(source).toContain("widgetNode.textContent = '✨ Ask AI Tutor'");
    expect(source).toContain('instance.addContentWidget(widget)');
    expect(source).toContain("label: 'Ask AI Tutor about Selection'");
    expect(source).toContain("precondition: 'editorHasSelection'");
    expect(source).toContain('startOffset: model.getOffsetAt');
    expect(source).toContain('surroundingCode: model.getValueInRange');
    expect(source).toContain('if (askSelectionRef.current)');
    expect(source).toContain('const actionDisposable = askSelectionRef.current ? instance.addAction');
  });

  it('routes Course through the shared compiler dock with AI explicitly enabled', () => {
    const source = readFileSync('src/components/Layout.jsx', 'utf8');
    expect(source).toContain('<SharedCompilerDock');
    expect(source).toContain('aiEnabled: true');
  });

  it('owns the default Course state, 60px collapsed rail, and AI handoff in Layout', () => {
    const source = readFileSync('src/components/Layout.jsx', 'utf8');
    expect(source).toContain("useState('course')");
    expect(source).toContain('isSidebarCollapsed ? 60 : sidebarResize.value');
    expect(source).toContain("setActiveWorkspace('ai')");
    expect(source).toContain('compilerMinimized={isCompilerMinimized}');
  });
});

describe('Learning AI Tutor workspace', () => {
  it('keeps the Premium entitlement boundary', () => {
    const explain = vi.fn();
    render(<AITutorWorkspace course={course} lesson={lesson} compilerContext={compilerContext} client={{ explain }} accessTier="FREE" />);
    expect(screen.getByRole('heading', { name: 'Premium required' })).toBeVisible();
    expect(explain).not.toHaveBeenCalled();
  });

  it('auto-submits a selected-code request with compiler and lesson context', async () => {
    const explain = vi.fn().mockResolvedValue(response);
    const selectionContext = {
      text: 'name = "Ada"',
      snapshot: {
        text: 'name = "Ada"',
        startOffset: 0,
        endOffset: 12,
        startLine: 1,
        endLine: 1,
        surroundingLines: ['name = "Ada"', 'print(name)'],
        sourceHash: 'source-hash',
        selectionHash: 'selection-hash',
        language: 'python',
      },
    };
    render(
      <AITutorWorkspace
        course={course}
        lesson={lesson}
        compilerContext={compilerContext}
        pendingRequest={{ id: 'request-1', selectionContext }}
        client={{ explain }}
        accessTier="PREMIUM"
      />,
    );

    await screen.findByText(response.summary);
    expect(explain).toHaveBeenCalledWith(expect.objectContaining({
      requestType: 'explain-selection',
      code: compilerContext.code,
      selectedCode: selectionContext.text,
      selectionSnapshot: selectionContext.snapshot,
      language: 'python',
      activityType: 'lesson',
      lessonContext: expect.stringContaining('Lesson: variables-1'),
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText(selectionContext.text)).toBeVisible();
  });

  it('sends Enter as a bounded full-code follow-up and keeps Shift+Enter as a newline', async () => {
    const explain = vi.fn().mockResolvedValue({ ...response, operation: 'explain-full-code' });
    render(<AITutorWorkspace course={course} lesson={lesson} compilerContext={compilerContext} client={{ explain }} accessTier="PREMIUM" />);
    const composer = screen.getByRole('textbox', { name: 'Ask AI Tutor' });
    fireEvent.change(composer, { target: { value: 'Why is this variable useful?' } });
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });
    expect(explain).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(explain).toHaveBeenCalledOnce());
    expect(explain.mock.calls[0][0]).toEqual(expect.objectContaining({
      requestType: 'explain-full-code',
      selectedCode: '',
      lessonContext: expect.stringContaining('Learner question: Why is this variable useful?'),
    }));
  });

  it('preserves conversation history when lesson context changes', async () => {
    const explain = vi.fn().mockResolvedValue({ ...response, operation: 'explain-full-code' });
    const { rerender } = render(<AITutorWorkspace course={course} lesson={lesson} compilerContext={compilerContext} client={{ explain }} accessTier="PREMIUM" />);
    const composer = screen.getByRole('textbox', { name: 'Ask AI Tutor' });
    fireEvent.change(composer, { target: { value: 'Explain this program.' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await screen.findByText(response.summary);

    rerender(<AITutorWorkspace course={course} lesson={{ id: 'loops-1', title: 'Loops' }} compilerContext={compilerContext} client={{ explain }} accessTier="PREMIUM" />);
    expect(screen.getByText('Explain this program.')).toBeVisible();
    expect(screen.getByText(response.summary)).toBeVisible();
  });
});
