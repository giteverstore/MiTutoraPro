function LineRange({ reference }) {
  const label = reference.startLine === reference.endLine
    ? `Line ${reference.startLine}`
    : `Lines ${reference.startLine}–${reference.endLine}`;
  return <span className="ai-tutor-line-range">{label}</span>;
}

export function AITutorResponse({ response, stale = false }) {
  return (
    <article className="ai-tutor-structured-response" aria-label="AI Tutor explanation">
      {stale ? <p className="ai-tutor-stale" role="status">This explanation is based on an earlier code or compiler snapshot.</p> : null}
      <p className="ai-tutor-summary">{response.summary}</p>
      {response.evidence.note ? <p className="ai-tutor-evidence"><strong>Evidence:</strong> {response.evidence.note}</p> : null}

      {response.sections.map((section, index) => (
        <section className="ai-tutor-response-section" key={`${section.title}-${index}`}>
          <h4>{section.title}</h4>
          <p>{section.body}</p>
        </section>
      ))}

      {response.codeReferences.length ? (
        <section className="ai-tutor-response-section">
          <h4>Code references</h4>
          <ul className="ai-tutor-response-list">
            {response.codeReferences.map((reference, index) => (
              <li key={`${reference.startLine}-${reference.endLine}-${index}`}>
                <LineRange reference={reference} />
                <span>{reference.explanation}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {response.concepts.length ? (
        <section className="ai-tutor-response-section">
          <h4>Key concepts</h4>
          <dl className="ai-tutor-concepts">
            {response.concepts.map((concept, index) => (
              <div key={`${concept.name}-${index}`}><dt>{concept.name}</dt><dd>{concept.explanation}</dd></div>
            ))}
          </dl>
        </section>
      ) : null}

      {response.issues.length ? (
        <section className="ai-tutor-response-section">
          <h4>Issues to investigate</h4>
          <ul className="ai-tutor-response-list">
            {response.issues.map((issue, index) => (
              <li key={`${issue.title}-${index}`}>
                <strong>{issue.title}</strong>
                {issue.codeReference ? <LineRange reference={issue.codeReference} /> : null}
                <span>{issue.explanation}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {response.nextStep.kind !== 'none' && response.nextStep.text ? (
        <section className="ai-tutor-next-step" aria-label="Suggested next step">
          <h4>Next step</h4>
          <p>{response.nextStep.text}</p>
        </section>
      ) : null}
    </article>
  );
}

