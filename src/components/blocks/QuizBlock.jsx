import { useState } from 'react';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { useLearningProgress } from '../../progress/LearningProgressContext';

export function QuizBlock({
  kicker,
  title,
  description,
  actionLabel,
  question,
  options = [],
  submitLabel,
  correctOptionIds = [],
  blockId,
  selectionMode = 'single',
  explanation,
}) {
  const { quizScores, recordQuizScore } = useLearningProgress();
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSelection = (optionId) => {
    setIsSubmitted(false);
    setFeedback('');
    setSelectedOptions((current) => selectionMode === 'multiple'
      ? current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      : [optionId]);
  };

  const handleAction = () => {
    if (!selectedOptions.length) {
      setFeedback('Choose an answer before checking.');
      return;
    }

    const correctSelections = selectedOptions.filter((id) =>
      correctOptionIds.includes(id));
    const isCorrect = selectedOptions.length === correctOptionIds.length
      && correctSelections.length === correctOptionIds.length;

    recordQuizScore(
      blockId,
      correctSelections.length,
      correctOptionIds.length,
      isCorrect,
    );
    setIsSubmitted(true);
    setFeedback(
      isCorrect
        ? 'Correct — nicely done.'
        : 'Not quite. Review the lesson and try again.',
    );
  };

  return (
    <section className="card card--elevated card--interactive content-section interactive-card">
      <div className="interactive-icon"><Lightbulb size={ICON_SIZE.lg} /></div>
      <div className="interactive-copy">
        <span className="section-kicker">{kicker || 'Knowledge check'}</span>
        <h3>{question || title}</h3>
        {description ? <p>{description}</p> : null}
        {options.length ? (
          <div className="quiz-options">
            {options.map((option) => (
              <label
                className={`quiz-option ${
                  isSubmitted && correctOptionIds.includes(option.id) ? 'is-correct' : ''
                }`}
                key={option.id}
              >
                <input
                  type={selectionMode === 'multiple' ? 'checkbox' : 'radio'}
                  name={`quiz-${blockId}`}
                  value={option.id}
                  checked={selectedOptions.includes(option.id)}
                  onChange={() => handleSelection(option.id)}
                />
                <span>{option.text}</span>
              </label>
            ))}
            {feedback ? (
              <p
                className={`activity-feedback ${feedback.startsWith('Correct') ? 'is-success' : ''}`}
                role="status"
              >
                {feedback}
              </p>
            ) : null}
            {isSubmitted && explanation ? <p className="quiz-explanation">{explanation}</p> : null}
            {quizScores[blockId] ? (
              <small className="activity-history">
                Latest score: {quizScores[blockId].percentage}% · {quizScores[blockId].attempts}
                {' '}attempt{quizScores[blockId].attempts === 1 ? '' : 's'}
              </small>
            ) : null}
          </div>
        ) : (
          <p className="activity-feedback" role="alert">This quiz has no answer options.</p>
        )}
      </div>
      <button
        className="button button--primary inline-action"
        type="button"
        disabled={!options.length}
        onClick={handleAction}
      >
        {submitLabel || actionLabel || 'Check answer'} <ChevronRight size={ICON_SIZE.base} />
      </button>
    </section>
  );
}
