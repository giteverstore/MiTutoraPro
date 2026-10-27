import { useRef, useState } from 'react';
import { ADMIN_ROLES } from '../../../shared/admin/adminAuthorization.js';
import { adminContentRequest } from './publishing/publishingApi.js';

const safeErrorMessage = (error) => ({
  400: 'Invalid maintenance request.',
  401: 'Admin session expired. Sign in again.',
  403: 'SUPER_ADMIN permission required.',
  500: 'Backfill dry run failed.',
}[error?.status] ?? 'Backfill dry run failed.');

export function PublicationSummaryMaintenance({ role, request = adminContentRequest }) {
  const running = useRef(false);
  const [state, setState] = useState({ status: 'idle', result: null, message: '' });

  if (role !== ADMIN_ROLES.SUPER_ADMIN) return null;

  const runDryRun = async () => {
    if (running.current) return;
    running.current = true;
    setState({ status: 'running', result: null, message: '' });
    try {
      const response = await request('maintenance/publication-summary-backfill', {
        method: 'POST',
        body: { dryRun: true },
      });
      const result = response?.backfill;
      if (!result || result.dryRun !== true) throw new Error('Unexpected maintenance response.');
      setState({ status: 'complete', result, message: '' });
    } catch (error) {
      setState({ status: 'error', result: null, message: safeErrorMessage(error) });
    } finally {
      running.current = false;
    }
  };

  return <section className="admin-maintenance" aria-labelledby="publication-summary-maintenance">
    <h2 id="publication-summary-maintenance">Publication summary maintenance</h2>
    <p>Inspect published summary metadata without changing publication data.</p>
    <button className="admin-primary-button" type="button" disabled={state.status === 'running'} onClick={runDryRun}>
      {state.status === 'running' ? 'Running…' : 'Run Summary Backfill Dry Run'}
    </button>
    {state.status === 'error' ? <p className="admin-form-error" role="alert">{state.message}</p> : null}
    {state.result ? <dl className="admin-maintenance-results" aria-label="Publication summary dry-run results">
      <div><dt>Dry run:</dt><dd>{String(state.result.dryRun)}</dd></div>
      <div><dt>Inspected:</dt><dd>{state.result.inspected}</dd></div>
      <div><dt>Missing:</dt><dd>{state.result.missing}</dd></div>
      <div><dt>Changed:</dt><dd>{state.result.changed}</dd></div>
      <div><dt>Unchanged:</dt><dd>{state.result.unchanged}</dd></div>
    </dl> : null}
  </section>;
}

export function AdminSettingsPage({ role, request }) {
  return <div className="admin-page">
    <header className="admin-page-heading"><h1>Settings</h1><p>Administrative operations and application settings.</p></header>
    <PublicationSummaryMaintenance role={role} request={request} />
  </div>;
}
