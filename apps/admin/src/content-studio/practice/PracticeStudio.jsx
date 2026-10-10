import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, Code2, Heading2, MessageSquareWarning, Plus, Trash2 } from 'lucide-react';
import { CANONICAL_LANGUAGE_IDS } from '../../../../../shared/content/index.js';
import { CloudDraftRepository } from '../persistence/CloudDraftRepository.js';
import { LocalDraftRepository } from '../persistence/DraftRepository.js';
import { useAutosavedDraft } from '../persistence/useAutosavedDraft.js';
import { ProjectPublicationPanel } from '../projects/ProjectPublicationPanel.jsx';
import { StudioHeader, StudioWorkspace } from '../StudioChrome.jsx';
import { StudioDraftList } from '../StudioDraftList.jsx';
import { StudioListHeader, StudioListState, useStudioList } from '../StudioListState.jsx';
import { BlockPalette } from '../blocks/BlockPalette.jsx';
import { BlockCanvas } from '../blocks/BlockCanvas.jsx';
import { useLegacyBlockWorkspace } from '../blocks/useLegacyBlockWorkspace.js';
import { LegacyBlockInspector } from '../inspector/LegacyBlockInspector.jsx';
import { createPracticeDraft, practiceUid, validatePracticeDraft } from './practiceAuthoring.js';
import '../projects/project-studio.css';

const AdminPracticeMonacoEditor = lazy(() => import('./AdminPracticeMonacoEditor.jsx'));
const local = globalThis.localStorage?.getItem ? globalThis.localStorage : null;
const repository = import.meta.env.MODE === 'test' || import.meta.env.VITE_ADMIN_DRAFT_MODE === 'local' ? new LocalDraftRepository(local, 'ycoders.admin.practice-draft.v1') : new CloudDraftRepository('PRACTICE');
const Field = ({ label, ...props }) => <label><span>{label}</span><input {...props} /></label>;
const Lines = ({ label, value = [], onChange, readOnly }) => <label><span>{label}</span><textarea value={value.join('\n')} readOnly={readOnly} onChange={(event) => onChange(event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))} /></label>;
const practicePalette = [['heading', 'Heading', Heading2], ['paragraph', 'Paragraph', AlignLeft], ['note', 'Note', MessageSquareWarning], ['code', 'Code', Code2]].map(([type, label, icon]) => ({ type, label, icon, group: 'Problem content' }));

function PracticeLanding({ onNavigate }) {
  const resource = useStudioList(useCallback(() => repository.list().then((all) => all.filter((item) => item.contentType === 'PRACTICE')), []));
  return <section className="project-landing"><StudioListHeader title="Practice" description="Author and manage Practice questions." action={<button className="admin-primary-button" type="button" onClick={() => onNavigate('/content/practice/new')}><Plus />New Practice Question</button>} /><StudioListState resource={resource} label="Practice" empty="No Practice drafts yet."><StudioDraftList drafts={resource.items} type="Practice" detail={(draft) => `${draft.content.language} · ${draft.content.difficulty}`} onOpen={(draft) => onNavigate(`/content/practice/${draft.contentId}/edit`)} /></StudioListState></section>;
}

export function PracticeStudio({ path, role, readOnly, onNavigate, onDirtyChange = () => {} }) {
  if (path === '/content/practice') return <PracticeLanding onNavigate={onNavigate} />;
  const routeId = path.match(/\/practice\/([^/]+)\/edit/)?.[1];
  return <UnifiedPracticeEditor key={routeId ?? 'new'} routeId={routeId} role={role} readOnly={readOnly} onDirtyChange={onDirtyChange} />;
}

function UnifiedPracticeEditor({ routeId, role, readOnly, onDirtyChange }) {
  const { draft, dirty, saveError, edit, reload } = useAutosavedDraft({ routeId, createDraft: createPracticeDraft, repository, readOnly, onDirtyChange });
  const [view, setView] = useState('content');
  const [validation, setValidation] = useState(null);
  const content = draft.content;
  const patch = (delta) => { if (readOnly) return; edit((current) => ({ ...current, content: { ...current.content, ...delta } })); setValidation(null); };
  const blocks = useLegacyBlockWorkspace({ scopeId: content.questionId, blocks: content.blocks, setBlocks: (next) => patch({ blocks: next }), makeId: practiceUid });
  const create = (type) => newPracticeBlock(type, content.language);
  const json = useMemo(() => JSON.stringify({ ...draft, documentId: undefined, draftRevision: undefined }, null, 2), [draft]);
  const showPublication = () => document.getElementById('project-publication-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const selectIssue = (path) => {
    const blockIndex = Number(/blocks\[(\d+)\]/.exec(path)?.[1]);
    if (Number.isInteger(blockIndex)) { setView('content'); blocks.setSelectedBlockId(content.blocks[blockIndex]?.id ?? null); }
    else setView(/verification|starterCode|stdin|constraints|hints|publicTests|examples/.test(path) ? 'code' : 'content');
  };
  return <div className="project-studio practice-studio studio-unified">
    <StudioHeader type="PRACTICE" title={content.title} draft={draft} dirty={dirty} saveError={saveError} readOnly={readOnly} role={role} view={view} onView={(next) => setView(next === 'author' ? 'content' : next)} onValidate={() => setValidation(validatePracticeDraft(draft))} onHistory={repository.publish ? showPublication : null} onPublish={repository.publish ? () => document.getElementById('content-studio-publish-button')?.click() : null} onReload={reload} />
    {view !== 'json' && view !== 'preview' ? <nav className="studio-content-tabs" aria-label="Practice authoring sections"><button type="button" aria-current={view === 'content' ? 'page' : undefined} onClick={() => setView('content')}>Content</button><button type="button" aria-current={view === 'code' ? 'page' : undefined} onClick={() => setView('code')}>Code &amp; Verification</button></nav> : null}
    {view === 'json' ? <section className="content-json-view"><pre><code>{json}</code></pre></section> : view === 'preview' ? <PracticePreview question={content} /> : view === 'code' ? <PracticeCodeAndVerification question={content} patch={patch} readOnly={readOnly} /> : <StudioWorkspace structureLabel="Problem outline" toolbar={<BlockPalette variant="toolbar" definitions={practicePalette} create={create} dispatch={blocks.dispatch} disabled={readOnly} selectedBlockId={blocks.selectedBlockId} />} structure={<PracticeOutline blocks={content.blocks} selectedBlockId={blocks.selectedBlockId} onSelect={blocks.setSelectedBlockId} />} canvas={<><header className="studio-canvas-heading"><h2>Problem statement</h2><span>{content.blocks.length} blocks</span></header><BlockCanvas blocks={blocks.canvasBlocks} selectedBlockId={blocks.selectedBlockId} readOnly={readOnly} language={content.language} dispatch={blocks.dispatch} create={create} renderPreview={(block) => <p className="studio-block-summary">{String(block.text ?? block.content ?? block.code ?? block.title ?? '').slice(0, 220)}</p>} /></>} inspector={<><h2 className="studio-inspector-heading">{blocks.selectedBlock ? 'Block properties' : 'Question properties'}</h2>{blocks.selectedBlock ? <LegacyBlockInspector block={blocks.selectedBlock} readOnly={readOnly} onChange={(delta) => patch({ blocks: content.blocks.map((block) => block.id === blocks.selectedBlockId ? { ...block, ...delta } : block) })} /> : <PracticeMetadata question={content} patch={patch} readOnly={readOnly} />}</>} />}
    {validation ? <section className="project-validation" aria-live="polite"><h2>Practice validation</h2>{validation.valid ? <p>Content is valid</p> : <><p>{validation.errors.length} issues to fix.</p><ul>{validation.errors.map((error, index) => <li key={`${error.path}-${index}`}><button type="button" onClick={() => selectIssue(error.path)}>{error.path}: {error.message}</button></li>)}</ul></>}</section> : null}
    {repository.publish ? <ProjectPublicationPanel draft={draft} dirty={dirty} role={role} repository={repository} onValidation={setValidation} onReload={reload} /> : null}
  </div>;
}

function PracticeOutline({ blocks, selectedBlockId, onSelect }) {
  return <nav className="project-tree" aria-label="Problem outline"><button type="button" className={!selectedBlockId ? 'active' : ''} onClick={() => onSelect(null)}>Question properties</button>{blocks.map((block, index) => <button key={block.id} type="button" className={selectedBlockId === block.id ? 'active' : ''} aria-current={selectedBlockId === block.id ? 'true' : undefined} onClick={() => onSelect(block.id)}>{index + 1}. {block.type}</button>)}</nav>;
}

function PracticeMetadata({ question, patch, readOnly }) {
  return <div className="project-form"><section><h2>Question</h2><div className="project-fields"><Field label="Stable Question ID" value={question.questionId} readOnly /><Field label="Title" value={question.title} readOnly={readOnly} onChange={(event) => patch({ title: event.target.value })} /><label><span>Summary</span><textarea value={question.summary} readOnly={readOnly} onChange={(event) => patch({ summary: event.target.value })} /></label><label><span>Language</span><select value={question.language} disabled={readOnly} onChange={(event) => patch({ language: event.target.value })}>{CANONICAL_LANGUAGE_IDS.map((language) => <option key={language}>{language}</option>)}</select></label><label><span>Difficulty</span><select value={question.difficulty} disabled={readOnly} onChange={(event) => patch({ difficulty: event.target.value })}>{['Easy', 'Medium', 'Hard'].map((value) => <option key={value}>{value}</option>)}</select></label><Field label="Topic" value={question.topic} readOnly={readOnly} onChange={(event) => patch({ topic: event.target.value })} /><Field label="Subtopic" value={question.subtopic ?? ''} readOnly={readOnly} onChange={(event) => patch({ subtopic: event.target.value })} /><Field label="Category" value={question.category} readOnly={readOnly} onChange={(event) => patch({ category: event.target.value })} /><Field label="Estimated minutes" type="number" min="1" value={question.estimatedMinutes} readOnly={readOnly} onChange={(event) => patch({ estimatedMinutes: Number(event.target.value) })} /><Field label="XP" type="number" min="0" value={question.xp} readOnly={readOnly} onChange={(event) => patch({ xp: Number(event.target.value) })} /><Lines label="Skills" value={question.skills} readOnly={readOnly} onChange={(value) => patch({ skills: value })} /></div></section></div>;
}

function PracticeCodeAndVerification({ question, patch, readOnly }) {
  return <div className="studio-code-workspace"><section className="project-form"><h2>Code &amp; Verification</h2><p>Configure the starter and trusted output comparison.</p><div className="studio-verification-grid"><label><span>Starter code</span><textarea value={question.starterCode} readOnly={readOnly} onChange={(event) => patch({ starterCode: event.target.value })} /></label><label><span>Standard input</span><textarea value={question.stdin ?? ''} readOnly={readOnly} onChange={(event) => patch({ stdin: event.target.value })} /></label><label><span>Expected output</span><textarea value={question.verification.expectedOutput} readOnly={readOnly} onChange={(event) => patch({ verification: { ...question.verification, expectedOutput: event.target.value } })} /></label><label><span>Comparison</span><select value={question.verification.comparison} disabled={readOnly} onChange={(event) => patch({ verification: { ...question.verification, comparison: event.target.value } })}><option value="normalized-lines">Normalized lines</option><option value="trimmed">Trimmed</option><option value="exact">Exact</option></select></label><Lines label="Constraints" value={question.constraints} readOnly={readOnly} onChange={(value) => patch({ constraints: value })} /><Lines label="Hints" value={question.hints} readOnly={readOnly} onChange={(value) => patch({ hints: value })} /></div></section><PracticeSupplementalFields question={question} patch={patch} readOnly={readOnly} /></div>;
}

function PracticeEditor({ routeId, role, readOnly, onDirtyChange }) {
  const { draft, dirty, saveError, edit, reload } = useAutosavedDraft({ routeId, createDraft: createPracticeDraft, repository, readOnly, onDirtyChange }); const [view, setView] = useState('author'); const [validation, setValidation] = useState(null);
  const content = draft.content;
  const patch = (delta) => { if (readOnly) return; edit((current) => ({ ...current, content: { ...current.content, ...delta } })); setValidation(null); };
  const updateBlock = (id, delta) => patch({ blocks: content.blocks.map((block) => block.id === id ? { ...block, ...delta } : block) });
  const json = useMemo(() => JSON.stringify({ ...draft, documentId: undefined, draftRevision: undefined }, null, 2), [draft]);
  return <div className="project-studio practice-studio"><header className="content-studio-heading"><div><h1>{content.title}</h1><p>Declarative expected-output verification only. Reference solutions are never included.</p></div><div className="content-studio-status"><span>{dirty ? 'Autosaving…' : `Draft revision ${draft.draftRevision ?? 0}`}</span>{readOnly && <strong>Read only</strong>}</div></header>{saveError && <section role="alert" className="project-validation">{saveError}</section>}
    <div className="project-toolbar"><button onClick={() => setView('author')} aria-pressed={view === 'author'}>Author</button><button onClick={() => setView('preview')} aria-pressed={view === 'preview'}>Preview &amp; Test</button><button onClick={() => setView('json')} aria-pressed={view === 'json'}><Braces />Generated JSON</button><button onClick={() => setValidation(validatePracticeDraft(draft))}>Validate Question</button></div>
    {view === 'json' ? <section className="content-json-view"><pre><code>{json}</code></pre></section> : view === 'preview' ? <PracticePreview question={content} /> : <main className="project-form"><section><h2>Question metadata</h2><div className="project-fields"><Field label="Stable Question ID" value={content.questionId} readOnly /><Field label="Title" value={content.title} readOnly={readOnly} onChange={(e) => patch({ title: e.target.value })} /><label><span>Summary</span><textarea value={content.summary} readOnly={readOnly} onChange={(e) => patch({ summary: e.target.value })} /></label><label><span>Language</span><select value={content.language} disabled={readOnly} onChange={(e) => patch({ language: e.target.value })}>{CANONICAL_LANGUAGE_IDS.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Difficulty</span><select value={content.difficulty} disabled={readOnly} onChange={(e) => patch({ difficulty: e.target.value })}>{['Easy','Medium','Hard'].map((value) => <option key={value}>{value}</option>)}</select></label><Field label="Topic" value={content.topic} readOnly={readOnly} onChange={(e) => patch({ topic: e.target.value })} /><Field label="Category" value={content.category} readOnly={readOnly} onChange={(e) => patch({ category: e.target.value })} /><Field label="Subtopic" value={content.subtopic ?? ''} readOnly={readOnly} onChange={(e) => patch({ subtopic: e.target.value })} /><Field label="Estimated minutes" type="number" min="1" value={content.estimatedMinutes} readOnly={readOnly} onChange={(e) => patch({ estimatedMinutes: Number(e.target.value) })} /><Field label="XP" type="number" min="0" value={content.xp} readOnly={readOnly} onChange={(e) => patch({ xp: Number(e.target.value) })} /><Lines label="Skills" value={content.skills} readOnly={readOnly} onChange={(value) => patch({ skills: value })} /></div></section>
      <section><h2>Problem statement</h2>{content.blocks.map((block) => <PracticeProblemBlock key={block.id} block={block} questionLanguage={content.language} readOnly={readOnly} onChange={(delta) => updateBlock(block.id, delta)} onDelete={() => patch({ blocks: content.blocks.filter((item) => item.id !== block.id) })} />)}{!readOnly && <div className="project-toolbar">{['paragraph', 'heading', 'note', 'code'].map((type) => <button type="button" key={type} onClick={() => patch({ blocks: [...content.blocks, newPracticeBlock(type, content.language)] })}>+ Add {type}</button>)}</div>}</section>
      <section><h2>Starter code and trusted verification</h2><p>Only normalized expected-output comparison is authored. No JavaScript, commands, or shell configuration is accepted.</p><label><span>Starter code</span><textarea value={content.starterCode} readOnly={readOnly} onChange={(e) => patch({ starterCode: e.target.value })} /></label><label><span>Standard input</span><textarea value={content.stdin ?? ''} readOnly={readOnly} onChange={(e) => patch({ stdin: e.target.value })} /></label><label><span>Expected output</span><textarea value={content.verification.expectedOutput} readOnly={readOnly} onChange={(e) => patch({ verification: { ...content.verification, expectedOutput: e.target.value } })} /></label><label><span>Comparison</span><select value={content.verification.comparison} disabled={readOnly} onChange={(e) => patch({ verification: { ...content.verification, comparison: e.target.value } })}><option value="normalized-lines">Normalized lines</option><option value="trimmed">Trimmed</option><option value="exact">Exact</option></select></label><Lines label="Constraints" value={content.constraints} readOnly={readOnly} onChange={(value) => patch({ constraints: value })} /><Lines label="Hints" value={content.hints} readOnly={readOnly} onChange={(value) => patch({ hints: value })} /></section></main>}
    {view === 'author' && <PracticeSupplementalFields question={content} patch={patch} readOnly={readOnly} />}
    {validation && <section className="project-validation" aria-live="polite"><h2>Practice validation</h2>{validation.valid ? <p>Practice contract is valid.</p> : <ul>{validation.errors.map((error, index) => <li key={`${error.path}-${index}`}>{error.path}: {error.message}</li>)}</ul>}</section>}
    {repository.publish ? <ProjectPublicationPanel draft={draft} dirty={dirty} role={role} repository={repository} onValidation={setValidation} onReload={reload} /> : null}
  </div>;
}

function newPracticeBlock(type, questionLanguage) {
  const id = practiceUid(type);
  if (type === 'heading') return { id, type, level: 2, text: 'New heading' };
  if (type === 'note') return { id, type, title: 'Note', content: 'Describe this note.', format: 'plain' };
  if (type === 'code') return { id, type, language: questionLanguage, code: '# Example', caption: '' };
  return { id, type: 'paragraph', content: 'Describe this step.', format: 'plain' };
}

function PracticeProblemBlock({ block, questionLanguage, readOnly, onChange, onDelete }) {
  const textField = (label, property) => <label><span>{label}</span><textarea value={block[property] ?? ''} readOnly={readOnly} onChange={(event) => onChange({ [property]: event.target.value })} /></label>;
  return <article className="project-card"><strong>{block.type}</strong><Field label="Stable block ID" value={block.id} readOnly />
    {block.type === 'heading' && <><Field label="Heading level" type="number" min="1" max="6" value={block.level ?? 2} readOnly={readOnly} onChange={(event) => onChange({ level: Number(event.target.value) })} />{textField('Heading text', 'text')}</>}
    {block.type === 'note' && <><Field label="Note title" value={block.title ?? ''} readOnly={readOnly} onChange={(event) => onChange({ title: event.target.value })} />{textField('Note content', 'content')}</>}
    {block.type === 'code' && <><label><span>Code language</span><select value={block.language ?? questionLanguage} disabled={readOnly} onChange={(event) => onChange({ language: event.target.value })}><option value="text">Text</option>{CANONICAL_LANGUAGE_IDS.map((language) => <option value={language} key={language}>{language}</option>)}</select></label>{textField('Example code', 'code')}<Field label="Code caption" value={block.caption ?? ''} readOnly={readOnly} onChange={(event) => onChange({ caption: event.target.value })} /></>}
    {block.type === 'paragraph' && textField('Content', 'content')}
    {!['heading', 'note', 'code', 'paragraph'].includes(block.type) && textField('Content', Object.hasOwn(block, 'text') ? 'text' : 'content')}
    {['note', 'paragraph'].includes(block.type) && <label><span>Format</span><select value={block.format ?? 'plain'} disabled={readOnly} onChange={(event) => onChange({ format: event.target.value })}><option value="plain">Plain</option><option value="markdown">Markdown</option></select></label>}
    {!readOnly && <button type="button" onClick={onDelete}><Trash2 />Delete block</button>}
  </article>;
}

function PracticeSupplementalFields({ question, patch, readOnly }) {
  const examples = question.examples ?? [];
  const updateExample = (index, delta) => patch({ examples: examples.map((example, current) => current === index ? { ...example, ...delta } : example) });
  return <section className="project-form" aria-label="Practice examples and catalog metadata">
    <h2>Examples and catalog metadata</h2>
    <div className="project-fields">
      <Field label="Question type" value={question.questionType ?? ''} readOnly={readOnly} onChange={(event) => patch({ questionType: event.target.value })} />
      <Field label="Catalog position" type="number" min="0" value={question.position ?? 0} readOnly={readOnly} onChange={(event) => patch({ position: Number(event.target.value) })} />
      <Lines label="Tags" value={question.tags ?? []} readOnly={readOnly} onChange={(value) => patch({ tags: value })} />
      <Lines label="Prerequisites" value={question.prerequisites ?? []} readOnly={readOnly} onChange={(value) => patch({ prerequisites: value })} />
      <Lines label="Concepts" value={question.concepts ?? []} readOnly={readOnly} onChange={(value) => patch({ concepts: value })} />
      <Lines label="Common mistakes" value={question.commonMistakes ?? []} readOnly={readOnly} onChange={(value) => patch({ commonMistakes: value })} />
    </div>
    <h3>Worked examples</h3>
    {examples.map((example, index) => <article className="project-card" key={`example-${index}`}>
      <label><span>Example {index + 1} input</span><textarea value={example.input ?? ''} readOnly={readOnly} onChange={(event) => updateExample(index, { input: event.target.value })} /></label>
      <label><span>Example {index + 1} output</span><textarea value={example.output ?? ''} readOnly={readOnly} onChange={(event) => updateExample(index, { output: event.target.value })} /></label>
      <label><span>Example {index + 1} explanation</span><textarea value={example.explanation ?? ''} readOnly={readOnly} onChange={(event) => updateExample(index, { explanation: event.target.value })} /></label>
      {!readOnly && <button type="button" onClick={() => patch({ examples: examples.filter((_, current) => current !== index) })}>Remove example {index + 1}</button>}
    </article>)}
    {!readOnly && <button type="button" onClick={() => patch({ examples: [...examples, { input: '', output: '', explanation: '' }] })}>+ Add example</button>}
    <h3>Structured public test metadata</h3>
    <p>These public fields are JSON for compatibility with existing Practice questions. Invalid JSON is not saved.</p>
    <PracticeJsonField key={`${question.questionId}-tests`} label="Public tests" value={question.publicTests ?? []} kind="array" readOnly={readOnly} onChange={(value) => patch({ publicTests: value })} />
    <PracticeJsonField key={`${question.questionId}-contract`} label="Function contract" value={question.contract ?? {}} kind="object" readOnly={readOnly} onChange={(value) => patch({ contract: value })} />
    <PracticeJsonField key={`${question.questionId}-complexity`} label="Expected complexity" value={question.expectedComplexity ?? {}} kind="object" readOnly={readOnly} onChange={(value) => patch({ expectedComplexity: value })} />
  </section>;
}

function PracticeJsonField({ label, value, kind, readOnly, onChange }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState('');
  const serialized = JSON.stringify(value, null, 2);
  useEffect(() => { setText(serialized); setError(''); }, [serialized]);
  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      if (kind === 'array' ? !Array.isArray(parsed) : !parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`Enter a JSON ${kind}.`);
      onChange(parsed);
      setError('');
    } catch (cause) { setError(cause.message); }
  };
  return <label><span>{label}</span><textarea value={text} readOnly={readOnly} onChange={(event) => setText(event.target.value)} onBlur={readOnly ? undefined : apply} />{error && <small role="alert">{error}</small>}</label>;
}

export function PracticePreview({ question, rewardLabel = `${question.xp} XP` }) {
  const [code, setCode] = useState(question.starterCode);
  const [execution, setExecution] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const manager = useRef(null);
  const runnable = ['python', 'java', 'cpp'].includes(question.language);
  useEffect(() => () => { void manager.current?.dispose(); }, []);
  const run = async () => {
    setRunning(true); setExecution(null); setResult(null);
    try {
      if (!manager.current) {
        const { createAdminPreviewCompilerManager } = await import('../projects/adminPreviewCompilerManager.js');
        manager.current = createAdminPreviewCompilerManager();
      }
      setExecution(await manager.current.execute({ language: question.language, source: code, stdin: question.stdin, instanceId: `admin-practice-${question.questionId}` }));
    } catch (error) { setExecution({ status: 'error', stderr: error.message, stdout: '' }); }
    finally { setRunning(false); }
  };
  const verify = () => {
    if (execution?.status !== 'success') return;
    const valid = manager.current.validateOutput({ expectedOutput: question.verification.expectedOutput, programOutput: execution.stdout ?? execution.output ?? '', validatorType: question.verification.comparison ?? 'normalized-lines' });
    setResult(valid ? 'Accepted' : 'Output does not match the expected result.');
  };
  const changeCode = (value) => { setCode(value); setExecution(null); setResult(null); };
  return <section className="project-preview"><header><div><h2>{question.title}</h2><p>{question.difficulty} · {question.topic} · {question.estimatedMinutes} min · {rewardLabel}</p></div></header>
    <article className="project-preview-guide">{question.blocks.map((block) => <p key={block.id}>{block.content ?? block.text}</p>)}</article>
    <div className="project-fields"><div className="admin-practice-preview-editor"><Suspense fallback={<label><span>Code for preview run</span><textarea value={code} onChange={(event) => changeCode(event.target.value)} /></label>}><AdminPracticeMonacoEditor questionId={question.questionId} language={question.language} value={code} onChange={changeCode} /></Suspense></div><label><span>Execution output</span><textarea value={execution?.stdout ?? execution?.output ?? ''} readOnly /></label></div>
    <div className="project-toolbar"><button disabled={!runnable || running} onClick={run}>{running ? 'Running…' : 'Run code'}</button><button disabled={execution?.status !== 'success'} onClick={verify}>Verify output</button><button onClick={() => { setCode(question.starterCode); setExecution(null); setResult(null); }}>Reset</button></div>
    {!runnable && <p>Admin Preview execution is available for Python, Java, and C++ only; published questions use the learner compiler for other languages.</p>}{execution?.status && execution.status !== 'success' && <p role="alert">{execution.stderr ?? execution.errors?.join('\n') ?? 'Execution failed.'}</p>}{result && <p role="status">{result}</p>}<p>Preview does not persist learner completion.</p>
  </section>;
}
