import { useEffect, useMemo, useState } from 'react';
import { createV2PracticeIdentity, v2PracticeRepository } from './V2PracticeRepository';
import { V2PracticeWorkspace } from './V2PracticeWorkspace';
import './v2-pilot.css';

function textFromRichNode(node) { return (node?.content ?? []).map((child) => child.type === 'hardBreak' ? '\n' : child.text ?? textFromRichNode(child)).join(''); }
function InstructionBlock({ block }) {
  if (block.type === 'richText') return <div>{(block.data?.document?.content ?? []).map((node, index) => node.type === 'heading' ? <h3 key={index}>{textFromRichNode(node)}</h3> : <p key={index}>{textFromRichNode(node)}</p>)}</div>;
  if (block.type === 'code') return <pre><code>{block.data?.code}</code></pre>;
  if (block.type === 'callout') return <aside>{block.data?.title ? <strong>{block.data.title}</strong> : null}<p>{block.data?.body ?? block.data?.text}</p></aside>;
  if (block.type === 'divider') return <hr />;
  return null;
}

export function V2PilotPracticePage({ contentId, publicationVersion, onExit, repository = v2PracticeRepository, executionClient }) {
  const identity = useMemo(() => createV2PracticeIdentity({ contentId, publicationVersion }), [contentId, publicationVersion]);
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController(); setState({ status: 'loading' });
    repository.load(identity, { signal: controller.signal }).then((delivery) => { setState({ status: 'ready', delivery }); }, (error) => { if (!controller.signal.aborted) setState({ status: 'error', error }); });
    return () => controller.abort();
  }, [identity, repository]);
  if (state.status === 'loading') return <main className="v2-practice-preview" aria-busy="true"><p>Loading Practice…</p></main>;
  if (state.status === 'error') return <main className="v2-practice-preview" role="alert"><h1>Practice unavailable</h1><p>{state.error.message}</p><button type="button" onClick={onExit}>Return home</button></main>;
  const { delivery } = state, practice = delivery.practice;
  return <div className="v2-pilot-shell">
    <div className="v2-pilot-banner" role="status"><strong>V2 Practice Pilot</strong><span>Browser-only workspace · Nothing is saved · Version {delivery.publicationVersion}</span></div>
    <main className="v2-practice-preview">
      <button type="button" className="v2-practice-back" onClick={onExit}>← Return home</button>
      <header><p className="v2-practice-kicker">{practice.difficulty} · {practice.estimatedMinutes} minutes</p><h1>{practice.title}</h1><p>{practice.summary}</p><div className="v2-practice-tags">{[...practice.topics, ...practice.tags].map((tag) => <span key={tag}>{tag}</span>)}</div></header>
      <section aria-labelledby="instructions"><h2 id="instructions">Instructions</h2>{practice.instructions.map((block) => <InstructionBlock key={block.id} block={block} />)}</section>
      <section><h2>Examples</h2>{practice.examples.map((example) => <article key={example.id}><strong>{example.input?.value ?? 'Input'}</strong><pre>{example.output?.value ?? ''}</pre>{example.explanation ? <p>{example.explanation}</p> : null}</article>)}</section>
      <section><h2>Constraints</h2><ul>{practice.constraints.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h2>Hints</h2>{practice.hints.length ? <ul>{practice.hints.map((hint) => <li key={hint.id}>{hint.text}</li>)}</ul> : <p>No hints for this Practice.</p>}</section>
      <V2PracticeWorkspace practice={practice} executionClient={executionClient}/>
    </main>
  </div>;
}
