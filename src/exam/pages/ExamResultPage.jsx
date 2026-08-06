import { CheckCircle2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useExam } from '../hooks/useExam';

function formatEventType(type) {
  return type.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function ExamResultPage({ onExit }) {
  const { exam, result, resetExam } = useExam();
  const passed = !result.cancelled && result.score >= exam.passingScore;
  return (
    <div className="exam-page exam-result-page">
      <header className="exam-page-header"><button className="button button--ghost" type="button" onClick={onExit}>Back to certificates</button><div className="exam-brand"><ShieldCheck /><span>MiTutora Certification</span></div></header>
      <main className="exam-result-main">
        <section className={`exam-result-hero ${passed ? 'is-passed' : 'is-review'}`}>
          <CheckCircle2 aria-hidden="true" />
          <span>{result.cancelled ? 'Assessment cancelled' : passed ? 'Assessment passed' : 'More preparation recommended'}</span>
          <h1>{result.score}%</h1>
          <p>{result.correctAnswers} of {result.totalQuestions} answers correct</p>
        </section>
        <section className="exam-result-metrics" aria-label="Exam results">
          <article><span>Exam score</span><strong>{result.score}%</strong></article>
          <article><span>Integrity score</span><strong>{result.integrityReport.score}</strong></article>
          <article><span>Warnings</span><strong>{result.integrityReport.warningCount}</strong></article>
        </section>
        <section className="exam-timeline exam-card">
          <div className="exam-card-heading"><span>Session audit</span><h2>Event timeline</h2><p>Every browser and integrity event recorded during this attempt.</p></div>
          {result.integrityReport.timeline.length ? <ol>{result.integrityReport.timeline.map((event) => (
            <li key={event.id}><span className={`exam-event-severity is-${event.severity ?? event.metadata?.severity ?? 'medium'}`} /><div><strong>{formatEventType(event.type)}</strong><small>{new Date(event.timestamp ?? event.startedAt).toLocaleTimeString()} · {event.durationMs ?? event.duration ?? 0} ms</small></div><em>{event.status?.toLowerCase() ?? event.severity}</em></li>
          ))}</ol> : <div className="exam-empty-timeline"><ShieldCheck /><strong>No integrity events recorded</strong><p>The assessment was completed without monitored incidents.</p></div>}
        </section>
        <div className="exam-result-actions"><button className="button button--secondary" type="button" onClick={resetExam}><RotateCcw /> Retake sample exam</button><button className="button button--primary" type="button" onClick={onExit}>Finish</button></div>
      </main>
    </div>
  );
}
