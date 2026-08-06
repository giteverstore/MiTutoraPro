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

export const ExamContext = createContext(null);

export function ExamProvider({ exam, candidateId, config: configOverrides, children }) {
  const config = useMemo(() => createExamConfig(configOverrides), [configOverrides]);
  const eventBusRef = useRef(null);
  const warningManagerRef = useRef(null);
  const integrityEngineRef = useRef(null);
  const sessionRef = useRef(null);
  const visionManagerRef = useRef(null);
  const visionDestroyTimerRef = useRef(null);

  if (!eventBusRef.current) eventBusRef.current = new EventBus();
  if (!warningManagerRef.current) {
    warningManagerRef.current = new WarningManager({ maxWarnings: config.integrity.maxWarnings });
  }
  if (!integrityEngineRef.current) {
    integrityEngineRef.current = new IntegrityEngine({
      eventBus: eventBusRef.current,
      warningManager: warningManagerRef.current,
      config,
    });
  }
  if (!sessionRef.current) {
    sessionRef.current = new ExamSession({
      examId: exam.id,
      candidateId,
      duration: exam.durationMinutes * 60 * 1000,
    });
  }
  if (!visionManagerRef.current) {
    visionManagerRef.current = new VisionManager({
      eventBus: eventBusRef.current,
      fullscreenRequired: config.browser.fullscreenRequired,
      durationMs: config.vision.verificationDurationMs,
      stabilityDurationMs: config.vision.stabilityDurationMs,
    });
  }

  const [session, setSession] = useState(sessionRef.current.getSnapshot());
  const [integrity, setIntegrity] = useState(integrityEngineRef.current.getSnapshot());
  const [warnings, setWarnings] = useState(warningManagerRef.current.getSnapshot());
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [vision, setVision] = useState(visionManagerRef.current.getSnapshot());

  useEffect(() => {
    integrityEngineRef.current.start();
    return () => integrityEngineRef.current.dispose();
  }, []);
  useEffect(() => sessionRef.current.subscribe(setSession), []);
  useEffect(() => integrityEngineRef.current.subscribe(setIntegrity), []);
  useEffect(() => warningManagerRef.current.subscribe(setWarnings), []);
  useEffect(() => visionManagerRef.current.subscribe(setVision), []);
  useEffect(() => eventBusRef.current.subscribe((event) => {
    if (event.type === EXAM_EVENT_TYPES.CUSTOM && event.metadata.action === 'DEVELOPER_RESET') {
      integrityEngineRef.current.reset();
      visionManagerRef.current.reset();
    }
  }), []);

  useEffect(() => {
    const monitor = new BrowserMonitor({ eventBus: eventBusRef.current, config });
    if (session.state === EXAM_SESSION_STATES.RUNNING) monitor.start();
    return () => monitor.stop();
  }, [config, session.state]);

  useEffect(() => {
    if (visionDestroyTimerRef.current) globalThis.clearTimeout(visionDestroyTimerRef.current);
    if (session.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK) {
      visionManagerRef.current.start();
    } else {
      visionManagerRef.current.stop();
    }
    return () => visionManagerRef.current.stop();
  }, [session.state]);

  useEffect(() => {
    if (vision.status === VISION_VERIFICATION_STATUS.VERIFIED
      && sessionRef.current.state === EXAM_SESSION_STATES.ENVIRONMENT_CHECK) {
      sessionRef.current.transition(EXAM_SESSION_STATES.READY);
    }
  }, [vision.status]);

  useEffect(() => () => {
    visionDestroyTimerRef.current = globalThis.setTimeout(() => visionManagerRef.current.destroy(), 0);
  }, []);

  useEffect(() => () => eventBusRef.current.clear(), []);

  const beginEnvironmentCheck = useCallback(() => {
    sessionRef.current.transition(EXAM_SESSION_STATES.ENVIRONMENT_CHECK);
  }, []);

  const markEnvironmentReady = useCallback(() => {
    sessionRef.current.transition(EXAM_SESSION_STATES.READY);
  }, []);

  const startExam = useCallback(() => {
    sessionRef.current.transition(EXAM_SESSION_STATES.RUNNING);
  }, []);

  const answerQuestion = useCallback((questionId, optionId) => {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  }, []);

  const submitExam = useCallback(() => {
    if (sessionRef.current.state !== EXAM_SESSION_STATES.RUNNING) return null;
    sessionRef.current.transition(EXAM_SESSION_STATES.COMPLETED);
    const correctAnswers = exam.questions.reduce(
      (score, question) => score + (answers[question.id] === question.correctOptionId ? 1 : 0),
      0,
    );
    const integrityReport = integrityEngineRef.current.createReport();
    const generatedResult = Object.freeze({
      examId: exam.id,
      score: Math.round((correctAnswers / exam.questions.length) * 100),
      correctAnswers,
      totalQuestions: exam.questions.length,
      answers: Object.freeze({ ...answers }),
      integrityReport,
      submittedAt: Date.now(),
    });
    setResult(generatedResult);
    return generatedResult;
  }, [answers, exam]);

  const resetExam = useCallback(() => {
    if (sessionRef.current.state === EXAM_SESSION_STATES.COMPLETED) {
      sessionRef.current.transition(EXAM_SESSION_STATES.IDLE);
    }
    integrityEngineRef.current.reset();
    setAnswers({});
    setCurrentQuestionIndex(0);
    setResult(null);
    sessionRef.current.transition(EXAM_SESSION_STATES.ENVIRONMENT_CHECK);
  }, []);

  const emitEvent = useCallback((event) => eventBusRef.current.emit(
    event instanceof ExamEvent ? event : new ExamEvent(event),
  ), []);
  const attachVerificationVideo = useCallback(
    (element) => visionManagerRef.current.attachVideoElement(element),
    [],
  );
  const reconnectCamera = useCallback(() => visionManagerRef.current.reconnectCamera(), []);

  const value = useMemo(() => ({
    exam,
    config,
    session,
    integrity,
    warnings,
    answers,
    currentQuestionIndex,
    result,
    vision,
    beginEnvironmentCheck,
    markEnvironmentReady,
    startExam,
    answerQuestion,
    setCurrentQuestionIndex,
    submitExam,
    resetExam,
    emitEvent,
    attachVerificationVideo,
    reconnectCamera,
    acknowledgeWarning: () => warningManagerRef.current.acknowledge(),
  }), [
    exam, config, session, integrity, warnings, answers, currentQuestionIndex, result, vision,
    beginEnvironmentCheck, markEnvironmentReady, startExam, answerQuestion,
    submitExam, resetExam, emitEvent, attachVerificationVideo, reconnectCamera,
  ]);

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}
