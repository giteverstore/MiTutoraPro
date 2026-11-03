import { useCallback, useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function QuizBlock({ kicker, title, description, question, options = [], correctOptionIds = [], blockId, selectionMode = 'single', explanation, validationRef }) {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSelection = (optionId) => {
    setIsSubmitted(false);
    setFeedback('');
    setSelectedOptions((current) => selectionMode === 'multiple'
      ? current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
      : [optionId]);
  };

  const validateSelection = useCallback(() => {
    if (!selectedOptions.length) {
      setFeedback('Choose an answer before checking.');
      return false;
    }
    const correctSelections = selectedOptions.filter((id) => correctOptionIds.includes(id));
    const isCorrect = selectedOptions.length === correctOptionIds.length
      && correctSelections.length === correctOptionIds.length;
    setIsSubmitted(true);
    setFeedback(isCorrect ? '' : 'Not quite. Review the lesson and try again.');
    return isCorrect;
  }, [correctOptionIds, selectedOptions]);

  useEffect(() => {
    if (!validationRef) return undefined;
    validationRef.current = validateSelection;
    return () => {
      if (validationRef.current === validateSelection) validationRef.current = null;
    };
  }, [validateSelection, validationRef]);

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
              <label className={`quiz-option ${isSubmitted && correctOptionIds.includes(option.id) ? 'is-correct' : ''}`} key={option.id}>
                <input type={selectionMode === 'multiple' ? 'checkbox' : 'radio'} name={`quiz-${blockId}`} value={option.id} checked={selectedOptions.includes(option.id)} onChange={() => handleSelection(option.id)} />
                <span>{option.text}</span>
              </label>
            ))}
            {feedback ? <p className="activity-feedback" role="status">{feedback}</p> : null}
            {isSubmitted && feedback && explanation ? <p className="quiz-explanation">{explanation}</p> : null}
          </div>
        ) : <p className="activity-feedback" role="alert">This quiz has no answer options.</p>}
      </div>
    </section>
  );
}
