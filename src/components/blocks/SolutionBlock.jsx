import { CodeBlock } from './CodeBlock';

export function SolutionBlock({ title = 'Solution', description, language = 'python', code }) {
  return (
    <details className="card card--muted content-section solution-block">
      <summary>{title}</summary>
      {description ? <p>{description}</p> : null}
      <CodeBlock language={language} code={code} caption={title} />
    </details>
  );
}
