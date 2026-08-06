import { ExamProvider } from '../context/ExamProvider';
import { useExam } from '../hooks/useExam';
import { EXAM_SESSION_STATES } from '../engine/ExamSession';
import { EnvironmentCheckPage } from './EnvironmentCheckPage';
import { ExamPage } from './ExamPage';
import { ExamResultPage } from './ExamResultPage';
import sampleExam from '../data/sampleExam.json';
import { useSettings } from '../../settings/useSettings';

function ExamScreen({ onExit }) {
  const { session, result } = useExam();
  if (session.state === EXAM_SESSION_STATES.RUNNING) return <ExamPage />;
  if (session.state === EXAM_SESSION_STATES.COMPLETED && result) return <ExamResultPage onExit={onExit} />;
  return <EnvironmentCheckPage onExit={onExit} />;
}

export function ExamExperience({ candidateId, onExit }) {
  const settings = useSettings();
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = settings.appearance.theme === 'system' ? systemTheme : settings.appearance.theme;
  return <div className="exam-experience" data-theme={theme} data-reduced-motion={settings.appearance.reducedMotion}><ExamProvider exam={sampleExam} candidateId={candidateId}><ExamScreen onExit={onExit} /></ExamProvider></div>;
}
