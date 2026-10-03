import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, Bot, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Crown, Download, FileCode2, FileJson, FileText, Folder, FolderOpen, FolderPlus, ListChecks, Pencil, Plus, RotateCcw, Settings, Trash2, X } from 'lucide-react';
import { EditorPlaceholder } from '../../components/EditorPlaceholder';
import { useCompilerManager } from '../../compiler/CompilerProvider';
import { canAccessProjectPage } from '../../access/accessPolicy';
import { openPremiumPlans } from '../../access/PremiumGate';
import { supportedCompilerLanguages } from '../../compiler/languages/supportedLanguages';
import { ProjectValidator } from '../validation/ProjectValidator';
import { projectExporter } from '../export/ProjectExporter';
import { projectProgressService } from '../services/ProjectProgressService';
import { buildProjectTree, createInitialProjectFiles, languageForPath, validateProjectFilePath, validateProjectFolderPath } from '../workspace/projectWorkspaceFiles';
import { ProjectLanguagePicker } from '../workspace/ProjectLanguagePicker';
import { useProjectWorkspacePreferences } from '../workspace/useProjectWorkspacePreferences';
import { resolveProjectRuntime } from '../runtime/projectRuntimeRegistry';
import { ProjectGuideRenderer } from '../components/ProjectGuideRenderer';
import { ProjectContextualAI, createProjectAIContext } from '../components/ProjectContextualAI';
import { ConfirmDialog } from '../../components/Dialog';
import { mergeProjectExecutionSnapshot } from '../execution/projectFilesystem';

export const PROJECT_WORKSPACE_PAGES = Object.freeze([
  { id: 'requirements', label: 'Requirements' }, { id: 'contract', label: 'Function contract' },
  { id: 'example', label: 'Example' }, { id: 'implementation', label: 'Implementation' },
]);
const PANEL_HEIGHT_KEY = 'ycoders.projectWorkspace.bottomPanelHeight';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const initialPanelHeight = () => { try { return clamp(Number(localStorage.getItem(PANEL_HEIGHT_KEY)) || 190, 120, 360); } catch { return 190; } };
const handleTabListKeyDown = (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
  const current = tabs.indexOf(event.currentTarget);
  if (current < 0 || !tabs.length) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
};

function ProjectPremiumBoundary() {
  return <section className="project-premium-boundary" role="region" aria-labelledby="project-premium-boundary-title"><Crown /><h2 id="project-premium-boundary-title">Continue this project with Premium</h2><p>You’ve reached the end of the free project preview. Upgrade to continue building the full project.</p><button className="button button--primary" type="button" onClick={openPremiumPlans}>View Premium Plans</button></section>;
}

function GuideContent({ project, page, allowed }) {
  if (!allowed) return <ProjectPremiumBoundary />;
  if (page.guide) return <ProjectGuideRenderer blocks={page.guide} project={project} runtime={page.runtime} />;
  if (page.id === 'requirements') return <ul>{project.requirements.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (page.id === 'contract') return <div className="project-guide-contract"><code>{project.functionDefinition.name}({project.functionDefinition.parameters.join(', ')}) → {project.functionDefinition.returns}</code></div>;
  if (page.id === 'example') return <dl><div><dt>Input</dt><dd><code>{project.example.input}</code></dd></div><div><dt>Output</dt><dd><code>{project.example.output}</code></dd></div></dl>;
  return <div className="project-guide-implementation"><p>{project.instructions}</p><h3>Success requirements</h3><ul>{project.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

const fileName = (path) => path.split('/').at(-1);
export const projectModelOwnerPrefix = (projectId) => `ycoders-project://${encodeURIComponent(projectId)}/`;
export const projectModelPath = (projectId, path) => `${projectModelOwnerPrefix(projectId)}${String(path).split('/').map(encodeURIComponent).join('/')}`;

export function ProjectWorkspace({ project, tier = 'FREE', onBack, onProgress, initialPageIndex }) {
  const manager = useCompilerManager();
  const workspacePreferences = useProjectWorkspacePreferences();
  const validator = useMemo(() => new ProjectValidator(manager), [manager]);
  const savedProgress = projectProgressService.get(project.id);
  const [activeProgress, setActiveProgress] = useState(savedProgress);
  const [activeLanguageId, setActiveLanguageId] = useState(savedProgress.languageId ?? project.language);
  const runtime = useMemo(() => resolveProjectRuntime(project, activeLanguageId), [project, activeLanguageId]);
  const workspacePages = project.checkpoints.length > 1 ? project.checkpoints.map((checkpoint) => ({ ...checkpoint, label: checkpoint.title, runtime })) : PROJECT_WORKSPACE_PAGES;
  const initialWorkspace = useMemo(() => createInitialProjectFiles(project, savedProgress, runtime), [project.id, activeLanguageId]);
  const [files, setFiles] = useState(initialWorkspace.files);
  const [folders, setFolders] = useState(initialWorkspace.folders);
  const [entryFilePath, setEntryFilePath] = useState(initialWorkspace.entryFilePath);
  const [openTabs, setOpenTabs] = useState([initialWorkspace.entryFilePath]);
  const [activeFilePath, setActiveFilePath] = useState(initialWorkspace.entryFilePath);
  const [dirtyFiles, setDirtyFiles] = useState(new Set());
  const [fileError, setFileError] = useState('');
  const [pageIndex, setPageIndex] = useState(clamp(initialPageIndex ?? savedProgress.currentCheckpoint ?? savedProgress.lastPageIndex ?? 0, 0, workspacePages.length - 1));
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [bottomTab, setBottomTab] = useState('output');
  const [leftMode, setLeftMode] = useState(project.checkpoints.length > 1 ? 'checkpoints' : 'files');
  const [rightMode, setRightMode] = useState('guide');
  const [compilerLanguageId, setCompilerLanguageId] = useState(activeLanguageId);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [pendingLanguageId, setPendingLanguageId] = useState(null);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(280);
  const [aiWidth, setAiWidth] = useState(360);
  const [bottomHeight, setBottomHeight] = useState(initialPanelHeight);
  const controller = useRef(null);
  const resizeCleanup = useRef(null);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [aiSelection, setAISelection] = useState(null);
  const [saveState, setSaveState] = useState({ status: 'saved', error: null });
  const [exportState, setExportState] = useState({ running: false, error: '' });
  const allowed = canAccessProjectPage({ tier, pageIndex });
  const page = workspacePages[pageIndex];
  const activeFile = activeFilePath ? files[activeFilePath] : null;
  const entryFile = files[entryFilePath];
  const status = running ? 'Running' : result?.passed ? 'Success' : result ? 'Error' : 'Ready';
  const selectForAI = (selectionType, selectedContent, extra = {}) => {
    try { setAISelection(createProjectAIContext({ project, checkpoint: page, languageId: activeLanguageId, selectionType, selectedContent, guideContext: page.objective, currentFile: activeFile ? { path: activeFilePath, content: activeFile.content } : null, ...extra })); setRightMode('ai'); }
    catch { /* Ignore empty or unsupported selections. */ }
  };
  const compilerLanguage = supportedCompilerLanguages.find(({ id }) => id === compilerLanguageId)
    ?? supportedCompilerLanguages.find(({ id }) => id === project.language);
  const languageLabel = compilerLanguage?.label ?? compilerLanguageId;
  const modelOwnerPrefix = projectModelOwnerPrefix(project.id);
  const retainedModelPaths = openTabs.map((path) => projectModelPath(project.id, path));
  const persist = (nextFiles, nextEntry = entryFilePath, nextFolders = folders, options) => projectProgressService.saveWorkspace(project.id, nextFiles, nextEntry, nextFolders, options);
  const visit = (index) => { const safe = clamp(index, 0, workspacePages.length - 1); setPageIndex(safe); projectProgressService.visitPage(project.id, safe); onProgress?.(); };
  const openFile = (path) => { setOpenTabs((tabs) => tabs.includes(path) ? tabs : [...tabs, path]); setActiveFilePath(path); };
  const closeTab = (path) => setOpenTabs((tabs) => { const index = tabs.indexOf(path); const next = tabs.filter((tab) => tab !== path); if (activeFilePath === path) setActiveFilePath(next[Math.min(index, next.length - 1)] ?? null); return next; });
  const updateActiveFile = (content) => { if (!activeFilePath) return; const next = { ...files, [activeFilePath]: { ...activeFile, content } }; setFiles(next); setDirtyFiles((dirty) => new Set(dirty).add(activeFilePath)); setResult(null); persist(next); };
  const createFile = (requested) => { const checked = validateProjectFilePath(requested, files, project.language); if (!checked.valid) { setFileError(checked.error); return false; } const next = { ...files, [checked.path]: { path: checked.path, content: '', language: languageForPath(checked.path, project.language), editable: true } }; setFiles(next); setFileError(''); persist(next); setOpenTabs((tabs) => [...tabs, checked.path]); setActiveFilePath(checked.path); return true; };
  const createFolder = (requested) => { const checked = validateProjectFolderPath(requested, files, folders); if (!checked.valid) { setFileError(checked.error); return false; } const next = [...folders, checked.path]; setFolders(next); setFileError(''); persist(files, entryFilePath, next); return true; };
  const renameFile = (path, requested) => { if (requested === path) return true; const checked = validateProjectFilePath(requested, files, project.language); if (!checked.valid) { setFileError(checked.error); return false; } const next = { ...files, [checked.path]: { ...files[path], path: checked.path, language: languageForPath(checked.path, project.language) } }; delete next[path]; const nextEntry = entryFilePath === path ? checked.path : entryFilePath; setFiles(next); setEntryFilePath(nextEntry); setOpenTabs((tabs) => tabs.map((tab) => tab === path ? checked.path : tab)); setActiveFilePath((active) => active === path ? checked.path : active); setDirtyFiles((dirty) => new Set([...dirty].map((item) => item === path ? checked.path : item))); setFileError(''); persist(next, nextEntry); return true; };
  const deleteFile = (path) => { if (path === entryFilePath) { setFileError('The project entry file cannot be deleted.'); return; } if (files[path].content && !window.confirm(`Delete ${path}?`)) return; const next = { ...files }; delete next[path]; setFiles(next); setDirtyFiles((dirty) => { const changed = new Set(dirty); changed.delete(path); return changed; }); closeTab(path); setFileError(''); persist(next); };
  const validate = async () => {
    if (!canAccessProjectPage({ tier, pageIndex })) { return; }
    if (project.checkpoints.length > 1 && pageIndex > activeProgress.currentCheckpoint) { setBottomOpen(true); setBottomTab('problems'); setResult({ passed: false, tests: [], score: 0, errors: ['Complete the current checkpoint before validating this one.'] }); return; }
    controller.current?.abort(); controller.current = new AbortController(); setRunning(true); setResult(null); setBottomOpen(true); setBottomTab('tests');
    const mountedFiles = files;
    try {
      const next = await validator.validateProject(
        { ...project, language: activeLanguageId, expectedOutput: page.expectedOutput, validation: page.validation ?? project.validation, template: { ...project.template, sourcePath: entryFilePath } },
        entryFile.content,
        { signal: controller.current.signal, files: mountedFiles, entrypoint: entryFilePath, runtime },
      );
      if (next.projectFiles) {
        setFiles((currentFiles) => {
          const merged = Object.fromEntries(Object.entries(mergeProjectExecutionSnapshot(currentFiles, mountedFiles, next.projectFiles).files).map(([path, file]) => [path, { ...file, language: file.language ?? languageForPath(path, activeLanguageId) }]));
          persist(merged, entryFilePath, folders, { immediate: true });
          return merged;
        });
      } else persist(mountedFiles, entryFilePath, folders, { immediate: true });
      setResult(next);
      if (next.passed) { setDirtyFiles(new Set()); setActiveProgress(projectProgressService.completeCheckpoint(project.id, page.id, pageIndex, workspacePages.length)); }
      onProgress?.(projectProgressService.recordValidation(project.id, next, entryFile.content));
    }
    catch (error) { if (error.name !== 'AbortError') setResult({ passed: false, tests: [], score: 0, errors: [error.message] }); }
    finally { setRunning(false); }
  };
  const downloadProject = async () => {
    if (exportState.running) return;
    setExportState({ running: true, error: '' });
    try {
      await projectProgressService.flush(project.id);
      if (project.checkpoints.length > 1) await projectExporter.downloadWorkspace(project, files);
      else await projectExporter.download(project, entryFile.content);
      setExportState({ running: false, error: '' });
    } catch {
      setExportState({ running: false, error: 'Project download failed. Your work is still saved; please try again.' });
    }
  };
  const resizeSide = (side, event) => { event.preventDefault(); resizeCleanup.current?.(); const start = event.clientX; const width = side === 'left' ? leftWidth : aiWidth; const move = (next) => side === 'left' ? setLeftWidth(clamp(width + next.clientX - start, 220, 380)) : setAiWidth(clamp(width + start - next.clientX, 300, 440)); const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); if (resizeCleanup.current === stop) resizeCleanup.current = null; }; resizeCleanup.current = stop; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true }); };
  const resizeBottom = (event) => { event.preventDefault(); resizeCleanup.current?.(); const start = event.clientY; const height = bottomHeight; let resized = height; const move = (next) => { resized = clamp(height + start - next.clientY, 120, 360); setBottomHeight(resized); }; const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); if (resizeCleanup.current === stop) resizeCleanup.current = null; try { localStorage.setItem(PANEL_HEIGHT_KEY, String(resized)); } catch { /* best effort */ } }; resizeCleanup.current = stop; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true }); };
  const resizeSideWithKeyboard = (side, event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 10 : -10;
    if (side === 'left') setLeftWidth((width) => clamp(width + delta, 220, 380));
    else setAiWidth((width) => clamp(width - delta, 300, 440));
  };
  const resizeBottomWithKeyboard = (event) => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setBottomHeight((height) => {
      const next = clamp(height + (event.key === 'ArrowUp' ? 10 : -10), 120, 360);
      try { localStorage.setItem(PANEL_HEIGHT_KEY, String(next)); } catch { /* best effort */ }
      return next;
    });
  };
  useEffect(() => setCursorPosition({ lineNumber: 1, column: 1 }), [activeFilePath]);
  useEffect(() => projectProgressService.subscribe(project.id, setSaveState), [project.id]);
  useEffect(() => () => { resizeCleanup.current?.(); controller.current?.abort(); void projectProgressService.flush(project.id).catch(() => {}); }, [project.id]);

  return <div className={`project-ide-shell${leftMode ? '' : ' is-explorer-collapsed'}${bottomOpen ? '' : ' is-bottom-collapsed'}`} data-project-theme={workspacePreferences.resolvedTheme}>
    <header className="project-ide-topbar"><button type="button" onClick={() => { void projectProgressService.flush(project.id).catch(() => {}); onBack(); }}><ArrowLeft /> Projects</button><strong>{project.title}</strong><span className="project-checkpoint-summary">{pageIndex + 1} / {workspacePages.length} · {page.label} · {languageLabel}</span><span className={`project-cloud-save-control is-${saveState.status}`} title={saveState.status === 'conflict' ? 'A newer version of this project was saved elsewhere. Reload to continue with the latest version.' : saveState.error?.message}><span className="project-cloud-save-state" role={saveState.status === 'error' || saveState.status === 'conflict' ? 'alert' : 'status'}>{saveState.status === 'saving' ? 'Saving…' : saveState.status === 'error' ? 'Save failed' : saveState.status === 'conflict' ? 'Conflict detected' : 'Saved'}</span>{saveState.status === 'error' ? <button type="button" onClick={() => void projectProgressService.retry(project.id).catch(() => {})}>Retry</button> : null}{saveState.status === 'conflict' ? <button type="button" onClick={() => window.location.reload()}>Reload</button> : null}</span><button className="button button--primary project-run-button" type="button" disabled={running || page.executionMode === 'terminal_only' || (project.checkpoints.length === 1 && page.id !== 'implementation')} title={page.executionMode === 'terminal_only' ? 'Use the terminal for this checkpoint.' : 'Run the active project entrypoint'} aria-describedby={page.executionMode === 'terminal_only' ? 'project-run-help' : undefined} onClick={validate}>{running ? 'Running…' : 'Run'}</button>{page.executionMode === 'terminal_only' ? <span className="sr-only" id="project-run-help">Run is disabled for this checkpoint. Enter the configured command in the terminal.</span> : null}</header>
    <div className="project-ide-main" style={{ '--project-explorer-width': `${leftWidth}px`, '--project-guide-width': `${aiWidth}px`, '--project-bottom-height': `${bottomHeight}px` }}>
      <nav className="project-activity-bar" aria-label="Project workspace tools"><button className={leftMode === 'checkpoints' ? 'is-active' : ''} type="button" aria-label="Checkpoints" onClick={() => setLeftMode((mode) => mode === 'checkpoints' ? null : 'checkpoints')}><ListChecks /></button><button className={leftMode === 'files' ? 'is-active' : ''} type="button" aria-label="Files" onClick={() => setLeftMode((mode) => mode === 'files' ? null : 'files')}><FolderOpen /></button><button className={`project-settings-activity${leftMode === 'settings' ? ' is-active' : ''}`} type="button" aria-label="Settings" onClick={() => setLeftMode((mode) => mode === 'settings' ? null : 'settings')}><Settings /></button></nav>
      {leftMode ? <aside className="project-explorer-panel" aria-label={leftMode === 'settings' ? 'Settings' : leftMode === 'checkpoints' ? 'Checkpoints' : 'Explorer'}>{leftMode === 'settings' ? <SettingsPanel preferences={workspacePreferences} /> : leftMode === 'checkpoints' ? <CheckpointPanel checkpoints={workspacePages} pageIndex={pageIndex} completed={activeProgress.completedCheckpoints} onVisit={visit} /> : <FilesPanel project={project} files={files} folders={folders} activeFilePath={activeFilePath} entryFilePath={entryFilePath} fileError={fileError} onCreateFile={createFile} onCreateFolder={createFolder} onOpen={openFile} onRename={renameFile} onDelete={deleteFile} />}</aside> : null}
      {leftMode ? <div className="project-vertical-resizer is-left" role="separator" tabIndex="0" aria-label="Resize left panel" aria-orientation="vertical" aria-valuemin="220" aria-valuemax="380" aria-valuenow={leftWidth} onKeyDown={(event) => resizeSideWithKeyboard('left', event)} onPointerDown={(event) => resizeSide('left', event)} /> : null}
      <main className="project-editor-pane"><EditorTabs openTabs={openTabs} activeFilePath={activeFilePath} dirtyFiles={dirtyFiles} onActivate={setActiveFilePath} onClose={closeTab} />{!allowed && page.id === 'implementation' ? <div className="project-editor-locked" aria-label="Project editor locked"><Crown /><p>Upgrade to Premium to edit and validate the implementation.</p></div> : activeFile ? <EditorPlaceholder editor={{ ariaLabel: activeFilePath === entryFilePath ? `${project.title} implementation editor` : `${project.title} ${activeFilePath} editor`, fileName: activeFilePath, language: activeFile.language, modelPath: projectModelPath(project.id, activeFilePath) }} value={activeFile.content} onChange={updateActiveFile} onCursorPositionChange={setCursorPosition} onAskSelection={({ text }) => selectForAI('user_code', text)} instanceId={`project-${project.id}-${activeFilePath}`} workspacePreferences={workspacePreferences.editorPreferences} loadingTheme={workspacePreferences.resolvedTheme} modelOwnerPrefix={modelOwnerPrefix} retainedModelPaths={retainedModelPaths} /> : <div className="project-editor-empty"><FileCode2 /><p>Open a file from Explorer to start editing.</p></div>}</main>
      <div className="project-vertical-resizer is-right" role="separator" tabIndex="0" aria-label="Resize Guide and AI" aria-orientation="vertical" aria-valuemin="300" aria-valuemax="440" aria-valuenow={aiWidth} onKeyDown={(event) => resizeSideWithKeyboard('right', event)} onPointerDown={(event) => resizeSide('right', event)} />
      <aside className="project-ai-panel" aria-label="Guide and AI"><header><div className="project-right-tabs" role="tablist" aria-label="Project assistance"><button className={rightMode === 'guide' ? 'is-active' : ''} type="button" role="tab" aria-selected={rightMode === 'guide'} tabIndex={rightMode === 'guide' ? 0 : -1} onKeyDown={handleTabListKeyDown} onClick={() => setRightMode('guide')}><ListChecks /> Guide</button><button className={rightMode === 'ai' ? 'is-active' : ''} type="button" role="tab" aria-selected={rightMode === 'ai'} tabIndex={rightMode === 'ai' ? 0 : -1} onKeyDown={handleTabListKeyDown} onClick={() => setRightMode('ai')}><Bot /> AI</button></div></header><div className={`project-right-mode project-guide-mode${rightMode === 'guide' ? ' is-active' : ''}`}><GuidePanel project={project} page={page} pageIndex={pageIndex} pageCount={workspacePages.length} allowed={allowed} onVisit={visit} onSelectForAI={selectForAI} /></div><div className={`project-right-mode project-ai-mode${rightMode === 'ai' ? ' is-active' : ''}`}><ProjectContextualAI context={aiSelection} accessTier={tier} /></div></aside>
      {bottomOpen ? <div className="project-horizontal-resizer" role="separator" tabIndex="0" aria-label="Resize bottom panel" aria-orientation="horizontal" aria-valuemin="120" aria-valuemax="360" aria-valuenow={bottomHeight} onKeyDown={resizeBottomWithKeyboard} onPointerDown={resizeBottom} /> : null}
      <BottomPanel open={bottomOpen} tab={bottomTab} setTab={setBottomTab} setOpen={setBottomOpen} running={running} result={result} runtime={runtime} checkpoint={page} onRun={validate} onSelectForAI={selectForAI} status={status} />
    </div>
    {result?.passed && pageIndex === workspacePages.length - 1 ? <section className="project-complete-overlay" role="status"><CheckCircle2 aria-hidden="true" /><div><strong>Project Complete</strong><span>{project.title} · {languageLabel} · {workspacePages.length} checkpoints</span>{exportState.error ? <small className="project-export-error" role="alert">{exportState.error}</small> : null}</div><button className="button button--primary" type="button" disabled={exportState.running} onClick={downloadProject}><Download /> {exportState.running ? 'Preparing…' : 'Download Project'}</button><button className="button button--secondary" type="button" onClick={onBack}>Back to Projects</button></section> : null}
    <footer className="project-ide-statusbar"><div className="project-status-left"><span>{status}</span>{exportState.error ? <span className="project-export-error" role="alert">{exportState.error}</span> : null}</div><div className="project-status-right"><button className="project-status-language" type="button" aria-haspopup="dialog" aria-expanded={languagePickerOpen} onClick={() => setLanguagePickerOpen(true)}>{languageLabel}<ChevronDown /></button><span>Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span><span>Spaces: {workspacePreferences.preferences.tabSize}</span><span>UTF-8</span><span>LF</span>{result?.passed ? <button type="button" disabled={exportState.running} onClick={downloadProject}><Download /> {exportState.running ? 'Preparing…' : 'Export'}</button> : null}<button type="button" aria-label="Notifications"><Bell /></button></div></footer>
    <ProjectLanguagePicker open={languagePickerOpen} activeLanguageId={compilerLanguageId} allowedProjectLanguages={project.supportedLanguages} theme={workspacePreferences.resolvedTheme} onClose={() => setLanguagePickerOpen(false)} onSelect={(languageId) => { if (languageId !== compilerLanguageId) setPendingLanguageId(languageId); }} />
    <ConfirmDialog open={Boolean(pendingLanguageId)} title="Change project language?" description="Changing language resets checkpoint progress and workspace files. Version 1 does not keep the previous attempt." confirmLabel="Reset and Change Language" destructive onCancel={() => setPendingLanguageId(null)} onConfirm={() => {
      const nextProgress = projectProgressService.resetForLanguage(project.id, pendingLanguageId);
      const nextRuntime = resolveProjectRuntime(project, pendingLanguageId);
      const nextWorkspace = createInitialProjectFiles(project, nextProgress, nextRuntime);
      setActiveLanguageId(pendingLanguageId);
      setCompilerLanguageId(pendingLanguageId);
      setActiveProgress(nextProgress);
      setFiles(nextWorkspace.files);
      setFolders(nextWorkspace.folders);
      setEntryFilePath(nextWorkspace.entryFilePath);
      setOpenTabs([nextWorkspace.entryFilePath]);
      setActiveFilePath(nextWorkspace.entryFilePath);
      setDirtyFiles(new Set());
      setPageIndex(0);
      setResult(null);
      setPendingLanguageId(null);
      setLanguagePickerOpen(false);
      onProgress?.(nextProgress);
    }} />
  </div>;
}

function FileIcon({ path }) {
  if (path.endsWith('.json')) return <FileJson />;
  if (path.endsWith('.md')) return <FileText />;
  if (path.endsWith('.txt')) return <FileText />;
  return <FileCode2 />;
}

function CheckpointPanel({ checkpoints, pageIndex, completed = [], onVisit }) {
  return <><header><span>Checkpoints</span></header><ol className="project-checkpoint-list">{checkpoints.map((checkpoint, index) => { const isComplete = completed.includes(checkpoint.id); const isCurrent = index === pageIndex; return <li className={isComplete ? 'is-complete' : isCurrent ? 'is-current' : 'is-available'} key={checkpoint.id}><button type="button" aria-current={isCurrent ? 'step' : undefined} onClick={() => onVisit(index)}>{isComplete ? <CheckCircle2 aria-hidden="true" /> : isCurrent ? <Circle aria-hidden="true" /> : <Circle aria-hidden="true" />}<span><strong>{checkpoint.title}</strong><small>{isComplete ? 'Completed' : isCurrent ? 'Current' : 'Available'}</small></span></button></li>; })}</ol></>;
}

function FilesPanel({ project, files, folders, activeFilePath, entryFilePath, fileError, onCreateFile, onCreateFolder, onOpen, onRename, onDelete }) {
  const tree = useMemo(() => buildProjectTree(files, folders), [files, folders]);
  const [rootOpen, setRootOpen] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set(Object.keys(files).flatMap((path) => path.split('/').slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join('/')))));
  const [inline, setInline] = useState(null);
  useEffect(() => { if (!activeFilePath) return; const parts = activeFilePath.split('/').slice(0, -1); setExpanded((current) => new Set([...current, ...parts.map((_, index) => parts.slice(0, index + 1).join('/'))])); }, [activeFilePath]);
  const beginCreate = (kind, parent = '') => { setRootOpen(true); if (parent) setExpanded((current) => new Set(current).add(parent)); setInline({ kind, parent, value: '' }); };
  const submitInline = () => {
    if (!inline) return;
    const path = [inline.parent, inline.value.trim()].filter(Boolean).join('/');
    const accepted = inline.kind === 'folder' ? onCreateFolder(path) : onCreateFile(path);
    if (accepted) { if (inline.kind === 'folder') setExpanded((current) => new Set(current).add(path)); setInline(null); }
  };
  const beginRename = (path) => setInline({ kind: 'rename', parent: path.split('/').slice(0, -1).join('/'), path, value: fileName(path) });
  return <><header><span>Explorer</span><div><button type="button" aria-label="New File" title="New File" onClick={() => beginCreate('file')}><Plus /></button><button type="button" aria-label="New Folder" title="New Folder" onClick={() => beginCreate('folder')}><FolderPlus /></button><button type="button" aria-label="Collapse All" title="Collapse All" onClick={() => { setExpanded(new Set()); setRootOpen(false); }}><ChevronUp /></button></div></header><div className="project-tree" role="tree" aria-label={`${project.title} files`}><div className="project-tree-root" role="treeitem" aria-expanded={rootOpen}><button type="button" onClick={() => setRootOpen((value) => !value)}>{rootOpen ? <ChevronDown /> : <ChevronRight />}<strong>{project.title}</strong></button></div>{rootOpen ? <div role="group">{tree.children.map((node) => <TreeNode key={`${node.type}-${node.path}`} node={node} depth={1} expanded={expanded} setExpanded={setExpanded} activeFilePath={activeFilePath} entryFilePath={entryFilePath} inline={inline} setInline={setInline} submitInline={submitInline} beginCreate={beginCreate} beginRename={beginRename} onOpen={onOpen} onRename={onRename} onDelete={onDelete} />)}{inline && !inline.parent && inline.kind !== 'rename' ? <InlineTreeInput depth={1} inline={inline} setInline={setInline} submit={submitInline} /> : null}</div> : null}</div>{fileError ? <p className="project-file-error" role="alert">{fileError}</p> : null}</>;
}

function TreeNode({ node, depth, expanded, setExpanded, activeFilePath, entryFilePath, inline, setInline, submitInline, beginCreate, beginRename, onOpen, onRename, onDelete }) {
  if (node.type === 'folder') {
    const open = expanded.has(node.path);
    return <div className="project-tree-folder"><div className="project-tree-row" role="treeitem" aria-expanded={open} style={{ '--tree-depth': depth }}><button className="project-tree-main" type="button" onClick={() => setExpanded((current) => { const next = new Set(current); if (open) next.delete(node.path); else next.add(node.path); return next; })}>{open ? <ChevronDown /> : <ChevronRight />}<Folder /><span title={node.path}>{node.name}</span></button><span className="project-tree-actions"><button type="button" aria-label={`New File in ${node.path}`} onClick={() => beginCreate('file', node.path)}><Plus /></button><button type="button" aria-label={`New Folder in ${node.path}`} onClick={() => beginCreate('folder', node.path)}><FolderPlus /></button></span></div>{open ? <div role="group">{node.children.map((child) => <TreeNode {...{ expanded, setExpanded, activeFilePath, entryFilePath, inline, setInline, submitInline, beginCreate, beginRename, onOpen, onRename, onDelete }} node={child} depth={depth + 1} key={`${child.type}-${child.path}`} />)}{inline?.parent === node.path && inline.kind !== 'rename' ? <InlineTreeInput depth={depth + 1} inline={inline} setInline={setInline} submit={submitInline} /> : null}</div> : null}</div>;
  }
  const renaming = inline?.kind === 'rename' && inline.path === node.path;
  return renaming ? <InlineTreeInput depth={depth} inline={inline} setInline={setInline} submit={() => { if (onRenameInline(node.path, inline.value, beginRename)) setInline(null); }} /> : <div className={`project-tree-row${node.path === activeFilePath ? ' is-selected' : ''}`} role="treeitem" aria-selected={node.path === activeFilePath} style={{ '--tree-depth': depth }}><button className="project-tree-main" type="button" onClick={() => onOpen(node.path)}><span className="project-tree-spacer" /><FileIcon path={node.path} /><span title={node.path}>{node.name}</span>{node.path === entryFilePath ? <i title="Project entry file">●</i> : null}</button><span className="project-tree-actions"><button type="button" aria-label={`Rename ${node.path}`} onClick={() => beginRename(node.path)}><Pencil /></button><button type="button" aria-label={`Delete ${node.path}`} disabled={node.path === entryFilePath} onClick={() => onDelete(node.path)}><Trash2 /></button></span></div>;

  function onRenameInline(path, value) { return onRename(path, [path.split('/').slice(0, -1).join('/'), value.trim()].filter(Boolean).join('/')); }
}

function InlineTreeInput({ depth, inline, setInline, submit }) {
  return <div className="project-tree-row is-inline" style={{ '--tree-depth': depth }}><span className="project-tree-spacer" />{inline.kind === 'folder' ? <Folder /> : <FileCode2 />}<input autoFocus aria-label={inline.kind === 'rename' ? `Rename ${inline.path}` : inline.kind === 'folder' ? 'New folder name' : 'New file name'} value={inline.value} onChange={(event) => setInline({ ...inline, value: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') submit(); if (event.key === 'Escape') setInline(null); }} onBlur={() => { if (!inline.value.trim()) setInline(null); }} /></div>;
}

function SettingsPanel({ preferences }) {
  const { preferences: value, update, reset } = preferences;
  return <><header><span>Settings</span></header><div className="project-settings-panel"><h2>Editor</h2><label><span>Appearance</span><select value={value.appearance} onChange={(event) => update('appearance', event.target.value)}><option value="follow-app">Follow application</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label><span>Font size</span><select value={value.fontSize} onChange={(event) => update('fontSize', Number(event.target.value))}>{Array.from({ length: 13 }, (_, index) => index + 12).map((size) => <option value={size} key={size}>{size}px</option>)}</select></label><label><span>Spaces</span><select value={value.tabSize} onChange={(event) => update('tabSize', Number(event.target.value))}>{[2, 4, 8].map((size) => <option value={size} key={size}>{size}</option>)}</select></label><label><span>Word wrap</span><select value={value.wordWrap ? 'on' : 'off'} onChange={(event) => update('wordWrap', event.target.value === 'on')}><option value="on">On</option><option value="off">Off</option></select></label><button type="button" onClick={reset}><RotateCcw /> Reset editor settings</button></div></>;
}

function GuidePanel({ project, page, pageIndex, pageCount = 4, allowed, onVisit, onSelectForAI }) {
  const select = (event) => { const selection = window.getSelection(); const selected = selection?.toString().trim(); if (!selected || !event.currentTarget.contains(selection.anchorNode)) return; onSelectForAI(selection.anchorNode?.parentElement?.closest('pre, code') ? 'guide_code' : 'guide_text', selected); selection.removeAllRanges(); };
  return <><header><span>Project Guide</span></header><div className="project-guide-content" onMouseUp={select}><h2>{page.label}</h2>{page.objective ? <p className="project-checkpoint-objective">{page.objective}</p> : null}<GuideContent project={project} page={page} allowed={allowed} />{page.requirements?.length ? <><h3>Checkpoint requirements</h3><ul>{page.requirements.map((item) => <li key={item}>{item}</li>)}</ul></> : null}</div><footer className="project-guide-navigation"><button type="button" disabled={pageIndex === 0} onClick={() => onVisit(pageIndex - 1)}><ArrowLeft /> Previous</button><span>{pageIndex + 1} / {pageCount}</span><button type="button" disabled={pageIndex === pageCount - 1} onClick={() => onVisit(pageIndex + 1)}>Next <ArrowRight /></button></footer></>;
}

function EditorTabs({ openTabs, activeFilePath, dirtyFiles, onActivate, onClose }) {
  return <div className="project-editor-tabs"><div className="project-open-tabs" role="toolbar" aria-label="Open project files">{openTabs.map((path) => <div className={path === activeFilePath ? 'is-active' : ''} key={path}><button type="button" aria-pressed={path === activeFilePath} onClick={() => onActivate(path)}><FileCode2 /> {fileName(path)}{dirtyFiles.has(path) ? <span aria-label="Modified">●</span> : null}</button><button type="button" aria-label={`Close ${path}`} onClick={() => onClose(path)}><X /></button></div>)}</div></div>;
}

function BottomPanel({ open, tab, setTab, setOpen, running, result, runtime, checkpoint, onRun, onSelectForAI, status }) {
  const [command, setCommand] = useState('');
  const submitCommand = (event) => { event.preventDefault(); if (command.trim() !== runtime.runCommand) return; setCommand(''); onRun(); };
  const selectOutput = (event) => { const selection = window.getSelection(); const selected = selection?.toString().trim(); if (!selected || !event.currentTarget.contains(selection.anchorNode)) return; onSelectForAI('terminal_output', selected, { terminal: { command: runtime.runCommand, status, stream: result?.errors?.length ? 'stderr' : 'stdout', recentOutput: result?.errors?.join('\n') || result?.output || '' } }); selection.removeAllRanges(); };
  const content = tab === 'terminal'
    ? <div className="project-terminal"><pre>{running ? 'Running project…' : result?.output || `Runtime: ${runtime.runtime}\nCommand: ${runtime.runCommand}`}</pre><form onSubmit={submitCommand}><label><span className="sr-only">Project terminal command</span><b aria-hidden="true">$</b><input aria-label="Project terminal command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder={runtime.runCommand} /></label><button type="submit" disabled={running || command.trim() !== runtime.runCommand}>Execute</button></form>{checkpoint.executionMode === 'terminal_only' ? <small>Use the terminal for this checkpoint.</small> : null}</div>
    : tab === 'output' ? <pre>{result?.errors?.join('\n') || result?.output || (result ? `Validation score: ${result.score}%` : 'Run your project to see output.')}</pre>
      : tab === 'problems' ? <div>{result?.errors?.length ? result.errors.map((error) => <p key={error}>{error}</p>) : 'No problems reported.'}</div>
        : <div>{!result ? 'No test results yet.' : <><strong>{result.passed ? 'All required tests passed.' : 'Some tests need attention.'}</strong>{result.tests?.length ? <ul>{result.tests.map((test) => <li key={test.name}>{test.passed ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}<span className="sr-only">{test.passed ? 'Passed:' : 'Needs attention:'}</span> {test.name}{test.message && !test.passed ? <small> — {test.message}</small> : null}</li>)}</ul> : null}</>}</div>;
  return <section className={`project-bottom-panel${open ? '' : ' is-collapsed'}`} aria-label="Project results"><header><div className="project-result-tabs" role="tablist" aria-label="Project result views">{['terminal', 'output', 'problems', 'tests'].map((item) => <button className={tab === item ? 'is-active' : ''} type="button" role="tab" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onKeyDown={handleTabListKeyDown} onClick={() => { setTab(item); if (!open) setOpen(true); }} key={item}>{item}</button>)}</div><span /><button type="button" aria-label={open ? 'Collapse bottom panel' : 'Restore bottom panel'} onClick={() => setOpen(!open)}>{open ? <ChevronDown /> : <ChevronUp />}</button></header>{open ? <div role="tabpanel" onMouseUp={selectOutput}>{content}</div> : null}</section>;
}
