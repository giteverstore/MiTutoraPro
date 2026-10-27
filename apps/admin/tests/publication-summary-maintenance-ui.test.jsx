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
const confirmation = 'APPLY_PUBLICATION_SUMMARY_BACKFILL';
const dryRun = { dryRun: true, inspected: 9, missing: 2, changed: 3, unchanged: 6 };

async function completeDryRun(request, result = dryRun) {
  fireEvent.click(screen.getByRole('button', { name: 'Run Summary Backfill Dry Run' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('maintenance/publication-summary-backfill', {
    method: 'POST', body: { dryRun: true },
  }));
  await screen.findByLabelText('Publication summary backfill results');
  return result;
}

describe('Publication summary maintenance UI', () => {
  it('is visible only to SUPER_ADMIN and never invokes automatically', async () => {
    const request = vi.fn();
    const { unmount } = render(<AdminApplication authClient={authClientFor(ADMIN_ROLES.SUPER_ADMIN)} initialPath="/admin/settings" maintenanceRequest={request} />);
    expect(await screen.findByRole('button', { name: 'Run Summary Backfill Dry Run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Publication Summary Backfill' })).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    unmount();

    render(<AdminApplication authClient={authClientFor(ADMIN_ROLES.CONTENT_ADMIN)} initialPath="/admin/settings" maintenanceRequest={request} />);
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run Summary Backfill Dry Run' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Publication Summary Backfill' })).not.toBeInTheDocument();
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
    const results = await screen.findByLabelText('Publication summary backfill results');
    expect(results).toHaveTextContent('Dry run:true');
    expect(results).toHaveTextContent('Inspected:9');
    expect(results).toHaveTextContent('Missing:2');
    expect(results).toHaveTextContent('Changed:3');
    expect(results).toHaveTextContent('Unchanged:6');
    expect(JSON.stringify(request.mock.calls)).not.toContain('dryRun":false');
    expect(JSON.stringify(request.mock.calls)).not.toContain('APPLY_PUBLICATION_SUMMARY_BACKFILL');
  });

  it('requires a current successful dry run with changes and an exact typed confirmation', async () => {
    const request = vi.fn().mockResolvedValueOnce({ backfill: { ...dryRun, changed: 0, unchanged: 9 } })
      .mockResolvedValueOnce({ backfill: dryRun });
    render(<PublicationSummaryMaintenance role={ADMIN_ROLES.SUPER_ADMIN} request={request} />);
    const input = screen.getByLabelText(/Type APPLY_PUBLICATION_SUMMARY_BACKFILL/);
    const apply = screen.getByRole('button', { name: 'Apply Publication Summary Backfill' });
    expect(apply).toBeDisabled();

    fireEvent.change(input, { target: { value: confirmation } });
    expect(apply).toBeDisabled();
    expect(request).not.toHaveBeenCalled();

    await completeDryRun(request, { ...dryRun, changed: 0, unchanged: 9 });
    fireEvent.change(input, { target: { value: confirmation } });
    expect(apply).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Run Summary Backfill Dry Run' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await screen.findByText('Changed:');
    fireEvent.change(input, { target: { value: confirmation.toLowerCase() } });
    expect(apply).toBeDisabled();
    fireEvent.change(input, { target: { value: ` ${confirmation}` } });
    expect(apply).toBeDisabled();
    fireEvent.change(input, { target: { value: confirmation } });
    expect(apply).toBeEnabled();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('applies once with the exact body, then clears and requires a new dry run', async () => {
    let resolveApply;
    const request = vi.fn()
      .mockResolvedValueOnce({ backfill: dryRun })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveApply = resolve; }));
    render(<PublicationSummaryMaintenance role={ADMIN_ROLES.SUPER_ADMIN} request={request} />);
    await completeDryRun(request);
    const input = screen.getByLabelText(/Type APPLY_PUBLICATION_SUMMARY_BACKFILL/);
    fireEvent.change(input, { target: { value: confirmation } });
    const apply = screen.getByRole('button', { name: 'Apply Publication Summary Backfill' });
    fireEvent.click(apply);
    fireEvent.click(apply);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith('maintenance/publication-summary-backfill', {
      method: 'POST', body: { dryRun: false, confirm: confirmation },
    });
    expect(screen.getByRole('button', { name: 'Run Summary Backfill Dry Run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Applying/ })).toBeDisabled();
    expect(input).toBeDisabled();

    resolveApply({ backfill: { dryRun: false, inspected: 9, missing: 2, changed: 3, unchanged: 6 } });
    expect(await screen.findByRole('status')).toHaveTextContent('Backfill applied. Run a new dry run to verify there are no remaining changes.');
    expect(input).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Apply Publication Summary Backfill' })).toBeDisabled();
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

  it.each([
    [400, 'Apply confirmation was rejected.'],
    [401, 'Admin session expired. Sign in again.'],
    [403, 'SUPER_ADMIN permission required.'],
    [500, 'Publication summary backfill failed.'],
  ])('renders a sanitized apply message for HTTP %s', async (status, message) => {
    const request = vi.fn().mockResolvedValueOnce({ backfill: dryRun })
      .mockRejectedValueOnce({ status, message: 'private backend detail' });
    render(<PublicationSummaryMaintenance role={ADMIN_ROLES.SUPER_ADMIN} request={request} />);
    await completeDryRun(request);
    fireEvent.change(screen.getByLabelText(/Type APPLY_PUBLICATION_SUMMARY_BACKFILL/), { target: { value: confirmation } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Publication Summary Backfill' }));
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
