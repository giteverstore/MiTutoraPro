import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompilerLanguageSelector } from '../../src/components/CompilerLanguageSelector.jsx';
import {
  resolveCompilerLanguageOptions,
  supportedCompilerLanguages,
} from '../../src/compiler/languages/supportedLanguages.js';
import { createCompilerData } from '../../src/components/blocks/CompilerBlock.jsx';
import { useSelectableCompilerLanguage } from '../../src/compiler/useSelectableCompilerLanguage.js';
import { EditorHeader } from '../../src/components/EditorHeader.jsx';

const definition = (language, fileName) => ({
  id: `${language}-compiler`,
  type: 'compiler',
  language,
  fileName,
  starterCode: '',
  expectedOutput: '',
});

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    clear: () => values.clear(),
  });
});
afterEach(cleanup);

describe('compiler language policy', () => {
  it('derives selectable options from the canonical runtime registry', () => {
    expect(supportedCompilerLanguages.map(({ id }) => id)).toEqual(['python', 'java']);
    const options = resolveCompilerLanguageOptions([createCompilerData(definition('python', 'main.py'))]);
    expect(options.map(({ id, available }) => ({ id, available }))).toEqual([
      { id: 'python', available: true },
      { id: 'java', available: false },
    ]);
  });

  it('renders unavailable content languages as disabled and remains keyboard-native', () => {
    const onChange = vi.fn();
    const options = resolveCompilerLanguageOptions([createCompilerData(definition('python', 'main.py'))]);
    render(<CompilerLanguageSelector value="python" options={options} onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Compiler language' })).toHaveValue('python');
    expect(screen.getByRole('option', { name: 'Java — unavailable' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'python' } });
    expect(onChange).toHaveBeenCalledWith('python');
  });

  it('uses the compact selectable header without duplicate file, language, or visible status', () => {
    const data = createCompilerData(definition('python', 'main.py'));
    const options = resolveCompilerLanguageOptions([data]);
    const { container } = render(
      <EditorHeader
        data={data}
        executionStatus="idle"
        onRun={vi.fn()}
        onReset={vi.fn()}
        languageSelector={<CompilerLanguageSelector value="python" options={options} onChange={vi.fn()} />}
      />,
    );
    expect(container.querySelector('.ide-file-context')).not.toBeInTheDocument();
    expect(container.querySelector('.ide-execution-state')).not.toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toHaveClass('sr-only');
    expect(container.querySelector('select[aria-label="Compiler language"]')).toBeInTheDocument();
    expect(container.querySelector('.compiler-language-selector')).toBe(container.querySelector('.ide-header')?.firstElementChild);
    expect(container.querySelector('button[aria-label="Reset code"]')).toBeEnabled();
    expect(container.querySelector('button[aria-label="Run code"]')).toBeEnabled();
  });

  it('fails safely instead of falling back for an unsupported course compiler', () => {
    expect(() => createCompilerData(definition('ruby', 'main.rb')))
      .toThrow('Unsupported compiler language: ruby');
  });

  it.each([['python', 'main.py'], ['java', 'Main.java']])(
    'keeps a %s course compiler informational and locked',
    (language, fileName) => {
      const data = createCompilerData(definition(language, fileName));
      const { container, getByText, queryByText } = render(<EditorHeader data={data} executionStatus="idle" onRun={vi.fn()} onReset={vi.fn()} />);
      expect(getByText(language[0].toUpperCase() + language.slice(1))).toHaveClass('compiler-language-label');
      expect(queryByText(fileName)).not.toBeInTheDocument();
      expect(container.querySelector('[aria-label="Compiler language"]')).not.toBeInTheDocument();
      expect(container.querySelector('.ide-execution-state')).not.toBeInTheDocument();
      expect(container.querySelector('[role="status"]')).toHaveClass('sr-only');
      expect(container.querySelector('button[aria-label="Reset code"]')).toBeEnabled();
      expect(container.querySelector('button[aria-label="Run code"]')).toBeEnabled();
    },
  );

  it('can derive a newly registered language without page-specific logic', () => {
    const ruby = Object.freeze({ id: 'ruby', label: 'Ruby', monacoLanguage: 'ruby' });
    const rubyDefinition = { language: 'ruby' };
    expect(resolveCompilerLanguageOptions([rubyDefinition], [ruby])).toEqual([
      expect.objectContaining({ id: 'ruby', available: true, definition: rubyDefinition }),
    ]);
  });

  it('switches to the matching content definition and remembers the safe preference', async () => {
    localStorage.clear();
    const definitions = [
      createCompilerData({ ...definition('python', 'main.py'), starterCode: 'print("Python")' }),
      createCompilerData({ ...definition('java', 'Main.java'), starterCode: 'class Main {}' }),
    ];
    const { result } = renderHook(() => useSelectableCompilerLanguage(definitions));
    const loadDefinition = vi.fn().mockResolvedValue(true);
    result.current.panelRef.current = { loadDefinition };

    await act(() => result.current.selectLanguage('java'));

    expect(loadDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'java', starterCode: 'class Main {}' }),
      expect.objectContaining({ replacementDescription: expect.stringContaining('starter code for Java') }),
    );
    expect(result.current.language).toBe('java');
    expect(result.current.activeDefinition.editor.language).toBe('java');
    expect(localStorage.getItem('ycoders.compiler.preferredLanguage')).toBe('java');
  });

  it('keeps the active language when replacement confirmation is cancelled', async () => {
    localStorage.clear();
    const definitions = [
      createCompilerData(definition('python', 'main.py')),
      createCompilerData(definition('java', 'Main.java')),
    ];
    const { result } = renderHook(() => useSelectableCompilerLanguage(definitions));
    result.current.panelRef.current = { loadDefinition: vi.fn().mockResolvedValue(false) };

    await act(() => result.current.selectLanguage('java'));

    expect(result.current.language).toBe('python');
  });
});
