import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompilerLanguageSelector } from '../../src/components/CompilerLanguageSelector.jsx';
import {
  COMPILER_LANGUAGE_CATEGORIES,
  groupCompilerLanguageOptions,
  resolveCompilerLanguageOptions,
  supportedCompilerLanguages,
} from '../../src/compiler/languages/supportedLanguages.js';
import { createCompilerData } from '../../src/components/blocks/CompilerBlock.jsx';
import { useSelectableCompilerLanguage } from '../../src/compiler/useSelectableCompilerLanguage.js';
import { EditorHeader } from '../../src/components/EditorHeader.jsx';
import { createDevelopmentCompilerDefinition, getDevelopmentCompilerOptions } from '../../src/compiler/developmentCompilerOverride.js';

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
    expect(supportedCompilerLanguages.map(({ id }) => id)).toEqual(['python', 'java', 'javascript', 'typescript', 'html-css', 'react', 'sql', 'c', 'cpp', 'mysql', 'php', 'r', 'csharp', 'visualbasic', 'assembly', 'go', 'rust']);
    const options = resolveCompilerLanguageOptions([createCompilerData(definition('python', 'main.py'))]);
    expect(options.map(({ id, available }) => ({ id, available }))).toEqual([
      { id: 'python', available: true },
      { id: 'java', available: false },
      { id: 'javascript', available: false },
      { id: 'typescript', available: false },
      { id: 'html-css', available: false },
      { id: 'react', available: false },
      { id: 'sql', available: false },
      { id: 'c', available: false },
      { id: 'cpp', available: false },
      { id: 'mysql', available: false },
      { id: 'php', available: false },
      { id: 'r', available: false },
      { id: 'csharp', available: false },
      { id: 'visualbasic', available: false },
      { id: 'assembly', available: false },
      { id: 'go', available: false },
      { id: 'rust', available: false },
    ]);
  });

  it('groups every canonical language exactly once in stable learner-facing categories', () => {
    expect(COMPILER_LANGUAGE_CATEGORIES.map(({ id }) => id)).toEqual(['web', 'general', 'systems', 'dotnet', 'data']);
    const grouped = groupCompilerLanguageOptions(supportedCompilerLanguages.map((language) => ({ ...language, available: true })));
    expect(grouped.map(({ id, languages }) => [id, languages.map(({ id: languageId }) => languageId)])).toEqual([
      ['web', ['html-css', 'javascript', 'typescript', 'react', 'php']],
      ['general', ['python', 'java', 'go']],
      ['systems', ['c', 'cpp', 'rust', 'assembly']],
      ['dotnet', ['csharp', 'visualbasic']],
      ['data', ['sql', 'mysql', 'r']],
    ]);
    expect(grouped.flatMap(({ languages }) => languages)).toHaveLength(supportedCompilerLanguages.length);
  });

  it('hides unavailable languages and renders no category headings', () => {
    const onChange = vi.fn();
    const options = resolveCompilerLanguageOptions([
      createCompilerData(definition('python', 'main.py')),
      createCompilerData(definition('javascript', 'main.js')),
    ]);
    render(<CompilerLanguageSelector value="python" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compiler language' }));
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Java' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Python' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'JavaScript' }));
    expect(onChange).toHaveBeenCalledWith('javascript');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders all available languages in the stable product-facing order', () => {
    const options = supportedCompilerLanguages.map((language) => ({ ...language, available: true }));
    render(<CompilerLanguageSelector value="python" options={options} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compiler language' }));
    expect(screen.getAllByRole('menuitemradio').map((item) => item.querySelector('span').textContent)).toEqual([
      'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'C', 'C++', 'Rust', 'Assembly',
      'HTML/CSS', 'React', 'PHP', 'R', 'C#', 'Visual Basic', 'SQL', 'MySQL',
    ]);
  });

  it('supports keyboard opening, navigation, selection, and Escape dismissal', () => {
    const onChange = vi.fn();
    const options = resolveCompilerLanguageOptions([
      createCompilerData(definition('python', 'main.py')),
      createCompilerData(definition('java', 'Main.java')),
    ]);
    render(<CompilerLanguageSelector value="python" options={options} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Compiler language' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const python = screen.getByRole('menuitemradio', { name: 'Python' });
    const java = screen.getByRole('menuitemradio', { name: 'Java' });
    python.focus();
    fireEvent.keyDown(python, { key: 'ArrowDown' });
    expect(java).toHaveFocus();
    fireEvent.keyDown(java, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
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
    expect(container.querySelector('button[aria-label="Compiler language"]')).toBeInTheDocument();
    expect(container.querySelector('.compiler-language-selector')).toBe(container.querySelector('.ide-header')?.firstElementChild);
    expect(container.querySelector('button[aria-label="Reset code"]')).toBeEnabled();
    expect(container.querySelector('button[aria-label="Run code"]')).toBeEnabled();
    expect(container.querySelector('button[aria-label="Editor settings"]')).not.toBeInTheDocument();
    expect(container.querySelector('button[aria-label="Send compiler feedback"]')).not.toBeInTheDocument();
    expect(container.querySelector('button[aria-label="Share code"]')).not.toBeInTheDocument();
  });

  it('fails safely instead of falling back for an unsupported course compiler', () => {
    expect(() => createCompilerData(definition('ruby', 'main.rb')))
      .toThrow('Unsupported compiler language: ruby');
  });

  it('keeps SQL setup separate from visible starter source', () => {
    const data = createCompilerData({
      ...definition('sql', 'query.sql'),
      setupSql: 'CREATE TABLE hidden_seed (value INTEGER);',
      starterCode: 'SELECT * FROM hidden_seed;',
    });
    expect(data.setupSql).toBe('CREATE TABLE hidden_seed (value INTEGER);');
    expect(data.editor.lines.map(({ text }) => text).join('\n')).toBe('SELECT * FROM hidden_seed;');
  });

  it.each([['python', 'main.py'], ['java', 'Main.java'], ['javascript', 'main.js'], ['typescript', 'main.ts'], ['html-css', 'index.html'], ['react', 'App.jsx'], ['sql', 'query.sql'], ['c', 'main.c'], ['cpp', 'main.cpp'], ['mysql', 'query.sql'], ['php', 'main.php'], ['r', 'main.R'], ['csharp', 'Program.cs'], ['visualbasic', 'Program.vb'], ['assembly', 'main.asm'], ['go', 'main.go'], ['rust', 'main.rs']])(
    'keeps a %s course compiler informational and locked',
    (language, fileName) => {
      const data = createCompilerData(definition(language, fileName));
      const { container, getByText, queryByText } = render(<EditorHeader data={data} executionStatus="idle" onRun={vi.fn()} onReset={vi.fn()} />);
      const label = supportedCompilerLanguages.find(({ id }) => id === language)?.label;
      expect(getByText(label)).toHaveClass('compiler-language-label');
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

  it('derives the development override from every registered runtime', () => {
    expect(getDevelopmentCompilerOptions().map(({ id, available }) => ({ id, available }))).toEqual([
      { id: 'python', available: true },
      { id: 'java', available: true },
      { id: 'javascript', available: true },
      { id: 'typescript', available: true },
      { id: 'html-css', available: true },
      { id: 'react', available: true },
      { id: 'sql', available: true },
      { id: 'c', available: true },
      { id: 'cpp', available: true },
      { id: 'mysql', available: true },
      { id: 'php', available: true },
      { id: 'r', available: true },
      { id: 'csharp', available: true },
      { id: 'visualbasic', available: true },
      { id: 'assembly', available: true },
      { id: 'go', available: true },
      { id: 'rust', available: true },
    ]);
  });

  it('creates a MySQL database-mode DEV definition without altering canonical content', () => {
    const contentDefinition = createCompilerData({ ...definition('sql', 'query.sql'), starterCode: 'SELECT 1;' });
    const mysql = createDevelopmentCompilerDefinition(contentDefinition, 'mysql', 'SELECT sqlite_version();');
    expect(mysql).toEqual(expect.objectContaining({ language: 'mysql', executionMode: 'database', setupSql: undefined }));
    expect(mysql.editor).toEqual(expect.objectContaining({ fileName: 'query.sql', language: 'sql' }));
    expect(mysql.editor.lines.map(({ text }) => text).join('\n')).toContain('AUTO_INCREMENT');
    expect(contentDefinition).toEqual(expect.objectContaining({ language: 'sql', starterCode: 'SELECT 1;' }));
  });

  it('uses the canonical starter and editor metadata for C and C++ development overrides', () => {
    const contentDefinition = createCompilerData({ ...definition('python', 'main.py'), starterCode: 'print("content")' });
    const c = createDevelopmentCompilerDefinition(contentDefinition, 'c', 'unsaved Python source');
    const cpp = createDevelopmentCompilerDefinition(contentDefinition, 'cpp', 'unsaved Python source');

    expect(c.editor).toEqual(expect.objectContaining({ fileName: 'main.c', language: 'c' }));
    expect(c.editor.lines.map(({ text }) => text).join('\n')).toContain('#include <stdio.h>');
    expect(cpp.editor).toEqual(expect.objectContaining({ fileName: 'main.cpp', language: 'cpp' }));
    expect(cpp.editor.lines.map(({ text }) => text).join('\n')).toContain('#include <iostream>');
  });

  it('uses the canonical PHP starter and editor metadata for the development override', () => {
    const contentDefinition = createCompilerData({ ...definition('python', 'main.py'), starterCode: 'print("content")' });
    const php = createDevelopmentCompilerDefinition(contentDefinition, 'php', 'unsaved Python source');

    expect(php).toEqual(expect.objectContaining({ language: 'php', executionMode: 'terminal' }));
    expect(php.editor).toEqual(expect.objectContaining({ fileName: 'main.php', language: 'php' }));
    expect(php.editor.lines.map(({ text }) => text).join('\n')).toContain('echo "Hello, World!"');
    expect(contentDefinition).toEqual(expect.objectContaining({ language: 'python', starterCode: 'print("content")' }));
  });

  it('uses the canonical R starter and editor metadata for the development override', () => {
    const contentDefinition = createCompilerData({ ...definition('php', 'main.php'), starterCode: '<?php echo "content";' });
    const r = createDevelopmentCompilerDefinition(contentDefinition, 'r', 'unsaved PHP source');

    expect(r).toEqual(expect.objectContaining({ language: 'r', executionMode: 'terminal' }));
    expect(r.editor).toEqual(expect.objectContaining({ fileName: 'main.R', language: 'r' }));
    expect(r.editor.lines.map(({ text }) => text).join('\n')).toBe('print("Hello, World!")');
    expect(contentDefinition).toEqual(expect.objectContaining({ language: 'php', starterCode: '<?php echo "content";' }));
  });

  it('uses canonical C# metadata and does not mutate content during the development override', () => {
    const contentDefinition = createCompilerData({ ...definition('r', 'main.R'), starterCode: 'print("content")' });
    const csharp = createDevelopmentCompilerDefinition(contentDefinition, 'csharp', 'unsaved R source');

    expect(csharp).toEqual(expect.objectContaining({ language: 'csharp', executionMode: 'terminal' }));
    expect(csharp.editor).toEqual(expect.objectContaining({ fileName: 'Program.cs', language: 'csharp' }));
    expect(csharp.editor.lines.map(({ text }) => text).join('\n')).toContain('Console.WriteLine("Hello, World!")');
    expect(contentDefinition).toEqual(expect.objectContaining({ language: 'r', starterCode: 'print("content")' }));
  });

  it('uses canonical Visual Basic metadata without mutating content during the development override', () => {
    const contentDefinition = createCompilerData({ ...definition('csharp', 'Program.cs'), starterCode: 'Console.WriteLine("content");' });
    const visualBasic = createDevelopmentCompilerDefinition(contentDefinition, 'visualbasic', 'unsaved C# source');

    expect(visualBasic).toEqual(expect.objectContaining({ language: 'visualbasic', executionMode: 'terminal' }));
    expect(visualBasic.editor).toEqual(expect.objectContaining({ fileName: 'Program.vb', language: 'vb' }));
    expect(visualBasic.editor.lines.map(({ text }) => text).join('\n')).toContain('Module Program');
    expect(contentDefinition).toEqual(expect.objectContaining({ language: 'csharp', starterCode: 'Console.WriteLine("content");' }));
  });

  it('uses the x86-64 emulator mode and canonical Assembly starter in development only', () => {
    const contentDefinition = createCompilerData({ ...definition('visualbasic', 'Program.vb'), starterCode: 'Module Program\nEnd Module' });
    const assembly = createDevelopmentCompilerDefinition(contentDefinition, 'assembly', 'unsaved Visual Basic source');

    expect(assembly).toEqual(expect.objectContaining({ language: 'assembly', executionMode: 'emulator' }));
    expect(assembly.editor).toEqual(expect.objectContaining({ fileName: 'main.asm', language: 'asm' }));
    expect(assembly.editor.lines.map(({ text }) => text).join('\n')).toBe('mov rax, 10\nmov rbx, 20\nadd rax, rbx');
    expect(contentDefinition).toEqual(expect.objectContaining({ language: 'visualbasic' }));
  });

  it('creates an execution-only override without mutating content validation metadata', () => {
    const contentDefinition = createCompilerData({
      ...definition('python', 'main.py'),
      starterCode: 'print("content")',
      expectedOutput: 'content',
    });
    const overridden = createDevelopmentCompilerDefinition(contentDefinition, 'java', 'print("local edit")');
    expect(contentDefinition).toEqual(expect.objectContaining({ language: 'python', expectedOutput: 'content' }));
    expect(overridden).toEqual(expect.objectContaining({
      language: 'java',
      exerciseId: null,
      expectedOutput: undefined,
      isDevelopmentOverride: true,
    }));
    expect(overridden.editor).toEqual(expect.objectContaining({ fileName: 'Main.java', language: 'java' }));
    expect(overridden.editor.lines.map(({ text }) => text).join('\n')).toBe('print("local edit")');
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
