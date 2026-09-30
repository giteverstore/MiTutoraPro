import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, Bot, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Crown, Download, FileCode2, FileJson, FileText, Folder, FolderOpen, FolderPlus, ListChecks, Pencil, Plus, RotateCcw, Settings, Trash2, X } from 'lucide-react';
import { EditorPlaceholder } from '../../components/EditorPlaceholder';
import { useCompilerManager } from '../../compiler/CompilerProvider';
import { canAccessProjectPage } from '../../access/accessPolicy';
import { openPremiumPlans } from '../../access/PremiumGate';
import { AITutorWorkspace } from '../../ai/AITutorWorkspace';
import { supportedCompilerLanguages } from '../../compiler/languages/supportedLanguages';
import { ProjectValidator } from '../validation/ProjectValidator';
import { projectExporter } from '../export/ProjectExporter';
import { projectProgressService } from '../services/ProjectProgressService';
import { buildProjectTree, createInitialProjectFiles, languageForPath, validateProjectFilePath, validateProjectFolderPath } from '../workspace/projectWorkspaceFiles';
import { ProjectLanguagePicker } from '../workspace/ProjectLanguagePicker';
import { useProjectWorkspacePreferences } from '../workspace/useProjectWorkspacePreferences';

export const PROJECT_WORKSPACE_PAGES = Object.freeze([
  { id: 'requirements', label: 'Requirements' }, { id: 'contract', label: 'Function contract' },
  { id: 'example', label: 'Example' }, { id: 'implementation', label: 'Implementation' },
]);
const PANEL_HEIGHT_KEY = 'ycoders.projectWorkspace.bottomPanelHeight';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const initialPanelHeight = () => { try { return clamp(Number(localStorage.getItem(PANEL_HEIGHT_KEY)) || 190, 120, 360); } catch { return 190; } };

function ProjectPremiumBoundary() {
  return <section className="project-premium-boundary" role="region" aria-labelledby="project-premium-boundary-title"><Crown /><h2 id="project-premium-boundary-title">Continue this project with Premium</h2><p>You’ve reached the end of the free project preview. Upgrade to continue building the full project.</p><button className="button button--primary" type="button" onClick={openPremiumPlans}>View Premium Plans</button></section>;
}

function GuideContent({ project, page, allowed }) {
  if (!allowed) return <ProjectPremiumBoundary />;
  if (page.id === 'requirements') return <ul>{project.requirements.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (page.id === 'contract') return <div className="project-guide-contract"><code>{project.functionDefinition.name}({project.functionDefinition.parameters.join(', ')}) → {project.functionDefinition.returns}</code></div>;
  if (page.id === 'example') return <dl><div><dt>Input</dt><dd><code>{project.example.input}</code></dd></div><div><dt>Output</dt><dd><code>{project.example.output}</code></dd></div></dl>;
  return <div className="project-guide-implementation"><p>{project.instructions}</p><h3>Success requirements</h3><ul>{project.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

const fileName = (path) => path.split('/').at(-1);

export function ProjectWorkspace({ project, tier = 'FREE', onBack, onProgress, initialPageIndex }) {
  const manager = useCompilerManager();
  const workspacePreferences = useProjectWorkspacePreferences();
  const validator = useMemo(() => new ProjectValidator(manager), [manager]);
  const savedProgress = projectProgressService.get(project.id);
  const initialWorkspace = useMemo(() => createInitialProjectFiles(project, savedProgress), [project.id]);
  const [files, setFiles] = useState(initialWorkspace.files);
  const [folders, setFolders] = useState(initialWorkspace.folders);
  const [entryFilePath, setEntryFilePath] = useState(initialWorkspace.entryFilePath);
  const [openTabs, setOpenTabs] = useState([initialWorkspace.entryFilePath]);
  const [activeFilePath, setActiveFilePath] = useState(initialWorkspace.entryFilePath);
  const [dirtyFiles, setDirtyFiles] = useState(new Set());
  const [fileError, setFileError] = useState('');
  const [pageIndex, setPageIndex] = useState(clamp(initialPageIndex ?? savedProgress.lastPageIndex ?? 0, 0, 3));
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [bottomTab, setBottomTab] = useState('output');
  const [leftMode, setLeftMode] = useState('files');
  const [rightMode, setRightMode] = useState('guide');
  const [compilerLanguageId, setCompilerLanguageId] = useState(project.language);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(280);
  const [aiWidth, setAiWidth] = useState(360);
  const [bottomHeight, setBottomHeight] = useState(initialPanelHeight);
  const controller = useRef(null);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const allowed = canAccessProjectPage({ tier, pageIndex });
  const page = PROJECT_WORKSPACE_PAGES[pageIndex];
  const activeFile = activeFilePath ? files[activeFilePath] : null;
  const entryFile = files[entryFilePath];
  const status = running ? 'Running' : result?.passed ? 'Success' : result ? 'Error' : 'Ready';
  const compilerLanguage = supportedCompilerLanguages.find(({ id }) => id === compilerLanguageId)
    ?? supportedCompilerLanguages.find(({ id }) => id === project.language);
  const languageLabel = compilerLanguage?.label ?? compilerLanguageId;
  const persist = (nextFiles, nextEntry = entryFilePath, nextFolders = folders) => projectProgressService.saveWorkspace(project.id, nextFiles, nextEntry, nextFolders);
  const visit = (index) => { const safe = clamp(index, 0, 3); setPageIndex(safe); projectProgressService.visitPage(project.id, safe); onProgress?.(); };
  const openFile = (path) => { setOpenTabs((tabs) => tabs.includes(path) ? tabs : [...tabs, path]); setActiveFilePath(path); };
  const closeTab = (path) => setOpenTabs((tabs) => { const index = tabs.indexOf(path); const next = tabs.filter((tab) => tab !== path); if (activeFilePath === path) setActiveFilePath(next[Math.min(index, next.length - 1)] ?? null); return next; });
  const updateActiveFile = (content) => { if (!activeFilePath) return; const next = { ...files, [activeFilePath]: { ...activeFile, content } }; setFiles(next); setDirtyFiles((dirty) => new Set(dirty).add(activeFilePath)); setResult(null); persist(next); };
  const createFile = (requested) => { const checked = validateProjectFilePath(requested, files, project.language); if (!checked.valid) { setFileError(checked.error); return false; } const next = { ...files, [checked.path]: { path: checked.path, content: '', language: languageForPath(checked.path, project.language), editable: true } }; setFiles(next); setFileError(''); persist(next); setOpenTabs((tabs) => [...tabs, checked.path]); setActiveFilePath(checked.path); return true; };
  const createFolder = (requested) => { const checked = validateProjectFolderPath(requested, files, folders); if (!checked.valid) { setFileError(checked.error); return false; } const next = [...folders, checked.path]; setFolders(next); setFileError(''); persist(files, entryFilePath, next); return true; };
  const renameFile = (path, requested) => { if (requested === path) return true; const checked = validateProjectFilePath(requested, files, project.language); if (!checked.valid) { setFileError(checked.error); return false; } const next = { ...files, [checked.path]: { ...files[path], path: checked.path, language: languageForPath(checked.path, project.language) } }; delete next[path]; const nextEntry = entryFilePath === path ? checked.path : entryFilePath; setFiles(next); setEntryFilePath(nextEntry); setOpenTabs((tabs) => tabs.map((tab) => tab === path ? checked.path : tab)); setActiveFilePath((active) => active === path ? checked.path : active); setDirtyFiles((dirty) => new Set([...dirty].map((item) => item === path ? checked.path : item))); setFileError(''); persist(next, nextEntry); return true; };
  const deleteFile = (path) => { if (path === entryFilePath) { setFileError('The project entry file cannot be deleted.'); return; } if (files[path].content && !window.confirm(`Delete ${path}?`)) return; const next = { ...files }; delete next[path]; setFiles(next); setDirtyFiles((dirty) => { const changed = new Set(dirty); changed.delete(path); return changed; }); closeTab(path); setFileError(''); persist(next); };
  const validate = async () => {
    if (!canAccessProjectPage({ tier, pageIndex: 3 })) { visit(3); return; }
    controller.current?.abort(); controller.current = new AbortController(); setRunning(true); setResult(null); setBottomOpen(true); setBottomTab('tests');
    try { const next = await validator.validateProject({ ...project, template: { ...project.template, sourcePath: entryFilePath } }, entryFile.content, { signal: controller.current.signal }); setResult(next); if (next.passed) setDirtyFiles(new Set()); onProgress?.(projectProgressService.recordValidation(project.id, next, entryFile.content)); persist(files); }
    catch (error) { if (error.name !== 'AbortError') setResult({ passed: false, tests: [], score: 0, errors: [error.message] }); }
    finally { setRunning(false); }
  };
  const resizeSide = (side, event) => { event.preventDefault(); const start = event.clientX; const width = side === 'left' ? leftWidth : aiWidth; const move = (next) => side === 'left' ? setLeftWidth(clamp(width + next.clientX - start, 220, 380)) : setAiWidth(clamp(width + start - next.clientX, 300, 440)); const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true }); };
  const resizeBottom = (event) => { event.preventDefault(); const start = event.clientY; const height = bottomHeight; let resized = height; const move = (next) => { resized = clamp(height + start - next.clientY, 120, 360); setBottomHeight(resized); }; const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); try { localStorage.setItem(PANEL_HEIGHT_KEY, String(resized)); } catch { /* best effort */ } }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true }); };
  const aiContext = [`Project: ${project.title}`, `Stage: ${page.label}`, `Requirements: ${project.requirements.join('; ')}`, `Active file: ${activeFilePath ?? 'none'}`, `Entry file: ${entryFilePath}`, 'Runtime multi-file execution: entry file only'];
  useEffect(() => setCursorPosition({ lineNumber: 1, column: 1 }), [activeFilePath]);

  return <div className={`project-ide-shell${leftMode ? '' : ' is-explorer-collapsed'}${bottomOpen ? '' : ' is-bottom-collapsed'}`} data-project-theme={workspacePreferences.resolvedTheme}>
    <header className="project-ide-topbar"><button type="button" onClick={onBack}><ArrowLeft /> Projects</button><strong>{project.title}</strong></header>
    <div className="project-ide-main" style={{ '--project-explorer-width': `${leftWidth}px`, '--project-guide-width': `${aiWidth}px`, '--project-bottom-height': `${bottomHeight}px` }}>
      <nav className="project-activity-bar" aria-label="Project workspace tools"><button className={leftMode === 'files' ? 'is-active' : ''} type="button" aria-label="Files" onClick={() => setLeftMode((mode) => mode === 'files' ? null : 'files')}><FolderOpen /></button><button className={`project-settings-activity${leftMode === 'settings' ? ' is-active' : ''}`} type="button" aria-label="Settings" onClick={() => setLeftMode((mode) => mode === 'settings' ? null : 'settings')}><Settings /></button></nav>
      {leftMode ? <aside className="project-explorer-panel" aria-label={leftMode === 'settings' ? 'Settings' : 'Explorer'}>{leftMode === 'settings' ? <SettingsPanel preferences={workspacePreferences} /> : <FilesPanel project={project} files={files} folders={folders} activeFilePath={activeFilePath} entryFilePath={entryFilePath} fileError={fileError} onCreateFile={createFile} onCreateFolder={createFolder} onOpen={openFile} onRename={renameFile} onDelete={deleteFile} />}</aside> : null}
      {leftMode ? <div className="project-vertical-resizer is-left" role="separator" aria-label="Resize left panel" aria-orientation="vertical" onPointerDown={(event) => resizeSide('left', event)} /> : null}
      <main className="project-editor-pane"><EditorTabs openTabs={openTabs} activeFilePath={activeFilePath} dirtyFiles={dirtyFiles} onActivate={setActiveFilePath} onClose={closeTab} />{!allowed && page.id === 'implementation' ? <div className="project-editor-locked" aria-label="Project editor locked"><Crown /><p>Upgrade to Premium to edit and validate the implementation.</p></div> : activeFile ? <EditorPlaceholder editor={{ ariaLabel: activeFilePath === entryFilePath ? `${project.title} implementation editor` : `${project.title} ${activeFilePath} editor`, fileName: activeFilePath, language: activeFile.language, modelPath: `ycoders-project://${project.id}/${activeFilePath}` }} value={activeFile.content} onChange={updateActiveFile} onCursorPositionChange={setCursorPosition} instanceId={`project-${project.id}-${activeFilePath}`} workspacePreferences={workspacePreferences.editorPreferences} loadingTheme={workspacePreferences.resolvedTheme} /> : <div className="project-editor-empty"><FileCode2 /><p>Open a file from Explorer to start editing.</p></div>}</main>
      <div className="project-vertical-resizer is-right" role="separator" aria-label="Resize Guide and AI" aria-orientation="vertical" onPointerDown={(event) => resizeSide('right', event)} />
      <aside className="project-ai-panel" aria-label="Guide and AI"><header><div className="project-right-tabs" role="tablist" aria-label="Project assistance"><button className={rightMode === 'guide' ? 'is-active' : ''} type="button" role="tab" aria-selected={rightMode === 'guide'} onClick={() => setRightMode('guide')}><ListChecks /> Guide</button><button className={rightMode === 'ai' ? 'is-active' : ''} type="button" role="tab" aria-selected={rightMode === 'ai'} onClick={() => setRightMode('ai')}><Bot /> AI</button></div></header><div className={`project-right-mode project-guide-mode${rightMode === 'guide' ? ' is-active' : ''}`}><GuidePanel project={project} page={page} pageIndex={pageIndex} allowed={allowed} onVisit={visit} /></div><div className={`project-right-mode project-ai-mode${rightMode === 'ai' ? ' is-active' : ''}`}><AITutorWorkspace course={{ id: `project-${project.id}`, title: project.title }} lesson={{ id: page.id, title: page.label }} compilerContext={{ language: project.language, code: activeFile?.content ?? entryFile?.content ?? '', compilerEvidence: result?.errors?.join('\n') ?? '', compilerStatus: status.toLowerCase() }} accessTier={tier} activityType="unknown" contextLines={aiContext} emptyTitle="Ask about this project" emptyText="Ask me about this project, your code, errors, or the next step." composerPlaceholder="Ask about this project…" assistantLabel="AI Guide" /></div></aside>
      {bottomOpen ? <div className="project-horizontal-resizer" role="separator" aria-label="Resize bottom panel" aria-orientation="horizontal" onPointerDown={resizeBottom} /> : null}
      <BottomPanel open={bottomOpen} tab={bottomTab} setTab={setBottomTab} setOpen={setBottomOpen} running={running} result={result} />
    </div>
    <footer className="project-ide-statusbar"><div className="project-status-left"><span>{status}</span></div><div className="project-status-right"><button className="project-status-language" type="button" aria-haspopup="dialog" aria-expanded={languagePickerOpen} onClick={() => setLanguagePickerOpen(true)}>{languageLabel}<ChevronDown /></button><span>Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span><span>Spaces: {workspacePreferences.preferences.tabSize}</span><span>UTF-8</span><span>LF</span>{result?.passed ? <button type="button" onClick={() => projectExporter.download(project, entryFile.content)}><Download /> Export</button> : null}<button type="button" aria-label="Notifications"><Bell /></button></div></footer>
    <ProjectLanguagePicker open={languagePickerOpen} activeLanguageId={compilerLanguageId} theme={workspacePreferences.resolvedTheme} onClose={() => setLanguagePickerOpen(false)} onSelect={setCompilerLanguageId} />
  </div>;
}

function FileIcon({ path }) {
  if (path.endsWith('.json')) return <FileJson />;
  if (path.endsWith('.md')) return <FileText />;
  if (path.endsWith('.txt')) return <FileText />;
  return <FileCode2 />;
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

function GuidePanel({ project, page, pageIndex, allowed, onVisit }) {
  return <><header><span>Project Guide</span></header><div className="project-guide-content"><h2>{page.label}</h2><GuideContent project={project} page={page} allowed={allowed} /></div><footer className="project-guide-navigation"><button type="button" disabled={pageIndex === 0} onClick={() => onVisit(pageIndex - 1)}><ArrowLeft /> Previous</button><span>{pageIndex + 1} / 4</span><button type="button" disabled={pageIndex === 3} onClick={() => onVisit(pageIndex + 1)}>Next <ArrowRight /></button></footer></>;
}

function EditorTabs({ openTabs, activeFilePath, dirtyFiles, onActivate, onClose }) {
  return <div className="project-editor-tabs"><div className="project-open-tabs">{openTabs.map((path) => <div className={path === activeFilePath ? 'is-active' : ''} key={path}><button type="button" onClick={() => onActivate(path)}><FileCode2 /> {fileName(path)}{dirtyFiles.has(path) ? <span aria-label="Modified">●</span> : null}</button><button type="button" aria-label={`Close ${path}`} onClick={() => onClose(path)}><X /></button></div>)}</div></div>;
}

function BottomPanel({ open, tab, setTab, setOpen, running, result }) {
  return <section className={`project-bottom-panel${open ? '' : ' is-collapsed'}`} aria-label="Project results"><header role="tablist" aria-label="Project result views">{['terminal', 'output', 'problems', 'tests'].map((item) => <button className={tab === item ? 'is-active' : ''} type="button" role="tab" aria-selected={tab === item} onClick={() => { setTab(item); if (!open) setOpen(true); }} key={item}>{item}</button>)}<span /><button type="button" aria-label={open ? 'Collapse bottom panel' : 'Restore bottom panel'} onClick={() => setOpen(!open)}>{open ? <ChevronDown /> : <ChevronUp />}</button></header>{open ? <div role="tabpanel">{tab === 'terminal' ? <pre>{running ? 'Validating project…' : 'Project validation output appears here. This is not a shell.'}</pre> : tab === 'output' ? <pre>{result?.errors?.join('\n') || (result ? `Validation score: ${result.score}%` : 'Validate your project to see output.')}</pre> : tab === 'problems' ? <div>{result?.errors?.length ? result.errors.map((error) => <p key={error}>{error}</p>) : 'No problems reported.'}</div> : <div>{!result ? 'No test results yet.' : <><strong>{result.passed ? 'All required tests passed.' : 'Some tests need attention.'}</strong>{result.tests?.length ? <ul>{result.tests.map((test) => <li key={test.name}>{test.passed ? <CheckCircle2 /> : <Circle />} {test.name}</li>)}</ul> : null}</>}</div>}</div> : null}</section>;
}
