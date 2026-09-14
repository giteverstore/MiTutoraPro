import { CheckCircle2, Circle, Clock3 } from 'lucide-react';

export function PracticeQuestionCard({ question, solved, onSelect }) {
  return (
    <button className="practice-question-card" type="button" onClick={() => onSelect(question)}>
      <span className="practice-question-title">
        <strong>{question.title}</strong>
        <span className={`practice-difficulty is-${question.difficulty}`}>{question.difficulty.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
      </span>
      <span className="practice-question-topic">{question.topic}</span>
      <span className="practice-question-meta">
        <span><Clock3 /> {question.estimatedMinutes} min</span>
        <span className={solved ? 'is-solved' : ''}>{solved ? <CheckCircle2 /> : <Circle />} {solved ? 'Solved' : 'Unsolved'}</span>
      </span>
    </button>
  );
}
