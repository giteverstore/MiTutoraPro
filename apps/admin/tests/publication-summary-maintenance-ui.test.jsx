import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ROLES } from '../../../shared/admin/adminAuthorization.js';
import { AdminApplication } from '../src/AdminApp.jsx';
import { PublicationSummaryMaintenance } from '../src/PublicationSummaryMaintenance.jsx';

afterEach(cleanup);

const session = (role) => ({ uid: 'admin-test', email: 'admin@example.test', role });
const authClientFor = (role) => ({
  subscribe(next) { queueMicrotask(() => next(session(role))); return vi.fn(); },
  signOut: vi.fn(),
  refreshClaims: vi.fn(),
});

describe('Publication summary maintenance UI', () => {
  it('is visible only to SUPER_ADMIN and never invokes automatically', async () => {
    const request = vi.fn();
    const { unmount } = render(<AdminApplication authClient={authClientFor(ADMIN_ROLES.SUPER_ADMIN)} initialPath="/admin/settings" maintenanceRequest={request} />);
    expect(await screen.findByRole('button', { name: 'Run Summary Backfill Dry Run' })).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    unmount();

    render(<AdminApplication authClient={authClientFor(ADMIN_ROLES.CONTENT_ADMIN)} initialPath="/admin/settings" maintenanceRequest={request} />);
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run Summary Backfill Dry Run' })).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('sends exactly the dry-run request, prevents duplicates, and renders safe counters', async () => {
    let resolve;
    const request = vi.fn(() => new Promise((done) => { resolve = done; }));
    render(<PublicationSummaryMaintenance role={ADMIN_ROLES.SUPER_ADMIN} request={request} />);
    const button = screen.getByRole('button', { name: 'Run Summary Backfill Dry Run' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('maintenance/publication-summary-backfill', {
      method: 'POST',
      body: { dryRun: true },
    });
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled();
    resolve({ backfill: { dryRun: true, inspected: 9, missing: 2, changed: 3, unchanged: 6 } });
    const results = await screen.findByLabelText('Publication summary dry-run results');
    expect(results).toHaveTextContent('Dry run:true');
    expect(results).toHaveTextContent('Inspected:9');
    expect(results).toHaveTextContent('Missing:2');
    expect(results).toHaveTextContent('Changed:3');
    expect(results).toHaveTextContent('Unchanged:6');
    expect(JSON.stringify(request.mock.calls)).not.toContain('dryRun":false');
    expect(JSON.stringify(request.mock.calls)).not.toContain('APPLY_PUBLICATION_SUMMARY_BACKFILL');
  });

  it.each([
    [401, 'Admin session expired. Sign in again.'],
    [403, 'SUPER_ADMIN permission required.'],
    [500, 'Backfill dry run failed.'],
  ])('renders a sanitized message for HTTP %s', async (status, message) => {
    const request = vi.fn().mockRejectedValue({ status, message: 'private backend detail' });
    render(<PublicationSummaryMaintenance role={ADMIN_ROLES.SUPER_ADMIN} request={request} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Summary Backfill Dry Run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();
  });

  it('rejects a non-dry-run response without displaying unsafe payload fields', async () => {
    const request = vi.fn().mockResolvedValue({ backfill: { dryRun: false, inspected: 1 }, internalPath: 'private/path' });
    render(<PublicationSummaryMaintenance role={ADMIN_ROLES.SUPER_ADMIN} request={request} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Summary Backfill Dry Run' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Backfill dry run failed.'));
    expect(screen.queryByText('private/path')).not.toBeInTheDocument();
  });
});
