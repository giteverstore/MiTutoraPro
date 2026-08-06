import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { EnvironmentCheck } from '../components/EnvironmentCheck/EnvironmentCheck';
import { useExam } from '../hooks/useExam';
import { EXAM_SESSION_STATES } from '../engine/ExamSession';

export function EnvironmentCheckPage({ onExit }) {
  const {
    exam, config, session, vision, beginEnvironmentCheck, startExam,
    attachVerificationVideo, reconnectCamera, emitEvent,
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
        {session.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK ? (
          <EnvironmentCheck
            vision={vision}
            config={config}
            onAttachVideo={attachVerificationVideo}
            onReconnectCamera={reconnectCamera}
            onEmit={emitEvent}
          />
        ) : (
          <section className="exam-card exam-ready-card">
            <ShieldCheck aria-hidden="true" />
            <h2>Your environment is ready</h2>
            <p>The timer begins when you start. Your answers are submitted when time expires.</p>
            <button className="button button--primary" type="button" onClick={startExam}>Start certification exam</button>
          </section>
        )}
      </main>
    </div>
  );
}
