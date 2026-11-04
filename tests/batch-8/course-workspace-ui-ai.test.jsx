import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ContentArea } from '../../src/components/ContentArea';
import { OutputPanel } from '../../src/components/OutputPanel';

const workspaceCss = readFileSync(resolve('src/styles/pages/learning-engine/learning-workspace.css'), 'utf8');
const sidebarCss = readFileSync(resolve('src/styles/pages/learning-engine/shell-sidebar.css'), 'utf8');
const compilerCss = readFileSync(resolve('src/styles/pages/learning-engine/compiler-workspace.css'), 'utf8');
const sidebarSource = readFileSync(resolve('src/components/Sidebar.jsx'), 'utf8');

vi.mock('../../src/components/BlockRenderer', () => ({ BlockRenderer: () => <p>Select exact lesson text</p> }));
vi.mock('../../src/components/LessonHeader', () => ({ LessonHeader: () => <h1>Lesson</h1> }));

function selectText(node, text) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.getBoundingClientRect = () => ({ left: 20, bottom: 30 });
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  Object.defineProperty(selection, 'toString', { configurable: true, value: () => text });
}

describe('Course workspace pane and AI selection contract', () => {
  it('uses restrained pane gutters, borders, and a bounded toggle surface', () => {
    expect(sidebarCss).toMatch(/\.workspace\s*\{[\s\S]*gap:\s*6px/);
    expect(sidebarCss).toMatch(/\.course-sidebar\s*\{[\s\S]*border:\s*1px solid #d3dce6/);
    expect(workspaceCss).toMatch(/\.lesson-region\s*\{[\s\S]*border:\s*1px solid #d3dce6/);
    expect(compilerCss).toMatch(/\.desktop-compiler\s*\{[\s\S]*border:\s*1px solid #d3dce6/);
    expect(workspaceCss).toMatch(/\.learning-workspace-toolbar\s*\{[\s\S]*border:\s*1px solid #d3dce6/);
    expect(`${sidebarCss}\n${workspaceCss}\n${compilerCss}`).toContain("border-color: var(--color-border)");
    expect(sidebarSource).not.toContain('sidebar-footer');
  });

  it('keeps the Course AI composer compact', () => {
    expect(workspaceCss).toMatch(/\.ai-workspace-composer textarea[^}]*height:\s*46px/);
    expect(workspaceCss).toMatch(/\.ai-workspace-composer button[^}]*height:\s*46px/);
    expect(workspaceCss).not.toContain('.ai-workspace-usage');
  });

  it('offers Ask AI only for selected lesson content and passes exact text', () => {
    const onAskAISelection = vi.fn();
    render(<ContentArea lesson={{ title: 'Lesson' }} module={{ title: 'Module' }} blocks={[]} emptyState={{}} unavailableState={{}} onAskAISelection={onAskAISelection} />);
    const content = screen.getByLabelText('Lesson content');
    selectText(screen.getByText('Select exact lesson text'), 'Select exact lesson text');
    fireEvent.mouseUp(content);
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(onAskAISelection).toHaveBeenCalledWith({ sourceType: 'lesson_text', text: 'Select exact lesson text' });
  });

  it.each([
    ['Output', 'compiler_output', 'exact output'],
    ['Expected', 'expected_output', 'expected value'],
    ['Errors', 'compiler_error', 'TypeError: exact'],
  ])('labels %s selections for Course AI', (tab, sourceType, selectedText) => {
    const onAskAISelection = vi.fn();
    const view = render(<OutputPanel result="exact output" error="TypeError: exact" expectedOutput="expected value" executionStatus="idle" onAskAISelection={onAskAISelection} />);
    const current = within(view.container);
    fireEvent.click(current.getByRole('tab', { name: new RegExp(tab) }));
    const panel = current.getByRole('tabpanel');
    selectText(panel, selectedText);
    fireEvent.mouseUp(panel);
    fireEvent.click(current.getByRole('button', { name: 'Ask AI' }));
    expect(onAskAISelection).toHaveBeenCalledWith({ sourceType, text: selectedText });
  });
});
