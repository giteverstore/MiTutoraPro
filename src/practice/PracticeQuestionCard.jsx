import { CheckCircle2, Circle, Clock3, Zap } from 'lucide-react';

export function PracticeQuestionCard({ question, solved, onSelect }) {
  return (
    <button className="practice-question-card" type="button" onClick={() => onSelect(question)}>
      <span className={`practice-difficulty is-${question.difficulty}`}>{question.difficulty.replaceAll('_', ' ')}</span>
      <strong>{question.title}</strong>
      <span className="practice-question-topic">{question.topic}</span>
      <span className="practice-question-meta">
        <span><Clock3 /> {question.estimatedMinutes} min</span>
        <span><Zap /> {question.xp} XP</span>
        <span className={solved ? 'is-solved' : ''}>{solved ? <CheckCircle2 /> : <Circle />} {solved ? 'Solved' : 'Unsolved'}</span>
      </span>
    </button>
  );
}
