import { AlertTriangle, ShieldCheck } from 'lucide-react';

function formatType(type) {
  return type.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function ActiveViolations({ violations }) {
  return <section className="monitor-section" aria-labelledby="active-violations-title"><h3 id="active-violations-title">Active violations <span>{violations.length}</span></h3>{violations.length ? <ul className="active-violation-list">{violations.map((violation) => <li key={violation.id}><AlertTriangle /><span><strong>{formatType(violation.type)}</strong><small>{Math.ceil(violation.duration / 1000)}s active</small></span></li>)}</ul> : <div className="monitor-empty"><ShieldCheck /><span>No active violations</span></div>}</section>;
}
