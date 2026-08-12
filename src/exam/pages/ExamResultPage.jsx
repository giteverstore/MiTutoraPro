import { CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useExam } from '../hooks/useExam';

function formatDuration(milliseconds = 0) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

const outcomeCopy = Object.freeze({
  CERTIFIED: { label: 'Certified', message: 'Your certification has been issued.' },
  NOT_CERTIFIED: { label: 'Not certified', message: 'The exam passing requirement was not met.' },
  REVIEW_REQUIRED: { label: 'Review required', message: 'Your attempt requires additional review before a final certification decision can be confirmed.' },
  INCOMPLETE: { label: 'Incomplete', message: 'The attempt did not reach a valid final submission.' },
});

export function ExamResultPage({ onExit }) {
  const { result, resetExam } = useExam();
  const decision = result.certificationDecision?.status ?? 'INCOMPLETE';
  const outcome = outcomeCopy[decision];
  const certified = decision === 'CERTIFIED';
  const report = result.integrityReport;
  const explanation = result.certificationDecision?.explanation;
  const concerns = report.detectorSummary ?? [];

  return (
    <div className="exam-page exam-result-page">
      <header className="exam-page-header"><button className="button button--ghost" type="button" onClick={onExit}>Back to certificates</button><div className="exam-brand"><ShieldCheck /><span>MiTutora Certification</span></div></header>
      <main className="exam-result-main">
        <section className={`exam-result-hero ${certified ? 'is-passed' : 'is-review'}`}>
          {certified ? <CheckCircle2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          <span>Certification result</span><h1>{outcome.label}</h1><p>{outcome.message}</p>
        </section>
        <section className="exam-result-metrics" aria-label="Certification results">
          <article><span>Exam score</span><strong>{result.score}%</strong></article>
          <article><span>Integrity status</span><strong>{report.overallStatus?.replaceAll('_', ' ') ?? 'Available'}</strong></article>
          <article><span>Attempt duration</span><strong>{formatDuration(report.monitoringDurationMs)}</strong></article>
          <article><span>Decision</span><strong>{outcome.label}</strong></article>
        </section>
        <section className="exam-card exam-decision-explanation">
          <div className="exam-card-heading"><span>Decision explanation</span><h2>Why this result was reached</h2><p>{explanation?.headline ?? outcome.message}</p></div>
          <ul>{(explanation?.statements ?? []).map((statement) => <li key={statement}><CheckCircle2 aria-hidden="true" /> {statement}</li>)}</ul>
        </section>
        <section className="exam-card exam-integrity-summary">
          <div className="exam-card-heading"><span>Integrity summary</span><h2>Monitored exam conditions</h2><p>A concise summary is shown here; sensitive detector thresholds and raw monitoring evidence are not exposed.</p></div>
          {concerns.length ? <ul>{concerns.map((item) => <li key={item.category}><ShieldAlert aria-hidden="true" /><span><strong>{item.category}</strong><small>{item.occurrences} monitored event{item.occurrences === 1 ? '' : 's'} · {formatDuration(item.totalDurationMs)}</small></span></li>)}</ul> : <div className="exam-empty-timeline"><ShieldCheck /><strong>No integrity concerns recorded</strong><p>Camera, browser focus, fullscreen, and monitored conditions remained compliant.</p></div>}
        </section>
        <div className="exam-result-actions"><button className="button button--secondary" type="button" onClick={resetExam}><RotateCcw /> Start another attempt</button><button className="button button--primary" type="button" onClick={onExit}>Finish</button></div>
      </main>
    </div>
  );
}
