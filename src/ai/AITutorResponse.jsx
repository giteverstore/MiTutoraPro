import { AITextContent } from './AITextContent';

function LineRange({ reference }) {
  const label = reference.startLine === reference.endLine
    ? `Line ${reference.startLine}`
    : `Lines ${reference.startLine}–${reference.endLine}`;
  return <span className="ai-tutor-line-range">{label}</span>;
}

export function AITutorResponse({ response, stale = false }) {
  if (typeof response === 'string') return <AITextContent text={response} className="ai-tutor-structured-response" />;
  const sections = response?.sections ?? [];
  const codeReferences = response?.codeReferences ?? [];
  const concepts = response?.concepts ?? [];
  const issues = response?.issues ?? [];
  const nextStep = response?.nextStep ?? { kind: 'none', text: '' };
  return (
    <article className="ai-tutor-structured-response" aria-label="AI Tutor explanation">
      {stale ? <p className="ai-tutor-stale" role="status">This explanation is based on an earlier code or compiler snapshot.</p> : null}
      <AITextContent text={response?.summary} className="ai-tutor-summary" />
      {response?.evidence?.note ? <div className="ai-tutor-evidence"><strong>Evidence</strong><AITextContent text={response.evidence.note} /></div> : null}

      {sections.filter((section) => section?.title?.trim() && section?.body?.trim()).map((section, index) => (
        <section className="ai-tutor-response-section" key={`${section.title}-${index}`}>
          <h4>{section.title}</h4>
          <AITextContent text={section.body} />
        </section>
      ))}

      {codeReferences.length ? (
        <section className="ai-tutor-response-section">
          <h4>Code references</h4>
          <ul className="ai-tutor-response-list">
            {codeReferences.map((reference, index) => (
              <li key={`${reference.startLine}-${reference.endLine}-${index}`}>
                <LineRange reference={reference} />
                <AITextContent text={reference.explanation} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {concepts.length ? (
        <section className="ai-tutor-response-section">
          <h4>Key concepts</h4>
          <dl className="ai-tutor-concepts">
            {concepts.map((concept, index) => (
              <div key={`${concept.name}-${index}`}><dt>{concept.name}</dt><dd><AITextContent text={concept.explanation} /></dd></div>
            ))}
          </dl>
        </section>
      ) : null}

      {issues.length ? (
        <section className="ai-tutor-response-section">
          <h4>Issues to investigate</h4>
          <ul className="ai-tutor-response-list">
            {issues.map((issue, index) => (
              <li key={`${issue.title}-${index}`}>
                <strong>{issue.title}</strong>
                {issue.codeReference ? <LineRange reference={issue.codeReference} /> : null}
                <AITextContent text={issue.explanation} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nextStep.kind !== 'none' && nextStep.text ? (
        <section className="ai-tutor-next-step" aria-label="Suggested next step">
          <h4>Next step</h4>
          <AITextContent text={nextStep.text} />
        </section>
      ) : null}
    </article>
  );
}

