import { CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { DETECTOR_SEVERITY } from '../../models/DetectorStatus';

function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function VerificationSummary({ summary, title = 'Environment verified', action }) {
  if (!summary) return null;
  const ready = summary.ready;
  const checks = ['camera', 'lighting', 'face', 'browser', 'fullscreen'];
  return (
    <section className="verification-summary exam-card" aria-labelledby="verification-summary-title">
      <div className="verification-summary-hero"><ShieldCheck aria-hidden="true" /><span>Verification report</span><h2 id="verification-summary-title">{ready ? title : 'Setup needs attention'}</h2><p>{ready ? 'Your setup meets the requirements for a certification exam.' : 'Review the recommendations below, make adjustments, and test again.'}</p></div>
      <div className="verification-summary-meta"><span><Clock3 /> Verification time <strong>{formatDuration(summary.verificationTimeMs)}</strong></span><span>Readiness score <strong>{summary.readinessScore}%</strong></span></div>
      <ul>{checks.map((id) => { const check = summary.checks[id]; return <li key={id}><CheckCircle2 className={check.severity === DETECTOR_SEVERITY.SUCCESS ? 'is-success' : 'is-warning'} /><span><strong>{id === 'face' ? 'Face detection' : id}</strong><small>{check.message}</small></span></li>; })}</ul>
      {summary.recommendations.length ? <div className="verification-recommendations"><strong>Recommendations</strong><ul>{summary.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></div> : null}
      {action}
    </section>
  );
}
