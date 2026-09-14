import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { RichText } from '../components/RichText';
import { ICON_SIZE } from '../design-system/theme';

const DEVELOPMENT_PLACEHOLDER_HINTS = import.meta.env.DEV
  ? ['Hint content will be available soon.']
  : [];

export function resolvePracticeHints(realHints, developmentHints = DEVELOPMENT_PLACEHOLDER_HINTS) {
  return realHints.length ? realHints : developmentHints;
}

function PracticeHints({ hints }) {
  const [revealed, setRevealed] = useState(() => new Set());
  if (!hints.length) return null;

  const toggle = (index) => setRevealed((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  return <section className="practice-document-section practice-hints" aria-labelledby="practice-hints-title">
    <h2 id="practice-hints-title">Hints</h2>
    <div className="practice-hint-list">
      {hints.map((hint, index) => {
        const isRevealed = revealed.has(index);
        const contentId = `practice-hint-${index + 1}`;
        return <article className="practice-hint" key={`${index}-${hint}`}>
          <header>
            <span><Lightbulb size={ICON_SIZE.md} aria-hidden="true" /> Hint {index + 1}</span>
            <button type="button" aria-expanded={isRevealed} aria-controls={contentId} onClick={() => toggle(index)}>{isRevealed ? 'Hide' : 'Reveal'}</button>
          </header>
          {isRevealed ? <div id={contentId} className="practice-hint-content"><RichText content={hint} format="markdown" /></div> : null}
        </article>;
      })}
    </div>
  </section>;
}

export function PracticeProblemContent({ question, developmentHints = DEVELOPMENT_PLACEHOLDER_HINTS }) {
  const statement = question.blocks.find((block) => block.type === 'paragraph')?.content ?? '';
  const exampleBlock = question.blocks.find((block) => block.type === 'code' && /^Input\s/i.test(block.code ?? ''));
  const [fallbackInput = '', fallbackOutput = ''] = (exampleBlock?.code ?? '').split(/\n\s*\nOutput\n/i);
  const fallbackExample = exampleBlock ? [{
    input: fallbackInput.replace(/^Input\n/i, ''),
    output: fallbackOutput,
    explanation: exampleBlock.caption,
  }] : [];
  const examples = Array.isArray(question.examples) && question.examples.length ? question.examples : fallbackExample;
  const constraintBlock = question.blocks.find((block) => block.type === 'note' && block.title === 'Constraints');
  const fallbackConstraints = constraintBlock?.content ? constraintBlock.content.split('\n').filter(Boolean) : [];
  const constraints = Array.isArray(question.constraints) && question.constraints.length ? question.constraints : fallbackConstraints;
  const realHints = Array.isArray(question.hints) ? question.hints.filter((hint) => typeof hint === 'string' && hint.trim()) : [];
  const hints = resolvePracticeHints(realHints, developmentHints);

  return <div className="practice-document">
    {statement ? <div className="practice-problem-description"><RichText content={statement} format="markdown" /></div> : null}
    {examples.length ? <section className="practice-document-section practice-examples" aria-labelledby="practice-example-title">
      <h2 id="practice-example-title">Example{examples.length > 1 ? 's' : ''}</h2>
      {examples.map((example, index) => <div className="practice-example" key={index}>
        <div><strong>Input</strong><pre>{example.input}</pre></div>
        <div><strong>Output</strong><pre>{example.output}</pre></div>
        {example.explanation ? <p>{example.explanation}</p> : null}
      </div>)}
    </section> : null}
    {constraints.length ? <section className="practice-document-section practice-constraints" aria-labelledby="practice-constraints-title">
      <h2 id="practice-constraints-title">Constraints</h2>
      <ul>{constraints.map((constraint) => <li key={constraint}><RichText content={constraint} format="markdown" /></li>)}</ul>
    </section> : null}
    <PracticeHints hints={hints} />
  </div>;
}
