import { AlertTriangle } from 'lucide-react';
import { Dialog } from '../../../components/Dialog';

export function WarningDialog({ warning, count, maximum, onAcknowledge }) {
  if (!warning) return null;
  return (
    <Dialog open title="Exam integrity warning" description={warning.message} role="alertdialog" onClose={onAcknowledge} className="exam-warning-dialog">
        <AlertTriangle aria-hidden="true" />
        <span>Warning {count} of {maximum}</span>
        <button className="button button--primary" type="button" onClick={onAcknowledge} data-autofocus>Return to exam</button>
    </Dialog>
  );
}
