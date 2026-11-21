import { useState } from 'react';
import { CheckCircle2, ChevronRight, Dumbbell } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { RichText } from '../RichText';
import { useOptionalLearningCompiler } from '../../compiler/LearningCompilerContext';
import { useLearningProgress } from '../../progress/LearningProgressContext';

export function ExerciseBlock({ badge, title, description, instructions, objectives = [], difficulty, hints = [], blockId }) {
  const [isStarted, setIsStarted] = useState(false);
  const learningCompiler = useOptionalLearningCompiler();
  const { exerciseCompletion } = useLearningProgress();
  const exerciseState = exerciseCompletion[blockId] ?? {};
  const startExercise = () => {
    setIsStarted(true);
    learningCompiler?.expand();
    window.requestAnimationFrame(() => {
      const editor = document.querySelector('.compiler-dock .monaco-editor-shell textarea');
      document.querySelector('.compiler-dock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      editor?.focus({ preventScroll: true });
    });
  };

  return (
    <section className="card card--muted card--interactive content-section exercise-card">
      <div className="exercise-top">
        <span className="interactive-icon"><Dumbbell size={ICON_SIZE.lg} /></span>
        <span className="difficulty-pill">{difficulty || badge}</span>
      </div>
      <h3>{title}</h3>
      <RichText content={instructions?.content || description} format={instructions?.format || 'plain'} className="exercise-instructions" />
      <div className="exercise-meta">
        {objectives.map((objective) => <span key={objective}><CheckCircle2 size={ICON_SIZE.sm} /> {objective}</span>)}
      </div>
      {hints.length ? <details className="exercise-hints"><summary>Hints</summary><ul>{hints.map((hint) => <li key={hint}>{hint}</li>)}</ul></details> : null}
      {isStarted || exerciseState.verified ? <p className="activity-feedback is-success" role="status">
        {exerciseState.completed ? 'Exercise passed. Your verified result has been saved.' : 'Write your solution, then use Run. Run also verifies the exercise.'}
      </p> : null}
      {!isStarted && !exerciseState.verified ? <div className="exercise-actions">
        <button className="button button--secondary" type="button" onClick={startExercise}>
          Open Exercise <ChevronRight size={ICON_SIZE.base} />
        </button>
      </div> : null}
    </section>
  );
}
