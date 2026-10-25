import { useState } from 'react';
import { CheckCircle2, ChevronRight, Dumbbell } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { useLearningProgress } from '../../progress/LearningProgressContext';
import { RichText } from '../RichText';
import { useOptionalLearningCompiler } from '../../compiler/LearningCompilerContext';
import { CompletionCelebration } from '../CompletionCelebration';

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
  const [celebration, setCelebration] = useState(null);
  const learningCompiler = useOptionalLearningCompiler();
  const { exerciseCompletion, completeExercise } = useLearningProgress();
  const exerciseState = exerciseCompletion[blockId] ?? {};
  const isCompleted = Boolean(exerciseState.completed);
  const startExercise = () => {
    setIsStarted(true);
    learningCompiler?.expand();
    window.requestAnimationFrame(() => {
      const editor = document.querySelector('.compiler-dock .monaco-editor-shell textarea');
      document.querySelector('.compiler-dock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      editor?.focus({ preventScroll: true });
    });
  };
  const finishExercise = () => {
    if (isCompleted) return;
    completeExercise(blockId);
    setCelebration({ blockId, completedAt: Date.now() });
  };

  return (
    <section className="card card--muted card--interactive content-section exercise-card">
      <CompletionCelebration event={celebration} />
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
      {isStarted || isCompleted ? (
        <p className="activity-feedback is-success" role="status">
          {isCompleted ? 'Exercise completed and saved locally.' : 'Use the compiler to practice, then mark the exercise complete when you are ready.'}
        </p>
      ) : null}
      <div className="exercise-actions">
        <button className="button button--secondary" type="button" onClick={startExercise}>
          {actionLabel ?? 'Open compiler'} <ChevronRight size={ICON_SIZE.base} />
        </button>
        <button className="button button--primary inline-action" type="button" onClick={finishExercise} disabled={isCompleted}>
          {isCompleted ? 'Completed' : 'Mark Complete'} <CheckCircle2 size={ICON_SIZE.base} />
        </button>
      </div>
    </section>
  );
}
