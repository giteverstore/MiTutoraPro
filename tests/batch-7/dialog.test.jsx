import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../src/components/Dialog';

afterEach(cleanup);

function Harness({ onConfirm = () => {} }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>Open reset</button><ConfirmDialog open={open} title="Reset progress?" description="This removes saved progress." destructive confirmLabel="Reset" onConfirm={() => { onConfirm(); setOpen(false); }} onCancel={() => setOpen(false)} /></>;
}

describe('shared confirmation dialog', () => {
  it('exposes its accessible name/description and moves focus inside', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open reset' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Reset progress?' });
    expect(dialog).toHaveAccessibleDescription('This removes saved progress.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('traps Tab, closes with Escape, and restores trigger focus', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open reset' });
    trigger.focus();
    fireEvent.click(trigger);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Reset' });
    await waitFor(() => expect(cancel).toHaveFocus());
    confirm.focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(cancel).toHaveFocus();
    cancel.focus(); fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(confirm).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('supports cancel and destructive confirm actions without conflicts', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open reset' }));
    const confirm = screen.getByRole('button', { name: 'Reset' });
    expect(confirm).toHaveClass('button--danger');
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
