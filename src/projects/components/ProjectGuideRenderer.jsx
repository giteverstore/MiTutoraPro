import { resolveLanguageVariant } from '../../../shared/content/normalization.js';

export function ProjectGuideRenderer({ blocks = [], project = {}, runtime: suppliedRuntime }) {
  const runtime = suppliedRuntime ?? project.runtime;
  const runtimeId = runtime?.id ?? project.language ?? project.supportedLanguages?.[0];
  const content = project.languageContent?.[runtimeId] ?? {};
  return <div className="project-structured-guide">{blocks.map((block, index) => {
    const key = `${block.type}-${index}`;
    const text = (value) => typeof value === 'string' ? value : resolveLanguageVariant(value, runtimeId);
    if (block.audience?.languages && !block.audience.languages.includes(runtimeId)) return null;
    if (block.type === 'heading') { const Heading = `h${block.level ?? 3}`; return <Heading key={key}>{text(block.text)}</Heading>; }
    if (block.type === 'paragraph') return <p key={key}>{text(block.text)}</p>;
    if (block.type === 'note') return <aside className="project-guide-note" key={key}>{block.text}</aside>;
    if (block.type === 'list') return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
    if (block.type === 'code') { const code = block.codeKey ? content[block.codeKey] : block.byLanguage?.[runtimeId] ?? text(block.code); return code ? <pre key={key}><code>{code}</code></pre> : null; }
    if (block.type === 'expected-output') return <div className="project-guide-output" key={key}><strong>Expected output</strong><pre>{text(block.output ?? block.text)}</pre></div>;
    if (block.type === 'callout') return <aside className={`project-guide-note is-${block.variant}`} key={key}><strong>{block.title}</strong><p>{text(block.text)}</p></aside>;
    if (block.type === 'concept') return <section key={key}><h4>{block.title ?? block.conceptId}</h4><p>{block.text}</p></section>;
    if (block.type === 'requirements' || block.type === 'common-mistakes') return <section key={key}><strong>{block.type === 'requirements' ? 'Requirements' : 'Common mistakes'}</strong><ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
    if (block.type === 'table') return <table key={key}><thead><tr>{block.columns.map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
    if (block.type === 'divider') return <hr key={key} />;
    if (block.type === 'image') return <figure key={key} data-asset-id={block.assetId}><div role="img" aria-label={block.alt} /><figcaption>{block.caption}</figcaption></figure>;
    if (block.type === 'runtime-command' || block.type === 'terminal-command') { const command = block.type === 'terminal-command' ? text(block.display) : block.command === 'build' ? runtime?.buildCommand : runtime?.runCommand; return command ? <p className="project-runtime-command" key={key}>Run <code>{command}</code> in the terminal or use the Run control.</p> : null; }
    if (block.type === 'language-hint') return content[block.key] ? <aside className="project-language-hint" key={key}><strong>{runtime.displayName} hint</strong><p>{content[block.key]}</p></aside> : null;
    if (block.type === 'language-section') return block.byLanguage?.[runtimeId] ? <ProjectGuideRenderer blocks={block.byLanguage[runtimeId]} project={project} runtime={runtime} key={key} /> : null;
    return null;
  })}</div>;
}
