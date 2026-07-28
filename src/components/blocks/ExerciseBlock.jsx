import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Dumbbell } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { useLearningProgress } from '../../progress/LearningProgressContext';
import { RichText } from '../RichText';

export function ExerciseBlock({
  badge,
  title,
  description,
  instructions,
  objectives = [],
  difficulty,
  hints = [],
  actionLabel,
  blockId,
}) {
  const [isStarted, setIsStarted] = useState(false);
  const [hasSuccessfulRun, setHasSuccessfulRun] = useState(false);
  const { exerciseCompletion, completeExercise } = useLearningProgress();
  const isCompleted = Boolean(exerciseCompletion[blockId]?.completed);

  useEffect(() => {
    if (!isStarted || isCompleted) return undefined;
    const handleExecution = (event) => {
      if (event.detail?.status === 'success') setHasSuccessfulRun(true);
    };
    window.addEventListener('learning-platform:execution-complete', handleExecution);
    return () => window.removeEventListener('learning-platform:execution-complete', handleExecution);
  }, [isCompleted, isStarted]);

  const startExercise = () => {
    if (isStarted) {
      if (!hasSuccessfulRun) return;
      completeExercise(blockId);
      return;
    }
    setIsStarted(true);
    const selector = window.matchMedia('(max-width: 840px)').matches
      ? '.mobile-compiler textarea'
      : '.desktop-compiler textarea';
    const editor = document.querySelector(selector);
    editor?.closest('.compiler-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    editor?.focus({ preventScroll: true });
  };

  return (
    <section className="card card--muted card--interactive content-section exercise-card">
      <div className="exercise-top">
        <span className="interactive-icon"><Dumbbell size={ICON_SIZE.lg} /></span>
        <span className="difficulty-pill">{difficulty || badge}</span>
      </div>
      <h3>{title}</h3>
      <RichText
        content={instructions?.content || description}
        format={instructions?.format || 'plain'}
        className="exercise-instructions"
      />
      <div className="exercise-meta">
        {objectives.map((objective) => (
          <span key={objective}><CheckCircle2 size={ICON_SIZE.sm} /> {objective}</span>
        ))}
      </div>
      {hints.length ? (
        <details className="exercise-hints">
          <summary>Hints</summary>
          <ul>{hints.map((hint) => <li key={hint}>{hint}</li>)}</ul>
        </details>
      ) : null}
      {isStarted ? (
        <p className="activity-feedback is-success" role="status">
          {isCompleted
            ? 'Exercise completed and saved locally.'
            : hasSuccessfulRun
              ? 'Your code ran successfully. You can now mark the exercise complete.'
              : 'Exercise opened. Write your solution in the compiler and run it successfully.'}
        </p>
      ) : null}
      <button className="button button--primary inline-action" type="button" onClick={startExercise} disabled={isCompleted || (isStarted && !hasSuccessfulRun)}>
        {isCompleted ? 'Completed' : isStarted ? hasSuccessfulRun ? 'Mark complete' : 'Run code to continue' : actionLabel} <ChevronRight size={ICON_SIZE.base} />
      </button>
    </section>
  );
}
