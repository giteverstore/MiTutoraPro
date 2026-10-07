import { AlignLeft, Code2, Heading2, MessageSquareWarning, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StudioDraftList } from '../StudioDraftList.jsx';
import { StudioHeader, StudioWorkspace } from '../StudioChrome.jsx';
import { BlockPalette } from '../blocks/BlockPalette.jsx';
import { BlockCanvas } from '../blocks/BlockCanvas.jsx';
import { useLegacyBlockWorkspace } from '../blocks/useLegacyBlockWorkspace.js';
import { LegacyBlockInspector } from '../inspector/LegacyBlockInspector.jsx';
import { CloudDraftRepository } from '../persistence/CloudDraftRepository.js';
import { LocalDraftRepository } from '../persistence/DraftRepository.js';
import { useAutosavedDraft } from '../persistence/useAutosavedDraft.js';
import { ProjectPublicationPanel } from '../projects/ProjectPublicationPanel.jsx';
import { PracticePreview } from '../practice/PracticeStudio.jsx';
import { loadAllPages } from '../../publishing/publishingApi.js';
import { adminContentRequest } from '../../publishing/publishingApi.js';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../../../../shared/admin/adminAuthorization.js';
import { createChallengeDraft, challengeUid, validateChallengeDraft } from './challengeAuthoring.js';
import '../projects/project-studio.css';

const repository = import.meta.env.MODE === 'test' || import.meta.env.VITE_ADMIN_DRAFT_MODE === 'local'
  ? new LocalDraftRepository(globalThis.localStorage, 'ycoders.admin.challenge-draft.v1')
  : new CloudDraftRepository('CHALLENGE');
const palette = [['heading', 'Heading', Heading2], ['paragraph', 'Paragraph', AlignLeft], ['note', 'Note', MessageSquareWarning], ['code', 'Code', Code2]]
  .map(([type, label, icon]) => ({ type, label, icon, group: 'Problem content' }));
const field = (label, value, update, readOnly, props = {}) => <label key={label}><span>{label}</span><input value={value} readOnly={readOnly} onChange={(event) => update(event.target.value)} {...props} /></label>;
const area = (label, value, update, readOnly) => <label key={label}><span>{label}</span><textarea value={value} readOnly={readOnly} onChange={(event) => update(event.target.value)} /></label>;
const newBlock = (type, language) => ({ id: challengeUid(type), type, ...(type === 'heading' ? { level: 2, text: 'New heading' } : type === 'note' ? { title: 'Note', content: 'Add a note.', format: 'plain' } : type === 'code' ? { language, code: '# Example', caption: '' } : { content: 'Describe the problem.', format: 'plain' }) });

export function ChallengeStudio({ path, role, readOnly, onNavigate, onDirtyChange = () => {} }) {
  if (path === '/content/challenges') return <ChallengeLanding onNavigate={onNavigate} readOnly={readOnly} />;
  const routeId = path.match(/\/challenges\/([^/]+)\/edit/)?.[1];
  return <ChallengeEditor routeId={routeId} role={role} readOnly={readOnly} onDirtyChange={onDirtyChange} />;
}

function ChallengeLanding({ onNavigate, readOnly }) {
  const [drafts, setDrafts] = useState([]);
  const [query, setQuery] = useState('');
  useEffect(() => { let active = true; Promise.all([repository.list(), repository.publish ? loadAllPages('catalog').catch(() => []) : Promise.resolve([])]).then(([items, pointers]) => { if (active) { const byId = new Map(pointers.map((pointer) => [pointer.contentId, pointer])); setDrafts(items.map((draft) => ({ ...draft, activeVersion: byId.get(draft.contentId)?.activeVersion ?? null, publicationStatus: byId.get(draft.contentId)?.publicationStatus ?? 'DRAFT' }))); } }).catch(() => { if (active) setDrafts([]); }); return () => { active = false; }; }, []);
  return <section className="project-landing"><header><div><span className="admin-eyebrow">Content Studio</span><h1>Challenges</h1><p>Author and publish dated coding challenges.</p></div>{!readOnly ? <button className="admin-primary-button" type="button" onClick={() => onNavigate('/content/challenges/new')}><Plus />New Challenge</button> : null}</header><label>Search challenges<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><StudioDraftList drafts={drafts.filter((draft) => `${draft.content.title} ${draft.contentId}`.toLowerCase().includes(query.toLowerCase()))} type="Challenge" emptyMessage="No Challenge drafts yet." detail={(draft) => `${draft.contentId} · ${draft.content.language} · ${draft.content.difficulty} · ${draft.content.topic} · ${draft.content.date} · ${draft.publicationStatus} · draft ${draft.draftRevision ?? 0}`} onOpen={(draft) => onNavigate(`/content/challenges/${draft.contentId}/edit`)} /></section>;
}

function ChallengeEditor({ routeId, role, readOnly, onDirtyChange }) {
  const { draft, dirty, saveError, edit, reload } = useAutosavedDraft({ routeId, createDraft: createChallengeDraft, repository, readOnly, onDirtyChange });
  const [view, setView] = useState('content');
  const [validation, setValidation] = useState(null);
  const [assignment, setAssignment] = useState({ busy: false, message: '', error: '' });
  const content = draft.content;
  const patch = (delta) => { if (!readOnly) { edit((current) => ({ ...current, content: { ...current.content, ...delta } })); setValidation(null); } };
  const blocks = useLegacyBlockWorkspace({ scopeId: content.challengeId, blocks: content.blocks, setBlocks: (next) => patch({ blocks: next }), makeId: challengeUid });
  const json = useMemo(() => JSON.stringify({ ...draft, documentId: undefined, draftRevision: undefined }, null, 2), [draft]);
  const previewQuestion = { ...content, questionId: content.challengeId, xp: 0 };
  const schedule = async () => {
    if (!window.confirm(`Assign the ACTIVE Challenge to ${content.date}? Existing daily assignments will not be replaced.`)) return;
    setAssignment({ busy: true, message: '', error: '' });
    try {
      const result = await adminContentRequest('assign-challenge', { method: 'POST', body: { contentId: draft.contentId } });
      setAssignment({ busy: false, message: `Assigned to ${result.assignment.date}.`, error: '' });
    } catch (error) { setAssignment({ busy: false, message: '', error: error.message }); }
  };
  return <div className="project-studio practice-studio studio-unified">
    <StudioHeader type="CHALLENGE" title={content.title} draft={draft} dirty={dirty} saveError={saveError} readOnly={readOnly} role={role} view={view} onView={(next) => setView(next === 'author' ? 'content' : next)} onValidate={() => setValidation(validateChallengeDraft(draft))} onHistory={() => document.getElementById('project-publication-title')?.scrollIntoView()} onPublish={() => document.getElementById('content-studio-publish-button')?.click()} />
    {view !== 'json' && view !== 'preview' ? <nav className="studio-content-tabs" aria-label="Challenge authoring sections"><button type="button" aria-current={view === 'content' ? 'page' : undefined} onClick={() => setView('content')}>Content</button><button type="button" aria-current={view === 'code' ? 'page' : undefined} onClick={() => setView('code')}>Code &amp; Verification</button></nav> : null}
    {view === 'json' ? <section className="content-json-view"><pre><code>{json}</code></pre></section> : view === 'preview' ? <PracticePreview question={previewQuestion} rewardLabel={`${content.reward.coins} coins (display only)`} /> : view === 'code' ? <div className="studio-code-workspace"><section className="project-form"><h2>Code &amp; Verification</h2><p>Trusted expected-output comparison only. Preview does not award coins or record completion.</p><div className="studio-verification-grid">{area('Starter code', content.starterCode, (value) => patch({ starterCode: value }), readOnly)}{area('Standard input', content.stdin, (value) => patch({ stdin: value }), readOnly)}{area('Expected output', content.verification.expectedOutput, (value) => patch({ verification: { ...content.verification, expectedOutput: value } }), readOnly)}<label><span>Comparison</span><select value={content.verification.comparison} disabled={readOnly} onChange={(event) => patch({ verification: { ...content.verification, comparison: event.target.value } })}><option value="normalized-lines">Normalized lines</option><option value="trimmed">Trimmed</option><option value="exact">Exact</option></select></label></div></section></div> : <StudioWorkspace structureLabel="Problem outline" toolbar={<BlockPalette variant="toolbar" definitions={palette} create={(type) => newBlock(type, content.language)} dispatch={blocks.dispatch} disabled={readOnly} selectedBlockId={blocks.selectedBlockId} />} structure={<nav className="project-tree" aria-label="Problem outline"><button type="button" onClick={() => blocks.setSelectedBlockId(null)}>Challenge properties</button>{content.blocks.map((block, index) => <button type="button" key={block.id} aria-current={blocks.selectedBlockId === block.id ? 'true' : undefined} onClick={() => blocks.setSelectedBlockId(block.id)}>{index + 1}. {block.type}</button>)}</nav>} canvas={<><header className="studio-canvas-heading"><h2>Problem statement</h2><span>{content.blocks.length} blocks</span></header><BlockCanvas blocks={blocks.canvasBlocks} selectedBlockId={blocks.selectedBlockId} readOnly={readOnly} language={content.language} dispatch={blocks.dispatch} create={(type) => newBlock(type, content.language)} renderPreview={(block) => <p className="studio-block-summary">{String(block.text ?? block.content ?? block.code ?? '').slice(0, 220)}</p>} /></>} inspector={<><h2 className="studio-inspector-heading">{blocks.selectedBlock ? 'Block properties' : 'Challenge properties'}</h2>{blocks.selectedBlock ? <LegacyBlockInspector block={blocks.selectedBlock} readOnly={readOnly} onChange={(delta) => patch({ blocks: content.blocks.map((block) => block.id === blocks.selectedBlockId ? { ...block, ...delta } : block) })} /> : <div className="project-form"><section><div className="project-fields">{field('Stable Challenge ID', content.challengeId, () => {}, true)}{field('Title', content.title, (value) => patch({ title: value }), readOnly)}{area('Summary', content.summary, (value) => patch({ summary: value }), readOnly)}{area('Motivation', content.motivation, (value) => patch({ motivation: value }), readOnly)}{field('Date (YYYY-MM-DD)', content.date, (value) => patch({ date: value }), readOnly, { type: 'date' })}<label><span>Language</span><select value={content.language} disabled={readOnly} onChange={(event) => patch({ language: event.target.value })}>{['python', 'java', 'cpp'].map((language) => <option key={language}>{language}</option>)}</select></label><label><span>Difficulty</span><select value={content.difficulty} disabled={readOnly} onChange={(event) => patch({ difficulty: event.target.value })}>{['easy', 'medium', 'hard'].map((value) => <option key={value}>{value}</option>)}</select></label>{field('Topic', content.topic, (value) => patch({ topic: value }), readOnly)}{field('Estimated minutes', content.estimatedMinutes, (value) => patch({ estimatedMinutes: Number(value) }), readOnly, { type: 'number', min: 1 })}{field('Reward coins (display only)', content.reward.coins, (value) => patch({ reward: { ...content.reward, coins: Number(value) } }), readOnly, { type: 'number', min: 0 })}</div><p>Daily assignment and rewards remain server-authoritative; publishing this draft does not schedule it.</p></section></div>}</>} />}
    {validation ? <section className="project-validation" aria-live="polite"><h2>Challenge validation</h2>{validation.valid ? <p>Content is valid</p> : <ul>{validation.errors.map((error, index) => <li key={index}>{error.path}: {error.message}</li>)}</ul>}</section> : null}
    {repository.publish ? <><ProjectPublicationPanel draft={draft} dirty={dirty} role={role} repository={repository} onValidation={setValidation} onReload={reload} /><section className="project-publication"><h2>Daily assignment</h2><p>Publishing does not replace an existing date. Assignment pins the ACTIVE artifact and uses the server's fixed daily reward policy.</p>{hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_PUBLISH) ? <button type="button" disabled={dirty || assignment.busy || draft.draftRevision < 1} onClick={schedule}>{assignment.busy ? 'Assigning…' : 'Assign ACTIVE Challenge to date'}</button> : null}{assignment.message ? <p role="status">{assignment.message}</p> : null}{assignment.error ? <p role="alert">{assignment.error}</p> : null}</section></> : null}
  </div>;
}
