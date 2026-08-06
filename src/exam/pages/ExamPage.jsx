import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, ShieldCheck } from 'lucide-react';
import { DeveloperSimulator } from '../components/DeveloperSimulator/DeveloperSimulator';
import { WarningDialog } from '../components/WarningDialog/WarningDialog';
import { useExam } from '../hooks/useExam';

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ExamPage() {
  const {
    exam, config, session, integrity, warnings, answers, currentQuestionIndex,
    setCurrentQuestionIndex, answerQuestion, submitExam, emitEvent,
    acknowledgeWarning,
  } = useExam();
  const [remainingTime, setRemainingTime] = useState(session.duration);
  const question = exam.questions[currentQuestionIndex];

  useEffect(() => {
    const updateTimer = () => {
      const next = Math.max(0, session.duration - (Date.now() - session.startTime));
      setRemainingTime(next);
      if (next === 0) submitExam();
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [session.duration, session.startTime, submitExam]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const isLastQuestion = currentQuestionIndex === exam.questions.length - 1;

  return (
    <div className="exam-page exam-running-page">
      <header className="exam-toolbar">
        <div><ShieldCheck aria-hidden="true" /><span><strong>{exam.title}</strong><small>Question {currentQuestionIndex + 1} of {exam.questions.length}</small></span></div>
        <div className="exam-runtime-metrics"><span><ShieldCheck /> Integrity {integrity.score}</span><span className={remainingTime < 60000 ? 'is-urgent' : ''}><Clock3 /> {formatTime(remainingTime)}</span></div>
      </header>
      <main className="exam-workspace">
        <nav className="exam-question-map" aria-label="Exam questions">
          <div><strong>Questions</strong><span>{answeredCount}/{exam.questions.length} answered</span></div>
          <ol>{exam.questions.map((item, index) => (
            <li key={item.id}><button type="button" className={`${index === currentQuestionIndex ? 'is-current' : ''} ${answers[item.id] ? 'is-answered' : ''}`} onClick={() => setCurrentQuestionIndex(index)} aria-label={`Question ${index + 1}${answers[item.id] ? ', answered' : ''}`}>{index + 1}</button></li>
          ))}</ol>
        </nav>
        <section className="exam-question-card" aria-labelledby="exam-question-title">
          <span>Question {currentQuestionIndex + 1}</span>
          <h1 id="exam-question-title">{question.prompt}</h1>
          <fieldset><legend className="sr-only">Choose one answer</legend>{question.options.map((option, index) => (
            <label className={answers[question.id] === option.id ? 'is-selected' : ''} key={option.id}>
              <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => answerQuestion(question.id, option.id)} />
              <span>{String.fromCharCode(65 + index)}</span><strong>{option.label}</strong>
            </label>
          ))}</fieldset>
          <footer>
            <button className="button button--secondary" type="button" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}><ChevronLeft /> Previous</button>
            {isLastQuestion ? <button className="button button--primary" type="button" onClick={submitExam}>Submit exam</button> : <button className="button button--primary" type="button" onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}>Next <ChevronRight /></button>}
          </footer>
        </section>
      </main>
      <WarningDialog warning={warnings.activeWarning} count={warnings.count} maximum={config.integrity.maxWarnings} onAcknowledge={acknowledgeWarning} />
      {import.meta.env.DEV ? <DeveloperSimulator onEmit={emitEvent} /> : null}
    </div>
  );
}
