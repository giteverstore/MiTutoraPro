import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMonitor } from '../detectors/BrowserMonitor';
import { createExamConfig } from '../engine/ExamConfig';
import { ExamSession, EXAM_SESSION_STATES } from '../engine/ExamSession';
import { EventBus } from '../engine/EventBus';
import { IntegrityEngine } from '../engine/IntegrityEngine';
import { WarningManager } from '../engine/WarningManager';
import { ExamEvent, EXAM_EVENT_TYPES } from '../models/ExamEvent';
import { VisionManager } from '../vision/VisionManager';
import { VISION_VERIFICATION_STATUS } from '../models/VisionResult';
import { MonitoringSession, MONITORING_STATUS } from '../monitoring/MonitoringSession';
import { ExamPersistenceCoordinator, EXAM_SYNC_STATUS } from '../services/ExamPersistenceCoordinator';
import { SubmissionCoordinator } from '../services/SubmissionCoordinator';

export const ExamContext = createContext(null);

function resultFromAttempt(attempt, timeline = [], recoveredReport = null) {
  if (!attempt?.examResult || !attempt?.integrityResult) return null;
  return Object.freeze({
    examId: attempt.examId,
    ...attempt.examResult,
    integrityReport: Object.freeze({ ...attempt.integrityResult, ...(attempt.integrityReport ?? recoveredReport ?? {}), timeline: Object.freeze([...timeline]) }),
    submittedAt: attempt.submittedAt,
    certificationDecision: attempt.certificationDecision,
  });
}

export function ExamProvider({ exam, candidateId, certification, config: configOverrides, children }) {
  const config = useMemo(() => createExamConfig(configOverrides), [configOverrides]);
  const eventBusRef = useRef(null); const warningManagerRef = useRef(null); const integrityEngineRef = useRef(null);
  const sessionRef = useRef(null); const visionManagerRef = useRef(null); const visionDestroyTimerRef = useRef(null);
  const monitoringSessionRef = useRef(null); const persistenceRef = useRef(null); const submissionRef = useRef(null); const submittingRef = useRef(false);

  if (!eventBusRef.current) eventBusRef.current = new EventBus();
  if (!warningManagerRef.current) warningManagerRef.current = new WarningManager({ maxWarnings: config.integrity.maxWarnings });
  if (!integrityEngineRef.current) integrityEngineRef.current = new IntegrityEngine({ eventBus: eventBusRef.current, warningManager: warningManagerRef.current, config });
  if (!sessionRef.current) sessionRef.current = new ExamSession({ examId: exam.id, candidateId, duration: exam.durationMs ?? exam.durationMinutes * 60000 });
  if (!visionManagerRef.current) visionManagerRef.current = new VisionManager({ eventBus: eventBusRef.current, config, fullscreenRequired: config.browser.fullscreenRequired, durationMs: config.vision.verificationDurationMs, stabilityDurationMs: config.vision.stabilityDurationMs });
  if (!monitoringSessionRef.current) monitoringSessionRef.current = new MonitoringSession({ eventBus: eventBusRef.current, config, detectors: { vision: visionManagerRef.current, browser: new BrowserMonitor({ eventBus: eventBusRef.current, config }) }, onLifecycleEvent: (event, change) => integrityEngineRef.current.processLifecycleEvent(event, change) });

  const recovered = certification.recoveredState?.responses;
  const [session, setSession] = useState(sessionRef.current.getSnapshot());
  const [integrity, setIntegrity] = useState(integrityEngineRef.current.getSnapshot());
  const [warnings, setWarnings] = useState(warningManagerRef.current.getSnapshot());
  const [answers, setAnswers] = useState(recovered?.answers ?? {});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(Math.max(0, exam.questions.findIndex(({ id }) => id === recovered?.currentQuestionId)));
  const [result, setResult] = useState(() => resultFromAttempt(certification.attempt, certification.recoveredState?.integrityEvents, certification.recoveredState?.integrityReport));
  const [vision, setVision] = useState(visionManagerRef.current.getSnapshot());
  const [monitoring, setMonitoring] = useState(monitoringSessionRef.current.getSnapshot());
  const [sync, setSync] = useState({ status: EXAM_SYNC_STATUS.SYNCED, message: '' });
  const [submissionStatus, setSubmissionStatus] = useState('idle');
  const [verificationCompletion, setVerificationCompletion] = useState({ status: 'idle', message: '' });
  const recoveryHydratedRef = useRef(false);
  const verificationRequestRef = useRef(null);

  useEffect(() => { integrityEngineRef.current.start(); return () => integrityEngineRef.current.dispose(); }, []);
  useEffect(() => sessionRef.current.subscribe(setSession), []);
  useEffect(() => integrityEngineRef.current.subscribe(setIntegrity), []);
  useEffect(() => warningManagerRef.current.subscribe(setWarnings), []);
  useEffect(() => visionManagerRef.current.subscribe(setVision), []);
  useEffect(() => monitoringSessionRef.current.subscribe(setMonitoring), []);
  useEffect(() => eventBusRef.current.subscribe((event) => { if (event.type === EXAM_EVENT_TYPES.CUSTOM && event.metadata.action === 'DEVELOPER_RESET') { integrityEngineRef.current.reset(); if (monitoringSessionRef.current.status === MONITORING_STATUS.RUNNING) monitoringSessionRef.current.reset(); } }), []);
  useEffect(() => {
    const events = certification.recoveredState?.integrityEvents;
    if (!recoveryHydratedRef.current && events?.length) {
      recoveryHydratedRef.current = true;
      monitoringSessionRef.current.restore(events);
    }
  }, [certification.recoveredState?.integrityEvents]);

  useEffect(() => {
    const attempt = certification.attempt; if (!attempt) return;
    if (['CREATED', 'SCHEDULED', 'VERIFYING'].includes(attempt.state)) {
      if (sessionRef.current.state === EXAM_SESSION_STATES.IDLE) {
        setSession(sessionRef.current.transition(EXAM_SESSION_STATES.ENVIRONMENT_CHECK));
      }
    } else if (attempt.state === 'READY') {
      if (sessionRef.current.state === EXAM_SESSION_STATES.IDLE) {
        sessionRef.current.transition(EXAM_SESSION_STATES.ENVIRONMENT_CHECK);
      }
      if (sessionRef.current.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK) {
        setSession(sessionRef.current.transition(EXAM_SESSION_STATES.READY));
      }
    } else if (attempt.state === 'RUNNING') {
      setSession(sessionRef.current.restore({ state: EXAM_SESSION_STATES.RUNNING, startTime: attempt.startedAt }));
    } else if (attempt.state === 'FINALIZED') {
      setSession(sessionRef.current.restore({ state: EXAM_SESSION_STATES.COMPLETED, startTime: attempt.startedAt, endTime: attempt.finalizedAt }));
      setResult(resultFromAttempt(attempt, certification.recoveredState?.integrityEvents, certification.recoveredState?.integrityReport));
    }
  }, [certification.attempt, certification.recoveredState?.integrityEvents]);

  useEffect(() => {
    if (visionDestroyTimerRef.current) globalThis.clearTimeout(visionDestroyTimerRef.current);
    if ([EXAM_SESSION_STATES.ENVIRONMENT_CHECK, EXAM_SESSION_STATES.READY].includes(session.state)) visionManagerRef.current.start();
    else if ([EXAM_SESSION_STATES.IDLE, EXAM_SESSION_STATES.COMPLETED].includes(session.state)) visionManagerRef.current.stop();
  }, [session.state]);

  useEffect(() => {
    if (session.state === EXAM_SESSION_STATES.RUNNING) { integrityEngineRef.current.setLifecycleMode(true); monitoringSessionRef.current.start(); }
    else { monitoringSessionRef.current.stop(); integrityEngineRef.current.setLifecycleMode(false); }
    return () => monitoringSessionRef.current.stop();
  }, [session.state]);

  const completeEnvironmentVerification = useCallback(async () => {
    if (!vision.summary || verificationRequestRef.current) return verificationRequestRef.current;
    setVerificationCompletion({ status: 'submitting', message: 'Confirming verification…' });
    const request = certification.completeVerification(vision.summary)
      .then((attempt) => {
        if (attempt.state !== 'READY') throw new Error(`Verification returned an unexpected attempt state: ${attempt.state}.`);
        if (sessionRef.current.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK) {
          setSession(sessionRef.current.transition(EXAM_SESSION_STATES.READY));
        }
        setVerificationCompletion({ status: 'ready', message: '' });
        return attempt;
      })
      .catch((error) => {
        setVerificationCompletion({ status: 'error', message: error.message });
        setSync({ status: EXAM_SYNC_STATUS.ERROR, message: error.message });
        throw error;
      })
      .finally(() => { verificationRequestRef.current = null; });
    verificationRequestRef.current = request;
    return request;
  }, [certification.completeVerification, vision.summary]);

  useEffect(() => {
    if (vision.status === VISION_VERIFICATION_STATUS.VERIFIED
      && session.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK
      && verificationCompletion.status === 'idle') {
      completeEnvironmentVerification().catch(() => {});
    }
  }, [completeEnvironmentVerification, session.state, verificationCompletion.status, vision.status]);

  useEffect(() => {
    const attempt = certification.attempt;
    if (attempt?.state !== 'RUNNING' || !attempt.sessionId) return undefined;
    const persistence = new ExamPersistenceCoordinator({ service: certification.service, attemptId: attempt.id, sessionId: attempt.sessionId, revision: recovered?.revision ?? attempt.responseRevision ?? 0, onStatus: setSync });
    persistence.startHeartbeat(attempt.heartbeatSequence ?? 0); persistenceRef.current = persistence;
    submissionRef.current = new SubmissionCoordinator({ service: certification.service, persistence, attemptId: attempt.id, sessionId: attempt.sessionId });
    return () => { persistence.destroy(); if (persistenceRef.current === persistence) persistenceRef.current = null; submissionRef.current = null; };
  }, [certification.attempt?.heartbeatSequence, certification.attempt?.id, certification.attempt?.responseRevision, certification.attempt?.sessionId, certification.attempt?.state, certification.service, recovered?.revision]);

  useEffect(() => { if (session.state === EXAM_SESSION_STATES.RUNNING) persistenceRef.current?.scheduleResponses(answers, exam.questions[currentQuestionIndex]?.id); }, [answers, currentQuestionIndex, exam.questions, session.state]);
  useEffect(() => { if (session.state === EXAM_SESSION_STATES.RUNNING) persistenceRef.current?.scheduleIntegrityEvents(monitoring.timeline); }, [monitoring.timeline, session.state]);
  useEffect(() => () => { visionDestroyTimerRef.current = globalThis.setTimeout(() => { monitoringSessionRef.current.destroy(); eventBusRef.current.clear(); }, 0); }, []);

  const beginEnvironmentCheck = useCallback(() => {
    if (sessionRef.current.state === EXAM_SESSION_STATES.IDLE) {
      setSession(sessionRef.current.transition(EXAM_SESSION_STATES.ENVIRONMENT_CHECK));
    }
  }, []);
  const startExam = useCallback(async () => { const attempt = await certification.startAttempt(); setSession(sessionRef.current.restore({ state: EXAM_SESSION_STATES.RUNNING, startTime: attempt.startedAt })); return attempt; }, [certification.startAttempt]);
  const answerQuestion = useCallback((questionId, optionId) => setAnswers((current) => ({ ...current, [questionId]: optionId })), []);

  const submitExam = useCallback(async (reason = 'MANUAL') => {
    if (sessionRef.current.state !== EXAM_SESSION_STATES.RUNNING || submittingRef.current) return submissionRef.current?.promise ?? null;
    submittingRef.current = true; setSubmissionStatus('submitting'); monitoringSessionRef.current.stop(); integrityEngineRef.current.setLifecycleMode(false);
    try {
      persistenceRef.current?.scheduleResponses(answers, exam.questions[currentQuestionIndex]?.id);
      persistenceRef.current?.scheduleIntegrityEvents(monitoringSessionRef.current.getSnapshot().timeline);
      const finalized = await submissionRef.current.submit(reason); certification.updateAttempt(finalized);
      const generated = resultFromAttempt(finalized, monitoringSessionRef.current.getSnapshot().timeline); setResult(generated);
      sessionRef.current.restore({ state: EXAM_SESSION_STATES.COMPLETED, startTime: finalized.startedAt, endTime: finalized.finalizedAt }); setSubmissionStatus('complete'); return generated;
    } catch (error) { setSubmissionStatus('error'); setSync({ status: EXAM_SYNC_STATUS.ERROR, message: error.message }); monitoringSessionRef.current.start(); throw error; }
    finally { submittingRef.current = false; }
  }, [answers, certification.updateAttempt, currentQuestionIndex, exam.questions]);

  const cancelExam = useCallback(async () => {
    if (sessionRef.current.state !== EXAM_SESSION_STATES.RUNNING) return;
    monitoringSessionRef.current.stop(); integrityEngineRef.current.setLifecycleMode(false);
    const abandoned = await certification.service.abandon(certification.attempt.id, certification.attempt.sessionId); certification.updateAttempt(abandoned);
    sessionRef.current.restore({ state: EXAM_SESSION_STATES.COMPLETED, startTime: abandoned.startedAt, endTime: abandoned.finalizedAt });
    setResult(Object.freeze({ examId: exam.id, cancelled: true, score: 0, correctAnswers: 0, totalQuestions: exam.questions.length, integrityReport: integrityEngineRef.current.createReport(), certificationDecision: abandoned.certificationDecision, submittedAt: Date.now() }));
  }, [certification.attempt?.id, certification.attempt?.sessionId, certification.service, certification.updateAttempt, exam]);

  const resetExam = useCallback(async () => {
    const next = await certification.resetAttempt(); integrityEngineRef.current.reset(); monitoringSessionRef.current.reset(); setAnswers({}); setCurrentQuestionIndex(0); setResult(null); setSubmissionStatus('idle');
    sessionRef.current.restore({ state: EXAM_SESSION_STATES.ENVIRONMENT_CHECK, startTime: null, endTime: null }); return next;
  }, [certification.resetAttempt]);

  const emitEvent = useCallback((event) => eventBusRef.current.emit(event instanceof ExamEvent ? event : new ExamEvent(event)), []);
  const attachVerificationVideo = useCallback((element) => visionManagerRef.current.attachVideoElement(element), []);
  const reconnectCamera = useCallback(() => visionManagerRef.current.reconnectCamera(), []);
  const value = useMemo(() => ({ exam, config, session, integrity, warnings, answers, currentQuestionIndex, result, vision, monitoring, sync, submissionStatus, verificationCompletion, expiresAt: certification.attempt?.expiresAt, serverNow: certification.serverNow, beginEnvironmentCheck, completeEnvironmentVerification, startExam, answerQuestion, setCurrentQuestionIndex, submitExam, cancelExam, resetExam, emitEvent, attachVerificationVideo, reconnectCamera, acknowledgeWarning: () => warningManagerRef.current.acknowledge() }), [exam, config, session, integrity, warnings, answers, currentQuestionIndex, result, vision, monitoring, sync, submissionStatus, verificationCompletion, certification.attempt?.expiresAt, certification.serverNow, beginEnvironmentCheck, completeEnvironmentVerification, startExam, answerQuestion, submitExam, cancelExam, resetExam, emitEvent, attachVerificationVideo, reconnectCamera]);
  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}
