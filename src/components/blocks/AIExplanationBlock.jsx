import { useState } from 'react';
import { Bot } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function AIExplanationBlock({
  kicker,
  title,
  description,
  context,
  actionLabel,
  suggestedPrompts = [],
  disclaimer,
}) {
  const [isExplained, setIsExplained] = useState(false);

  return (
    <section className="card card--accent card--interactive content-section ai-card">
      <div className="ai-heading">
        <span className="ai-icon"><Bot size={ICON_SIZE.lg} /></span>
        <div>
          <span className="section-kicker">{kicker}</span>
          <h3>{title}</h3>
        </div>
      </div>
      <p>{context || description}</p>
      {suggestedPrompts.length ? (
        <div className="ai-prompts">
          {suggestedPrompts.map((prompt) => <span key={prompt}>{prompt}</span>)}
        </div>
      ) : null}
      {disclaimer ? <small className="ai-disclaimer">{disclaimer}</small> : null}
      {isExplained ? (
        <div className="ai-local-response" role="status">
          <strong>Local explanation</strong>
          <p>{context || description || 'Break the concept into small steps, inspect the example, and test one change at a time.'}</p>
          {suggestedPrompts[0] ? <small>Try next: {suggestedPrompts[0]}</small> : null}
        </div>
      ) : null}
      <button className="button button--ghost ghost-action" type="button" onClick={() => setIsExplained((value) => !value)}>
        {isExplained ? 'Hide explanation' : actionLabel}
      </button>
    </section>
  );
}
