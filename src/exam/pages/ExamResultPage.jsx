import { CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react';
import { useExam } from '../hooks/useExam';

const outcomeCopy = Object.freeze({
  NOT_CERTIFIED: { label: 'Certification not passed', message: 'Your exam score did not meet the certification requirements.' },
  REVIEW_REQUIRED: { label: 'Review required', message: 'Your certification result requires review before it can be confirmed.' },
  INCOMPLETE: { label: 'Incomplete', message: 'The attempt did not reach a valid final submission.' },
});

export function ExamResultPage({ onExit, onViewCertificate }) {
  const { exam, result, resetExam } = useExam();
  const decision = result.certificationDecision?.status ?? 'INCOMPLETE';
  const certified = decision === 'CERTIFIED';

  if (certified) return <div className="exam-page exam-result-page">
    <main className="exam-result-main exam-result-main--minimal">
      <section className="exam-result-confirmation is-passed">
        <CheckCircle2 aria-hidden="true" />
        <h1>Certified</h1>
        <p>Congratulations! Your ycoders certification has been issued.</p>
        <small>{exam.title}</small>
        <div className="exam-result-actions">
          <button className="button button--primary" type="button" onClick={() => onViewCertificate(result.certificateId)} disabled={!result.certificateId}>View Certificate</button>
          <button className="button button--secondary" type="button" onClick={onExit}>Back to Certificates</button>
        </div>
      </section>
    </main>
  </div>;

  const outcome = outcomeCopy[decision] ?? outcomeCopy.INCOMPLETE;
  return <div className="exam-page exam-result-page">
    <main className="exam-result-main exam-result-main--minimal">
      <section className="exam-result-confirmation is-review">
        <ShieldAlert aria-hidden="true" />
        <h1>{outcome.label}</h1><p>{outcome.message}</p>
        <div className="exam-result-actions">
          {decision === 'NOT_CERTIFIED' ? <button className="button button--secondary" type="button" onClick={resetExam}><RotateCcw /> Start another attempt</button> : null}
          <button className="button button--primary" type="button" onClick={onExit}>Back to Certificates</button>
        </div>
      </section>
    </main>
  </div>;
}
