import { useEffect, useMemo, useState } from 'react';
import { projectCatalog } from '../repositories/ProjectCatalog';
import { ProjectFoundationCard as ProjectCard } from '../components/ProjectFoundationCard';
import { ProjectFoundationDetails as ProjectDetails } from './ProjectFoundationDetails';
import { ProjectWorkspace } from './ProjectWorkspace';
import { projectProgressService } from '../services/ProjectProgressService';
import { useOptionalSubscriptionAccess } from '../../access/SubscriptionAccessContext';
import { ProjectStartDialog } from '../components/ProjectStartDialog';
import { getProjectRuntime } from '../runtime/projectRuntimeRegistry';
import { useOptionalAuth } from '../../auth/AuthContext';
import { ActiveProjectRepository } from '../repositories/ActiveProjectRepository';

export const DEFAULT_PROJECT_FILTERS = Object.freeze({ language: 'all', category: 'all', difficulty: 'all' });

export function filterProjects(projects, filters) {
  return projects.filter((project) =>
    (filters.language === 'all' || project.supportedLanguages.includes(filters.language))
    && (filters.category === 'all' || project.category === filters.category)
    && (filters.difficulty === 'all' || project.difficulty.toLowerCase() === filters.difficulty));
}

export function projectResultsHeading(difficulty) {
  return difficulty === 'all' ? 'Projects' : `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} Projects`;
}

const anonymousProgress = Object.freeze({ status: 'not-started', completedPages: [] });

export function ProjectsPage({ browseOnly = false, onRequireAuth = () => {}, initialProjectId = null, onProjectChange = () => {} }) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const authLoading = auth?.loading ?? false;
  const access = useOptionalSubscriptionAccess();
  const tier = access?.tier ?? 'FREE';
  const projects = projectCatalog.getProjects();
  const [filters, setFilters] = useState(DEFAULT_PROJECT_FILTERS);
  const [selected, setSelected] = useState(() => initialProjectId ? projectCatalog.getProjectById(initialProjectId) : null);
  const [screen, setScreen] = useState(() => initialProjectId ? 'details' : 'catalog');
  const [, refresh] = useState(0);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(browseOnly || !auth);
  const visible = useMemo(() => filterProjects(projects, filters), [filters, projects]);
  const languages = useMemo(() => [...new Set(projects.flatMap(({ supportedLanguages }) => supportedLanguages))], [projects]);
  const categories = useMemo(() => [...new Set(projects.map(({ category }) => category))], [projects]);

  useEffect(() => {
    if (browseOnly || !auth || authLoading) return undefined;
    let active = true;
    setCloudReady(false);
    projectProgressService.connect(user?.uid ?? null, (uid) => new ActiveProjectRepository(uid));
    Promise.all(projects.map(({ id }) => projectProgressService.hydrate(id))).finally(() => { if (active) { setCloudReady(true); refresh((value) => value + 1); } });
    return () => { active = false; };
  }, [authLoading, browseOnly, projects, user?.uid]);

  const progressFor = (projectId) => browseOnly ? anonymousProgress : projectProgressService.get(projectId);

  if (!browseOnly && !cloudReady) return <div className="projects-page"><p className="project-cloud-loading" role="status">Loading your projects…</p></div>;

  if (selected && screen === 'details') { const progress = progressFor(selected.id); return <><ProjectDetails project={selected} progress={progress} onBack={() => { setSelected(null); setScreen('catalog'); onProjectChange(null); }} onStart={() => {
    if (browseOnly) { onRequireAuth('/projects'); return; }
    if (progress.languageId) { setScreen('workspace'); return; }
    setStartDialogOpen(true);
  }} /><ProjectStartDialog open={startDialogOpen} project={selected} onClose={() => setStartDialogOpen(false)} onConfirm={(languageId) => { projectProgressService.resetForLanguage(selected.id, languageId); setStartDialogOpen(false); setScreen('workspace'); }} /></>; }
  if (selected && screen === 'workspace') {
    return <ProjectWorkspace project={selected} tier={tier} onBack={() => { setSelected(null); setScreen('catalog'); onProjectChange(null); }} onProgress={() => refresh((value) => value + 1)} />;
  }

  return <div className="projects-page">
    <section className="project-filters" aria-label="Project filters">
      <label>Language<select value={filters.language} onChange={(event) => setFilters((current) => ({ ...current, language: event.target.value }))}><option value="all">All languages</option>{languages.map((language) => <option key={language} value={language}>{getProjectRuntime(language).displayName}</option>)}</select></label>
      <label>Category<select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label>Difficulty<select value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}><option value="all">All difficulties</option><option value="beginner">Beginner</option><option value="easy">Easy</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
    </section>
    <section className="project-catalog" aria-labelledby="project-catalog-title">
      <div><h2 id="project-catalog-title">{projectResultsHeading(filters.difficulty)}</h2><p>{visible.length} {visible.length === 1 ? 'project' : 'projects'} available</p></div>
      {visible.length ? <div className="project-grid">{visible.map((project) => <ProjectCard key={project.id} project={project} progress={progressFor(project.id)} onOpen={(next) => { setSelected(next); setScreen('details'); onProjectChange(next.id); }} />)}</div> : <p className="project-empty">No projects match these filters yet.</p>}
    </section>
  </div>;
}
