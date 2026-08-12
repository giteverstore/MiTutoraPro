import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { EnvironmentCheck } from '../components/EnvironmentCheck/EnvironmentCheck';
import { useExam } from '../hooks/useExam';
import { EXAM_SESSION_STATES } from '../engine/ExamSession';
import { VerificationSummary } from '../components/VerificationSummary/VerificationSummary';

export function EnvironmentCheckPage({ onExit }) {
  const {
    exam, config, session, vision, beginEnvironmentCheck, startExam,
    attachVerificationVideo, reconnectCamera, emitEvent,
    verificationCompletion, completeEnvironmentVerification,
  } = useExam();

  useEffect(() => {
    if (session.state === EXAM_SESSION_STATES.IDLE) beginEnvironmentCheck();
  }, [beginEnvironmentCheck, session.state]);

  return (
    <div className="exam-page exam-environment-page">
      <header className="exam-page-header">
        <button className="button button--ghost" type="button" onClick={onExit}>Back to certificates</button>
        <div className="exam-brand"><ShieldCheck aria-hidden="true" /><span>MiTutora Certification</span></div>
      </header>
      <main className="exam-environment-main exam-vision-main">
        <div className="exam-intro">
          <span>Certification assessment</span>
          <h1>{exam.title}</h1>
          <p>{exam.description}</p>
          <dl><div><dt>Questions</dt><dd>{exam.questions.length}</dd></div><div><dt>Duration</dt><dd>{exam.durationMinutes} minutes</dd></div><div><dt>Pass mark</dt><dd>{exam.passingScore}%</dd></div></dl>
        </div>
        {session.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK && verificationCompletion.status === 'error' ? (
          <section className="exam-card exam-recovery-state" role="alert">
            <ShieldCheck aria-hidden="true" />
            <h2>Verification could not be completed.</h2>
            <p>{verificationCompletion.message}</p>
            <button className="button button--primary" type="button" onClick={() => completeEnvironmentVerification().catch(() => {})}>Retry verification</button>
          </section>
        ) : session.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK && verificationCompletion.status === 'submitting' ? (
          <section className="exam-card exam-recovery-state" role="status">
            <ShieldCheck aria-hidden="true" />
            <h2>Confirming environment verification&hellip;</h2>
            <p>The verified results are being recorded securely before the exam can begin.</p>
          </section>
        ) : session.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK ? (
          <EnvironmentCheck
            vision={vision}
            config={config}
            onAttachVideo={attachVerificationVideo}
            onReconnectCamera={reconnectCamera}
            onEmit={emitEvent}
          />
        ) : session.state === EXAM_SESSION_STATES.READY && vision.summary ? (
          <VerificationSummary
            summary={vision.summary}
            action={<button className="button button--primary" type="button" onClick={startExam}>Start certification exam</button>}
          />
        ) : session.state === EXAM_SESSION_STATES.READY ? (
          <section className="exam-card exam-recovery-state" aria-labelledby="recovered-verification-title">
            <ShieldCheck aria-hidden="true" />
            <h2 id="recovered-verification-title">Environment verification completed</h2>
            <p>Your verified certification attempt is ready to continue.</p>
            <button className="button button--primary" type="button" onClick={startExam}>Start certification exam</button>
          </section>
        ) : (
          <section className="exam-card exam-recovery-state" role="status">
            <h2>Preparing environment verification&hellip;</h2>
            <p>Your certification attempt is being restored. If this state persists, return to certificates and try again.</p>
          </section>
        )}
      </main>
    </div>
  );
}
