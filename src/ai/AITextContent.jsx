import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import './AITextContent.css';

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = async () => {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await globalThis.navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Copy is an enhancement; keep the code readable and the control retryable.
    }
  };

  return <div className="ai-response-code">
    <div className="ai-response-code-toolbar">
      {language ? <span className="ai-response-code-language">{language}</span> : <span />}
      <button type="button" aria-label={copied ? 'Code copied' : 'Copy code'} onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span></button>
    </div>
    <pre><code>{code}</code></pre>
  </div>;
}

function InlineContent({ text }) {
  return String(text ?? '').split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function flushParagraph(nodes, paragraph) {
  if (!paragraph.length) return;
  nodes.push(<p key={`paragraph-${nodes.length}`}><InlineContent text={paragraph.join('\n')} /></p>);
  paragraph.length = 0;
}

function flushList(nodes, list) {
  if (!list.items.length) return;
  const List = list.ordered ? 'ol' : 'ul';
  nodes.push(<List key={`list-${nodes.length}`}>{list.items.map((item, index) => <li key={`${index}-${item}`}><InlineContent text={item} /></li>)}</List>);
  list.items.length = 0;
  list.ordered = false;
}

export function AITextContent({ text, className = '' }) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return null;
  const nodes = [];
  const paragraph = [];
  const list = { ordered: false, items: [] };
  const lines = source.split('\n');
  let code = null;

  const flushText = () => { flushParagraph(nodes, paragraph); flushList(nodes, list); };
  for (const line of lines) {
    const fence = line.match(/^\s*```([A-Za-z0-9_+#.-]*)\s*$/);
    if (fence) {
      if (code) {
        nodes.push(<CodeBlock code={code.lines.join('\n')} language={code.language} key={`code-${nodes.length}`} />);
        code = null;
      } else {
        flushText();
        code = { language: fence[1], lines: [] };
      }
      continue;
    }
    if (code) { code.lines.push(line); continue; }

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) {
      flushText();
      nodes.push(<h5 key={`heading-${nodes.length}`}><InlineContent text={heading[1]} /></h5>);
    } else if (unordered || ordered) {
      flushParagraph(nodes, paragraph);
      const nextOrdered = Boolean(ordered);
      if (list.items.length && list.ordered !== nextOrdered) flushList(nodes, list);
      list.ordered = nextOrdered;
      list.items.push((unordered ?? ordered)[1]);
    } else if (!line.trim()) {
      flushText();
    } else {
      flushList(nodes, list);
      paragraph.push(line.trimEnd());
    }
  }
  if (code) nodes.push(<CodeBlock code={code.lines.join('\n')} language={code.language} key={`code-${nodes.length}`} />);
  flushText();
  return <div className={`ai-response-content ${className}`.trim()}>{nodes}</div>;
}
