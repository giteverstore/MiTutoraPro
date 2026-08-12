import { ExamProvider } from '../context/ExamProvider';
import { useExam } from '../hooks/useExam';
import { EXAM_SESSION_STATES } from '../engine/ExamSession';
import { EnvironmentCheckPage } from './EnvironmentCheckPage';
import { ExamPage } from './ExamPage';
import { ExamResultPage } from './ExamResultPage';
import { useSettings } from '../../settings/useSettings';
import { CertificationProvider } from '../../certification/context/CertificationProvider';
import { useCertification } from '../../certification/hooks/useCertification';

function ExamScreen({ onExit }) {
  const { session, result } = useExam();
  if (session.state === EXAM_SESSION_STATES.RUNNING) return <ExamPage />;
  if (session.state === EXAM_SESSION_STATES.COMPLETED && result) return <ExamResultPage onExit={onExit} />;
  return <EnvironmentCheckPage onExit={onExit} />;
}

function CertificationRuntime({ candidateId, onExit }) {
  const certification = useCertification();
  if (certification.status === 'loading') return <div className="exam-page exam-recovery-state" role="status"><div className="exam-card"><h1>Recovering your exam…</h1><p>{certification.message}</p></div></div>;
  if (certification.status === 'error') return <div className="exam-page exam-recovery-state" role="alert"><div className="exam-card"><h1>Your exam session could not be recovered.</h1><p>{certification.error?.message}</p><button className="button button--secondary" type="button" onClick={onExit}>Back to certificates</button></div></div>;
  return <ExamProvider exam={certification.exam} candidateId={candidateId} certification={certification}><ExamScreen onExit={onExit} /></ExamProvider>;
}

export function ExamExperience({ candidateId, courseId = 'python', examId = 'python-foundations-certification', onExit }) {
  const settings = useSettings();
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = settings.appearance.theme === 'system' ? systemTheme : settings.appearance.theme;
  return <div className="exam-experience" data-theme={theme} data-reduced-motion={settings.appearance.reducedMotion}><CertificationProvider candidateId={candidateId} courseId={courseId} examId={examId}><CertificationRuntime candidateId={candidateId} onExit={onExit} /></CertificationProvider></div>;
}
