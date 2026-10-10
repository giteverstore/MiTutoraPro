import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { courseBlockSchema } from '../../../shared/content/schemas.js';
import { CANONICAL_LANGUAGE_IDS } from '../../../shared/content/constants.js';
import { LegacyBlockInspector } from '../src/content-studio/inspector/LegacyBlockInspector.jsx';

afterEach(cleanup);

function edit(initial, onPatch = () => {}) {
  let current;
  function Harness() {
    const [block, setBlock] = useState(initial);
    current = block;
    return <LegacyBlockInspector block={block} readOnly={false} onChange={(patch) => { onPatch(patch); setBlock((value) => ({ ...value, ...patch })); }} />;
  }
  render(<Harness />);
  return () => current;
}

describe('canonical Course block property controls', () => {
  it.each(['paragraph', 'note'])('%s format is schema-backed', (type) => {
    const current = edit({ id: 'block-1', type, format: 'plain', content: 'Example' });
    const format = screen.getByRole('combobox', { name: 'Format' });
    expect(within(format).getAllByRole('option').map((option) => option.value)).toEqual(courseBlockSchema.properties.format.enum);
    fireEvent.change(format, { target: { value: 'markdown' } });
    expect(current().format).toBe('markdown');
  });

  it.each(['callout', 'warning'])('%s retains its stored format without an ineffective selector', (type) => {
    const current = edit({ id: 'block-1', type, format: 'markdown', content: 'Example' });
    expect(screen.queryByRole('combobox', { name: 'Format' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Format' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Content' }), { target: { value: 'Updated' } });
    expect(current()).toMatchObject({ format: 'markdown', content: 'Updated' });
  });

  it('edits list items individually and retains their order and object fields', () => {
    const current = edit({ id: 'list-1', type: 'list', items: ['First', { text: 'Second', emphasis: true }] });
    expect(screen.queryByRole('textbox', { name: 'Items' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Items 2' }), { target: { value: 'Changed' } });
    expect(current().items).toEqual(['First', { text: 'Changed', emphasis: true }]);
    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Items 3' }), { target: { value: 'Third' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove items 1' }));
    expect(current().items).toEqual([{ text: 'Changed', emphasis: true }, 'Third']);
  });

  it('uses canonical languages and preserves existing code modes', () => {
    const current = edit({ id: 'code-1', type: 'code', language: 'python', mode: 'runnable', code: 'print(1)' });
    const language = screen.getByRole('combobox', { name: 'Language' });
    expect(within(language).getAllByRole('option').map((option) => option.value)).toEqual([...CANONICAL_LANGUAGE_IDS, 'text', 'plaintext']);
    const mode = screen.getByRole('combobox', { name: 'Mode' });
    expect(mode).toHaveValue('runnable');
    expect(within(mode).getAllByRole('option').map((option) => option.value)).toEqual(['display', 'runnable']);
    fireEvent.change(language, { target: { value: 'cpp' } });
    expect(current().language).toBe('cpp');
  });

  it('shows legacy read-only code mode without offering it for new selection', () => {
    const current = edit({ id: 'code-legacy', type: 'code', language: 'python', mode: 'read-only', code: 'print(1)' });
    const mode = screen.getByRole('combobox', { name: 'Mode' });
    expect(mode).toHaveValue('read-only');
    expect(within(mode).getByRole('option', { name: 'Existing: read-only' })).toBeDisabled();
    fireEvent.change(mode, { target: { value: 'display' } });
    expect(current().mode).toBe('display');
    expect(within(mode).queryByRole('option', { name: 'Existing: read-only' })).not.toBeInTheDocument();
  });

  it('keeps quiz IDs stable, updates answers on removal, and reduces multi-select deterministically', () => {
    const current = edit({ id: 'quiz-1', type: 'quiz', selectionMode: 'multiple', question: 'Question?', options: [{ id: 'option-a', text: 'Same' }, { id: 'option-b', text: 'Same' }, { id: 'option-c', text: 'Third' }], correctOptionIds: ['option-b', 'option-c'] });
    expect(within(screen.getByRole('combobox', { name: 'Selection Mode' })).getAllByRole('option').map((option) => option.value)).toEqual(['single', 'multiple']);
    expect(screen.getByText('A. Same')).toBeInTheDocument();
    expect(screen.getByText('B. Same')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Selection Mode' }), { target: { value: 'single' } });
    expect(current().correctOptionIds).toEqual(['option-b']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Selection Mode' }), { target: { value: 'multiple' } });
    fireEvent.click(screen.getByLabelText('C. Third'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 2' }), { target: { value: 'Edited' } });
    expect(current().options[1].id).toBe('option-b');
    fireEvent.click(screen.getByRole('button', { name: 'Remove option 2' }));
    expect(current().correctOptionIds).toEqual(['option-c']);
    fireEvent.click(screen.getByRole('button', { name: '+ Add option' }));
    expect(current().options[2].id).toMatch(/^option-/);
    expect(current().options[2].id).not.toBe('option-b');
    fireEvent.change(screen.getByRole('combobox', { name: 'Selection Mode' }), { target: { value: 'single' } });
    expect(current().correctOptionIds).toEqual(['option-c']);
    expect(screen.getByRole('combobox', { name: 'Correct option' })).toHaveValue('option-c');
  });

  it('preserves legacy compiler runtime until language changes', () => {
    const current = edit({ id: 'compiler-1', type: 'compiler', language: 'python', runtime: 'python3', starterCode: '' });
    expect(screen.queryByRole('combobox', { name: 'Runtime' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Runtime' })).toHaveValue('python3');
    expect(screen.getByRole('textbox', { name: 'Runtime' })).toHaveAttribute('readonly');
    expect(current().runtime).toBe('python3');
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'javascript' } });
    expect(current().runtime).toBe('javascript');
    expect(screen.getByRole('textbox', { name: 'Runtime' })).toHaveValue('javascript');
  });

  it('edits exercise instructions, objectives, hints and starter files without rewriting extra fields', () => {
    const current = edit({ id: 'exercise-1', type: 'exercise', instructions: { content: 'Try it', format: 'markdown', other: 'keep' }, objectives: ['One'], hints: ['Hint'], starterFiles: [{ name: 'main.py', content: 'print(1)', metadata: 'keep' }] });
    fireEvent.change(screen.getByRole('textbox', { name: 'Instructions content' }), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add objective' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Objectives 2' }), { target: { value: 'Two' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add hint' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hints 2' }), { target: { value: 'Another' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'File content 1' }), { target: { value: 'print(2)' } });
    expect(current().instructions).toEqual({ content: 'Updated', format: 'markdown', other: 'keep' });
    expect(current().objectives).toEqual(['One', 'Two']);
    expect(current().hints).toEqual(['Hint', 'Another']);
    expect(current().starterFiles[0]).toEqual({ name: 'main.py', content: 'print(2)', metadata: 'keep' });
    expect(screen.queryByRole('textbox', { name: 'Advanced instructions JSON (legacy)' })).not.toBeInTheDocument();
  });

  it('preserves open-ended legacy instructions unless Advanced JSON is intentionally edited', () => {
    const instructions = { variants: { python: ['one', 'two'] }, metadata: { source: 'legacy' } };
    const patches = [];
    const current = edit({ id: 'exercise-legacy', type: 'exercise', title: 'Legacy', instructions }, (patch) => patches.push(patch));
    const advanced = screen.getByRole('textbox', { name: 'Advanced instructions JSON (legacy)' });
    expect(screen.queryByRole('textbox', { name: 'Instructions content' })).not.toBeInTheDocument();
    fireEvent.blur(advanced);
    expect(patches).toEqual([]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Updated title' } });
    expect(current().instructions).toBe(instructions);
    fireEvent.change(advanced, { target: { value: JSON.stringify({ ...instructions, metadata: { source: 'updated' } }) } });
    fireEvent.blur(advanced);
    expect(current().instructions).toEqual({ variants: { python: ['one', 'two'] }, metadata: { source: 'updated' } });
  });

  it('offers canonical code languages for solution blocks', () => {
    const current = edit({ id: 'solution-1', type: 'solution', language: 'python', title: 'Answer', description: '', code: '' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'java' } });
    expect(current().language).toBe('java');
    expect(current().code).toBe('');
  });
});
