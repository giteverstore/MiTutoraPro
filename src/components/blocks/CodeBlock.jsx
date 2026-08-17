import { Braces, Play } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { useOptionalLearningCompiler } from '../../compiler/LearningCompilerContext';

const toneClassNames = {
  keyword: 'code-keyword',
  name: 'code-name',
  string: 'code-string',
  comment: 'code-comment',
  number: 'code-number',
  builtin: 'code-builtin',
};

const pythonTokenPattern = /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b|\b(print|type|input|len|range|int|float|str|bool)\b|\b(\d+(?:\.\d+)?)\b/g;

function tokenizePythonLine(text) {
  const segments = [];
  let cursor = 0;

  for (const match of text.matchAll(pythonTokenPattern)) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) });
    const tone = match[1]
      ? 'comment'
      : match[2]
        ? 'string'
        : match[3]
          ? 'keyword'
          : match[4]
            ? 'builtin'
            : 'number';
    segments.push({ text: match[0], tone });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length ? segments : [{ text }];
}

function createCodeLines(code, language) {
  return (code ?? '').split('\n').map((text, index) => ({
    number: String(index + 1).padStart(2, '0'),
    segments: language?.toLowerCase() === 'python'
      ? tokenizePythonLine(text)
      : [{ text }],
  }));
}

export function CodeBlock({
  label,
  language,
  ariaLabel,
  lines,
  code,
  filename,
  caption,
  highlightLines = [],
  mode = 'display',
  stdin = '',
}) {
  const learningCompiler = useOptionalLearningCompiler();
  const codeLines = lines ?? createCodeLines(code, language);
  const canRun = mode === 'runnable' && Boolean(code) && Boolean(learningCompiler);

  return (
    <section className="card card--inverse content-section code-card">
      <div className="block-header">
        <span><Braces size={ICON_SIZE.base} /> {caption || label || filename}</span>
        <span className="code-language">{language}</span>
      </div>
      <pre aria-label={ariaLabel || caption || `${language} code`}>
        <code>
          {codeLines.map((line, lineIndex) => (
            <span
              className={highlightLines.includes(lineIndex + 1) ? 'code-line-highlighted' : undefined}
              key={line.number}
            >
              <span className="code-muted">{line.number}</span>{' '}
              {line.segments.map((segment, segmentIndex) => (
                <span className={toneClassNames[segment.tone]} key={segmentIndex}>
                  {segment.text}
                </span>
              ))}
              {lineIndex < codeLines.length - 1 ? '\n' : null}
            </span>
          ))}
        </code>
      </pre>
      {canRun ? (
        <footer className="code-card-actions">
          <button
            className="button button--ghost code-run-button"
            type="button"
            onClick={() => learningCompiler.runExample({ source: code, language, filename, stdin })}
          >
            <Play size={ICON_SIZE.sm} aria-hidden="true" />
            Run Code
          </button>
        </footer>
      ) : null}
    </section>
  );
}
