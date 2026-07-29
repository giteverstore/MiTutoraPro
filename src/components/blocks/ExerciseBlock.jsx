import { useState } from 'react';
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
  const { exerciseCompletion, completeExercise } = useLearningProgress();
  const exerciseState = exerciseCompletion[blockId] ?? {};
  const isCompleted = Boolean(exerciseState.completed);
  const isVerified = Boolean(exerciseState.verified);

  const startExercise = () => {
    if (isVerified) {
      completeExercise(blockId);
      return;
    }
    if (isStarted) return;
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
      {isStarted || isVerified ? (
        <p className="activity-feedback is-success" role="status">
          {isCompleted
            ? 'Exercise completed and saved locally.'
            : isVerified
              ? 'Output verified. Mark the exercise complete when you are ready.'
              : 'Write your solution, run it, then use Check Output in the workspace.'}
        </p>
      ) : null}
      <button className="button button--primary inline-action" type="button" onClick={startExercise} disabled={isCompleted || (isStarted && !isVerified)}>
        {isCompleted ? 'Completed' : isVerified ? 'Mark Complete' : isStarted ? 'Check output to continue' : actionLabel} <ChevronRight size={ICON_SIZE.base} />
      </button>
    </section>
  );
}
