import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Crown, Download, Play } from 'lucide-react';
import { EditorPlaceholder } from '../../components/EditorPlaceholder';
import { useCompilerManager } from '../../compiler/CompilerProvider';
import { canAccessProjectPage } from '../../access/accessPolicy';
import { openPremiumPlans } from '../../access/PremiumGate';
import { ProjectValidator } from '../validation/ProjectValidator';
import { ProjectTestResults } from '../components/ProjectTestResults';
import { projectExporter } from '../export/ProjectExporter';
import { projectProgressService } from '../services/ProjectProgressService';

export const PROJECT_WORKSPACE_PAGES = Object.freeze([
  { id: 'requirements', label: 'Requirements' },
  { id: 'contract', label: 'Function contract' },
  { id: 'example', label: 'Example' },
  { id: 'implementation', label: 'Implementation' },
]);

function ProjectPremiumBoundary() {
  return <section className="project-premium-boundary" role="region" aria-labelledby="project-premium-boundary-title"><Crown aria-hidden="true" /><h2 id="project-premium-boundary-title">Continue this project with Premium</h2><p>You’ve reached the end of the free project preview. Upgrade to continue building the full project.</p><button className="button button--primary" type="button" onClick={openPremiumPlans}>View Premium Plans</button></section>;
}

function ProjectImplementation({ project, onProgress }) {
  const manager = useCompilerManager();
  const validator = useMemo(() => new ProjectValidator(manager), [manager]);
  const progress = projectProgressService.get(project.id);
  const [code, setCode] = useState(progress.submission ?? project.starterCode);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const controller = useRef(null);
  const completed = progress.status === 'completed' || result?.passed;
  const validate = async () => { controller.current?.abort(); controller.current = new AbortController(); setRunning(true); setResult(null); try { const next = await validator.validateProject(project, code, { signal: controller.current.signal }); setResult(next); onProgress?.(projectProgressService.recordValidation(project.id, next, code)); } catch (error) { if (error.name !== 'AbortError') setResult({ passed: false, tests: [], score: 0, errors: [error.message] }); } finally { setRunning(false); } };
  return <><section className="project-editor-card" aria-label="Your implementation"><header><div><span>Your Implementation</span><strong>{project.template.sourcePath}</strong></div><button className="button button--secondary" type="button" onClick={() => { setCode(project.starterCode); setResult(null); }}>Reset</button></header><EditorPlaceholder editor={{ ariaLabel: `${project.title} implementation editor` }} value={code} onChange={(value) => { setCode(value); setResult(null); }} /><footer><button className="button button--primary" type="button" disabled={running} onClick={validate}><Play /> {running ? 'Validating…' : 'Validate Project'}</button></footer></section><ProjectTestResults result={result} />{completed ? <section className="project-complete" role="status"><CheckCircle2 /><div><span>Project Complete</span><h2>Your implementation passed all required tests.</h2><p>Export a clean repository containing your implementation, README, setup files, and public tests.</p></div><button className="button button--primary" type="button" onClick={() => projectExporter.download(project, code)}><Download /> Export Project</button></section> : null}</>;
}

export function ProjectWorkspace({ project, tier = 'FREE', onBack, onProgress, initialPageIndex }) {
  const savedPage = projectProgressService.get(project.id).lastPageIndex ?? 0;
  const [pageIndex, setPageIndex] = useState(Math.min(PROJECT_WORKSPACE_PAGES.length - 1, Math.max(0, initialPageIndex ?? savedPage)));
  const allowed = canAccessProjectPage({ tier, pageIndex });
  const visit = (nextIndex) => { setPageIndex(nextIndex); projectProgressService.visitPage(project.id, nextIndex); onProgress?.(); };
  const page = PROJECT_WORKSPACE_PAGES[pageIndex];
  return <div className="project-workspace-page"><header><button className="practice-back-button" type="button" onClick={onBack}><ArrowLeft /> Project details</button><div><span>Build · {project.language}</span><h1>{project.title}</h1><p>{project.instructions}</p></div></header><nav className="project-step-navigation" aria-label="Project pages">{PROJECT_WORKSPACE_PAGES.map((item, index) => <button type="button" aria-current={index === pageIndex ? 'step' : undefined} className={index === pageIndex ? 'is-active' : ''} onClick={() => visit(index)} key={item.id}><span>{index + 1}</span>{item.label}</button>)}</nav><section className="project-step-content" aria-labelledby="project-step-title"><h2 id="project-step-title">{page.label}</h2>{!allowed ? <ProjectPremiumBoundary /> : page.id === 'requirements' ? <ul>{project.requirements.map((item) => <li key={item}>{item}</li>)}</ul> : page.id === 'contract' ? <code>{project.functionDefinition.name}({project.functionDefinition.parameters.join(', ')}) → {project.functionDefinition.returns}</code> : page.id === 'example' ? <dl><div><dt>Input</dt><dd><code>{project.example.input}</code></dd></div><div><dt>Output</dt><dd><code>{project.example.output}</code></dd></div></dl> : <ProjectImplementation project={project} onProgress={onProgress} />}</section><footer className="project-step-actions"><button className="button button--secondary" type="button" disabled={pageIndex === 0} onClick={() => visit(pageIndex - 1)}><ArrowLeft /> Previous</button>{pageIndex < PROJECT_WORKSPACE_PAGES.length - 1 ? <button className="button button--primary" type="button" onClick={() => visit(pageIndex + 1)}>Next <ArrowRight /></button> : null}</footer></div>;
}
