import { AlertTriangle } from 'lucide-react';

export function WarningDialog({ warning, count, maximum, onAcknowledge }) {
  if (!warning) return null;
  return (
    <div className="exam-dialog-backdrop" role="presentation">
      <section className="exam-warning-dialog" role="alertdialog" aria-modal="true" aria-labelledby="exam-warning-title">
        <AlertTriangle aria-hidden="true" />
        <h2 id="exam-warning-title">Exam integrity warning</h2>
        <p>{warning.message}</p>
        <span>Warning {count} of {maximum}</span>
        <button className="button button--primary" type="button" onClick={onAcknowledge} autoFocus>Return to exam</button>
      </section>
    </div>
  );
}
