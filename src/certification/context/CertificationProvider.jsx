import { useCallback, useEffect, useMemo, useState } from 'react';
import { certificationService as defaultService } from '../services/CertificationService';
import { CertificationContext } from './CertificationContext';

const sessionKey = (attemptId) => `mitutora:exam-session:${attemptId}`;

export function CertificationProvider({ candidateId, courseId, examId, service = defaultService, children }) {
  const [exam, setExam] = useState(null); const [attempt, setAttempt] = useState(null); const [recoveredState, setRecoveredState] = useState(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [status, setStatus] = useState('loading'); const [message, setMessage] = useState('Preparing your certification exam…'); const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [candidateExam, eligibility] = await Promise.all([service.getCandidateExam(examId), service.getStatus(courseId)]);
        if (!active) return; setExam({ ...candidateExam, durationMinutes: Math.ceil(candidateExam.durationMs / 60000) });
        let current;
        if (eligibility.activeAttemptId) {
          setMessage('Recovering your exam…');
          const restored = await service.getAttempt(eligibility.activeAttemptId); current = restored.attempt; setRecoveredState({ responses: restored.responses, integrityEvents: restored.integrityEvents, integrityReport: restored.integrityReport });
          if (current.state === 'RUNNING') {
            const previousSession = globalThis.sessionStorage?.getItem(sessionKey(current.id));
            current = await service.acquireLease(current.id, previousSession);
            setClockOffsetMs((current.updatedAt ?? Date.now()) - Date.now());
            globalThis.sessionStorage?.setItem(sessionKey(current.id), current.sessionId);
            setMessage('Exam recovered');
          }
        } else current = await service.createAttempt({ courseId, examId });
        if (['CREATED', 'SCHEDULED'].includes(current.state)) current = await service.beginVerification(current.id);
        if (!active) return; setAttempt(current); setStatus('ready');
      } catch (loadError) { if (active) { setError(loadError); setStatus('error'); setMessage(loadError.message); } }
    })();
    return () => { active = false; };
  }, [candidateId, courseId, examId, service]);

  const completeVerification = useCallback(async (summary) => { const next = await service.completeVerification(attempt.id, summary); setAttempt(next); return next; }, [attempt?.id, service]);
  const startAttempt = useCallback(async () => { const next = await service.startAttempt(attempt.id); globalThis.sessionStorage?.setItem(sessionKey(next.id), next.sessionId); setClockOffsetMs((next.updatedAt ?? Date.now()) - Date.now()); setAttempt(next); return next; }, [attempt?.id, service]);
  const resetAttempt = useCallback(async () => { let next = await service.createAttempt({ courseId, examId }); if (['CREATED', 'SCHEDULED'].includes(next.state)) next = await service.beginVerification(next.id); setRecoveredState(null); setAttempt(next); return next; }, [courseId, examId, service]);
  const updateAttempt = useCallback((next) => setAttempt(next), []);
  const serverNow = useCallback(() => Date.now() + clockOffsetMs, [clockOffsetMs]);
  const value = useMemo(() => ({ candidateId, courseId, examId, exam, attempt, recoveredState, status, message, error, service, serverNow, completeVerification, startAttempt, resetAttempt, updateAttempt }), [candidateId, courseId, examId, exam, attempt, recoveredState, status, message, error, service, serverNow, completeVerification, startAttempt, resetAttempt, updateAttempt]);
  return <CertificationContext.Provider value={value}>{children}</CertificationContext.Provider>;
}
