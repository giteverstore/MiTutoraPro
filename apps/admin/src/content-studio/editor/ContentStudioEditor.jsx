import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Braces, CheckCircle2, PanelLeft, PanelRight, Redo2, Undo2 } from 'lucide-react';
import { CONTENT_TYPES } from '../../../../../shared/content/index.js';
import { BlockCanvas } from '../blocks/BlockCanvas.jsx';
import { BlockPalette } from '../blocks/BlockPalette.jsx';
import { BlockInspector } from '../inspector/BlockInspector.jsx';
import { LocalDraftRepository } from '../persistence/DraftRepository.js';
import { useDraftAutosave } from '../persistence/useDraftAutosave.js';
import { createEmptyEditorDocument, stringifyEditorDocument } from '../serialization/editorSerialization.js';
import { createEditorState, editorReducer } from '../state/editorState.js';
import { validateEditorDocument } from '../validation/editorValidation.js';
import { ValidationPanel } from '../validation/ValidationPanel.jsx';
import '../content-studio.css';

const localRepository = new LocalDraftRepository();
const noop = () => {};

export function ContentStudioEditor({ readOnly = false, repository = localRepository, initialDocument, onDirtyChange = noop }) {
  const [state, dispatch] = useReducer(editorReducer, initialDocument ?? createEmptyEditorDocument(), (document) => createEditorState(document, { readOnly }));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [compactPanels, setCompactPanels] = useState(() => window.matchMedia('(max-width: 1180px)').matches);
  const pendingBlockFocus = useRef(null);
  const selectedBlock = state.document.blocks.find(({ blockId }) => blockId === state.selectedBlockId) ?? null;
  const generatedJson = useMemo(() => stringifyEditorDocument(state.document), [state.document]);
  useDraftAutosave({ state, dispatch, repository });

  useEffect(() => { onDirtyChange(state.dirty); return () => onDirtyChange(false); }, [onDirtyChange, state.dirty]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1180px)');
    const update = () => setCompactPanels(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const closePanels = (event) => { if (event.key === 'Escape') { setPaletteOpen(false); setInspectorOpen(false); document.querySelector('.content-panel-toggle[aria-expanded="true"]')?.focus(); } };
    window.addEventListener('keydown', closePanels);
    return () => window.removeEventListener('keydown', closePanels);
  }, []);
  useEffect(() => {
    if (pendingBlockFocus.current !== state.selectedBlockId) return;
    pendingBlockFocus.current = null;
    document.querySelector('.content-studio-canvas .content-canvas-block[aria-current="true"]')?.focus();
  }, [state.selectedBlockId]);
  useEffect(() => {
    let active = true;
    repository.load(state.document.documentId).then((recovered) => { if (active && recovered) dispatch({ type: 'hydrate', document: recovered }); }).catch(() => {});
    return () => { active = false; };
  }, [repository, state.document.documentId]);
  useEffect(() => {
    const beforeUnload = (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [state.dirty]);
  useEffect(() => {
    const shortcut = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable)) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const validate = () => dispatch({ type: 'validation', result: validateEditorDocument(state.document) });
  return <div className="content-studio-page"><header className="content-studio-heading"><div><h1>Document Editor</h1><p>Inspect and edit structured documents outside the normal content workflow.</p></div><div className="content-studio-status" role="status" aria-live="polite"><span className={`is-${state.saveState}`}>{state.saveState === 'saving' ? 'Saving...' : state.saveState === 'failed' ? 'Save failed' : state.dirty ? 'Unsaved' : 'Saved'}</span>{readOnly ? <strong>Read only</strong> : null}</div></header>
    <section className="content-studio-metadata" aria-label="Document metadata"><label><span>Content ID</span><input value={state.document.contentId} readOnly={readOnly} onChange={(event) => dispatch({ type: 'metadata', patch: { contentId: event.target.value } })} /></label><label><span>Title</span><input value={state.document.title} readOnly={readOnly} onChange={(event) => dispatch({ type: 'metadata', patch: { title: event.target.value } })} /></label><label><span>Content type</span><select value={state.document.contentType} disabled={readOnly} onChange={(event) => dispatch({ type: 'metadata', patch: { contentType: event.target.value } })}><option value={CONTENT_TYPES.COURSE}>Course document</option><option value={CONTENT_TYPES.PRACTICE}>Practice document</option><option value={CONTENT_TYPES.CHALLENGE}>Challenge document</option></select></label><label><span>Locale</span><input value={state.document.locale} readOnly /></label></section>
    <div className="content-studio-toolbar"><div role="tablist" aria-label="Editor views"><button type="button" role="tab" aria-selected={state.view === 'editor'} onClick={() => dispatch({ type: 'view', view: 'editor' })}>Editor</button><button type="button" role="tab" aria-selected={state.view === 'json'} onClick={() => dispatch({ type: 'view', view: 'json' })}><Braces />Generated JSON</button></div><div><button type="button" className="content-panel-toggle" aria-controls="content-block-palette" onClick={() => { setPaletteOpen((value) => !value); setInspectorOpen(false); }} aria-expanded={paletteOpen}><PanelLeft />Blocks</button><button type="button" disabled={!state.past.length || readOnly} onClick={() => dispatch({ type: 'undo' })}><Undo2 />Undo</button><button type="button" disabled={!state.future.length || readOnly} onClick={() => dispatch({ type: 'redo' })}><Redo2 />Redo</button><button type="button" onClick={validate}><CheckCircle2 />Validate</button><button type="button" className="content-panel-toggle" aria-controls="content-properties-inspector" onClick={() => { setInspectorOpen((value) => !value); setPaletteOpen(false); }} aria-expanded={inspectorOpen}><PanelRight />Properties</button></div></div>
    {state.view === 'json' ? <section className="content-json-view" aria-label="Generated JSON"><header><strong>Generated canonical JSON</strong><span>Read only</span></header><pre><code>{generatedJson}</code></pre></section> : <div className={`content-studio-workspace${paletteOpen ? ' palette-open' : ''}${inspectorOpen ? ' inspector-open' : ''}`}><BlockPalette dispatch={dispatch} disabled={readOnly} hidden={compactPanels && !paletteOpen} onClose={compactPanels ? () => { setPaletteOpen(false); document.querySelector('.content-panel-toggle[aria-controls="content-block-palette"]')?.focus(); } : undefined} onAdd={compactPanels ? (blockId) => { pendingBlockFocus.current = blockId; setPaletteOpen(false); } : undefined} /><BlockCanvas blocks={state.document.blocks} selectedBlockId={state.selectedBlockId} readOnly={readOnly} language={state.document.supportedLanguages[0]} dispatch={dispatch} /><BlockInspector block={selectedBlock} supportedLanguages={state.document.supportedLanguages} readOnly={readOnly} dispatch={dispatch} hidden={compactPanels && !inspectorOpen} /></div>}
    <ValidationPanel result={state.validation} onSelectIssue={(blockId) => { dispatch({ type: 'view', view: 'editor' }); dispatch({ type: 'select', blockId }); }} />
  </div>;
}
