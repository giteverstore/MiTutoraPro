import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentStudioEditor } from '../src/content-studio/editor/ContentStudioEditor.jsx';
import { createEmptyEditorDocument } from '../src/content-studio/serialization/editorSerialization.js';

afterEach(cleanup);
const repository = (recovered = null) => ({ load: vi.fn().mockResolvedValue(recovered), save: vi.fn().mockResolvedValue({ savedAt: 'now' }) });

describe('Content Studio editor UI', () => {
  it('adds and edits a block, validates, and exposes deterministic generated JSON', async () => {
    const document = createEmptyEditorDocument();
    render(<ContentStudioEditor initialDocument={document} repository={repository()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Heading block' }));
    const heading = screen.getByRole('textbox', { name: 'Heading text' });
    fireEvent.change(heading, { target: { value: 'Loops and iteration' } });
    expect(heading).toHaveValue('Loops and iteration');
    fireEvent.click(screen.getByRole('button', { name: /Validate/ }));
    expect(screen.getByText('Document is valid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Generated JSON/ }));
    expect(screen.getByText(/"text": "Loops and iteration"/)).toBeInTheDocument();
  });

  it('recovers a stored draft before authoring begins', async () => {
    const original = createEmptyEditorDocument();
    const recovered = { ...original, title: 'Recovered structured lesson' };
    render(<ContentStudioEditor initialDocument={original} repository={repository(recovered)} />);
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Recovered structured lesson'));
  });

  it('renders reviewer mode as read-only while retaining preview and validation', () => {
    render(<ContentStudioEditor readOnly initialDocument={createEmptyEditorDocument()} repository={repository()} />);
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Heading block' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Validate/ })).toBeEnabled();
    expect(screen.getByLabelText('Title')).toHaveAttribute('readonly');
  });
});
