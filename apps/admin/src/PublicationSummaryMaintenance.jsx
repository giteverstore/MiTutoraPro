import { useRef, useState } from 'react';
import { ADMIN_ROLES } from '../../../shared/admin/adminAuthorization.js';
import { adminContentRequest } from './publishing/publishingApi.js';

const APPLY_CONFIRMATION = 'APPLY_PUBLICATION_SUMMARY_BACKFILL';

const safeErrorMessage = (error, applying) => ({
  400: applying ? 'Apply confirmation was rejected.' : 'Invalid maintenance request.',
  401: 'Admin session expired. Sign in again.',
  403: 'SUPER_ADMIN permission required.',
  500: applying ? 'Publication summary backfill failed.' : 'Backfill dry run failed.',
}[error?.status] ?? (applying ? 'Publication summary backfill failed.' : 'Backfill dry run failed.'));

export function PublicationSummaryMaintenance({ role, request = adminContentRequest }) {
  const running = useRef(false);
  const [state, setState] = useState({ status: 'idle', dryRunResult: null, applyResult: null, message: '' });
  const [confirmation, setConfirmation] = useState('');

  if (role !== ADMIN_ROLES.SUPER_ADMIN) return null;

  const runDryRun = async () => {
    if (running.current) return;
    running.current = true;
    setState({ status: 'running-dry-run', dryRunResult: null, applyResult: null, message: '' });
    setConfirmation('');
    try {
      const response = await request('maintenance/publication-summary-backfill', {
        method: 'POST',
        body: { dryRun: true },
      });
      const result = response?.backfill;
      if (!result || result.dryRun !== true) throw new Error('Unexpected maintenance response.');
      setState({ status: 'dry-run-complete', dryRunResult: result, applyResult: null, message: '' });
    } catch (error) {
      setState({ status: 'error', dryRunResult: null, applyResult: null, message: safeErrorMessage(error, false) });
    } finally {
      running.current = false;
    }
  };

  const applyReady = state.dryRunResult?.dryRun === true
    && state.dryRunResult.inspected > 0
    && state.dryRunResult.changed > 0
    && confirmation === APPLY_CONFIRMATION;

  const applyBackfill = async () => {
    if (running.current || !applyReady) return;
    running.current = true;
    setState((current) => ({ ...current, status: 'applying', applyResult: null, message: '' }));
    try {
      const response = await request('maintenance/publication-summary-backfill', {
        method: 'POST',
        body: { dryRun: false, confirm: APPLY_CONFIRMATION },
      });
      const result = response?.backfill;
      if (!result || result.dryRun !== false) throw new Error('Unexpected maintenance response.');
      setConfirmation('');
      setState({
        status: 'apply-complete',
        dryRunResult: null,
        applyResult: result,
        message: 'Backfill applied. Run a new dry run to verify there are no remaining changes.',
      });
    } catch (error) {
      setState((current) => ({ ...current, status: 'error', applyResult: null, message: safeErrorMessage(error, true) }));
    } finally {
      running.current = false;
    }
  };

  const busy = state.status === 'running-dry-run' || state.status === 'applying';
  const result = state.applyResult ?? state.dryRunResult;

  return <section className="admin-maintenance" aria-labelledby="publication-summary-maintenance">
    <h2 id="publication-summary-maintenance">Publication summary maintenance</h2>
    <p>Inspect published summary metadata without changing publication data.</p>
    <button className="admin-primary-button" type="button" disabled={busy} onClick={runDryRun}>
      {state.status === 'running-dry-run' ? 'Running…' : 'Run Summary Backfill Dry Run'}
    </button>
    {state.status === 'error' ? <p className="admin-form-error" role="alert">{state.message}</p> : null}
    {state.status === 'apply-complete' ? <p className="admin-maintenance-success" role="status">{state.message}</p> : null}
    {result ? <dl className="admin-maintenance-results" aria-label="Publication summary backfill results">
      <div><dt>Dry run:</dt><dd>{String(result.dryRun)}</dd></div>
      <div><dt>Inspected:</dt><dd>{result.inspected}</dd></div>
      <div><dt>Missing:</dt><dd>{result.missing}</dd></div>
      <div><dt>Changed:</dt><dd>{result.changed}</dd></div>
      <div><dt>Unchanged:</dt><dd>{result.unchanged}</dd></div>
    </dl> : null}
    <div className="admin-maintenance-apply">
      <h3>Apply summary backfill</h3>
      <p>Run a successful dry run with pending changes, then type the exact confirmation before applying.</p>
      <label htmlFor="publication-summary-apply-confirmation">Type <code>{APPLY_CONFIRMATION}</code> to confirm</label>
      <input
        id="publication-summary-apply-confirmation"
        type="text"
        value={confirmation}
        disabled={busy}
        autoComplete="off"
        spellCheck="false"
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <button className="admin-secondary-button" type="button" disabled={!applyReady || busy} onClick={applyBackfill}>
        {state.status === 'applying' ? 'Applying…' : 'Apply Publication Summary Backfill'}
      </button>
    </div>
  </section>;
}

export function AdminSettingsPage({ role, request }) {
  return <div className="admin-page">
    <header className="admin-page-heading"><h1>Settings</h1><p>Administrative operations and application settings.</p></header>
    <PublicationSummaryMaintenance role={role} request={request} />
  </div>;
}
