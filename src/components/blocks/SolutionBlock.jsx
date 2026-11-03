import { CodeBlock } from './CodeBlock';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function SolutionBlock({ title = 'Solution', description, language = 'python', code }) {
  return (
    <details className="card card--muted content-section solution-block">
      <summary><ChevronRight size={ICON_SIZE.base} aria-hidden="true" /><span>{title}</span></summary>
      <div className="solution-block-content">
        {description ? <p>{description}</p> : null}
        <CodeBlock language={language} code={code} caption={title} />
      </div>
    </details>
  );
}
