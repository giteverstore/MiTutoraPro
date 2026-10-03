export function ProjectGuideRenderer({ blocks = [], project, runtime }) {
  const content = project.languageContent?.[runtime.id] ?? {};
  return <div className="project-structured-guide">{blocks.map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === 'heading') return <h3 key={key}>{block.text}</h3>;
    if (block.type === 'paragraph') return <p key={key}>{block.text}</p>;
    if (block.type === 'note') return <aside className="project-guide-note" key={key}>{block.text}</aside>;
    if (block.type === 'list') return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
    if (block.type === 'code') { const code = block.codeKey ? content[block.codeKey] : block.byLanguage?.[runtime.id] ?? block.code; return code ? <pre key={key}><code>{code}</code></pre> : null; }
    if (block.type === 'expected-output') return <div className="project-guide-output" key={key}><strong>Expected output</strong><pre>{block.text}</pre></div>;
    if (block.type === 'runtime-command') { const command = block.command === 'build' ? runtime.buildCommand : runtime.runCommand; return command ? <p className="project-runtime-command" key={key}>Run <code>{command}</code> in the terminal or use the Run control.</p> : null; }
    if (block.type === 'language-hint') return content[block.key] ? <aside className="project-language-hint" key={key}><strong>{runtime.displayName} hint</strong><p>{content[block.key]}</p></aside> : null;
    if (block.type === 'language-section') return block.byLanguage?.[runtime.id] ? <ProjectGuideRenderer blocks={block.byLanguage[runtime.id]} project={project} runtime={runtime} key={key} /> : null;
    return null;
  })}</div>;
}
