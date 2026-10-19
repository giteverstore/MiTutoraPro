import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { projectCatalog } from '../repositories/ProjectCatalog';
import { ProjectFoundationCard as ProjectCard } from '../components/ProjectFoundationCard';
import { ProjectFoundationDetails as ProjectDetails } from './ProjectFoundationDetails';
import { lazyNamedExport } from '../../routing/lazyRoute';
import { projectProgressService } from '../services/ProjectProgressService';
import { useOptionalSubscriptionAccess } from '../../access/SubscriptionAccessContext';
import { ProjectStartDialog } from '../components/ProjectStartDialog';
import { getProjectRuntime } from '../runtime/projectRuntimeRegistry';
import { useOptionalAuth } from '../../auth/AuthContext';
import { ActiveProjectRepository } from '../repositories/ActiveProjectRepository';
import { PublishedContentRepository } from '../repositories/PublishedContentRepository';
import { ErrorState } from '../../errors/ErrorState';
import { projectDisplayDifficulty } from '../presentation/projectPresentation';
import { learnerProjectCatalog } from '../presentation/learnerProjectCatalog';
import { phase5Mark } from '../../performance/phase5Mark.js';

export const DEFAULT_PROJECT_FILTERS = Object.freeze({ language: 'all', category: 'all', difficulty: 'all' });

export function filterProjects(projects, filters) {
  return projects.filter((project) =>
    (filters.language === 'all' || project.supportedLanguages.includes(filters.language))
    && (filters.category === 'all' || project.category === filters.category)
    && (filters.difficulty === 'all' || projectDisplayDifficulty(project.difficulty) === projectDisplayDifficulty(filters.difficulty)));
}

export function projectResultsHeading(difficulty) {
  return difficulty === 'all' ? 'Projects' : `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} Projects`;
}

const anonymousProgress = Object.freeze({ status: 'not-started', completedPages: [] });
const ProjectWorkspace = lazyNamedExport(() => import('./ProjectWorkspace'), 'ProjectWorkspace');

export function mergeProjectCatalog(legacyProjects, publishedProjects) {
  const publishedIds = new Set(publishedProjects.map(({ id }) => id));
  return [...legacyProjects.filter(({ id }) => !publishedIds.has(id)), ...publishedProjects];
}

export async function resolveProjectForRoute(projectId, progress, publicationRepository, legacyCatalog = projectCatalog) {
  if (progress?.contentVersion != null) {
    return (await publicationRepository.resumeProject(projectId, progress.contentVersion)).project;
  }
  const published = await publicationRepository.resolveProject(projectId);
  return published?.project ?? legacyCatalog.getProjectById(projectId);
}

export function ProjectsPage({ browseOnly = false, onRequireAuth = () => {}, initialProjectId = null, onProjectChange = () => {}, publishedRepository = null }) {
  useEffect(() => { phase5Mark('projects:route-mounted'); }, []);
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const authLoading = auth?.loading ?? false;
  const access = useOptionalSubscriptionAccess();
  const tier = access?.tier ?? 'FREE';
  const [catalog, setCatalog] = useState({ status: 'loading', projects: [] });
  const publishedProjects = catalog.projects;
  const publicationRepository = useMemo(() => {
    if (publishedRepository) return publishedRepository;
    const e2eFetcher = import.meta.env.MODE === 'e2e' ? globalThis.__YCODERS_PROJECT_E2E_PUBLISHED_FETCH__ : null;
    return new PublishedContentRepository(e2eFetcher ? { fetcher: e2eFetcher } : undefined);
  }, [publishedRepository]);
  const projects = useMemo(() => learnerProjectCatalog(projectCatalog.getProjects(), publishedProjects), [publishedProjects]);
  const progressProjects = useMemo(() => projects.filter(({ comingSoon }) => !comingSoon), [projects]);
  const [filters, setFilters] = useState(DEFAULT_PROJECT_FILTERS);
  const [selected, setSelected] = useState(null);
  const [screen, setScreen] = useState(() => initialProjectId ? 'details' : 'catalog');
  const [routeState, setRouteState] = useState(() => initialProjectId ? 'loading' : 'idle');
  const [, refresh] = useState(0);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(browseOnly || !auth);
  const [contentError, setContentError] = useState('');
  const visible = useMemo(() => filterProjects(projects, filters), [filters, projects]);
  const languages = useMemo(() => [...new Set(projects.flatMap(({ supportedLanguages }) => supportedLanguages))], [projects]);
  const categories = useMemo(() => [...new Set(projects.map(({ category }) => category).filter(Boolean))], [projects]);

  useEffect(() => {
    let active = true;
    phase5Mark('projects:catalog:start');
    publicationRepository.listProjects().then(
      (items) => { phase5Mark('projects:catalog:end', { count: items.length }); if (active) setCatalog({ status: 'ready', projects: items }); },
      () => {
        phase5Mark('projects:catalog:error');
        if (active) {
          setCatalog({ status: 'error', projects: [] });
          setContentError('Published projects could not be loaded. Coming Soon projects remain visible.');
        }
      },
    );
    return () => { active = false; };
  }, [publicationRepository]);

  useEffect(() => {
    if (screen !== 'details' || !selected || selected.contentVersion != null) return;
    const published = publishedProjects.find(({ id }) => id === selected.id);
    if (published) setSelected(published);
  }, [publishedProjects, screen, selected]);

  useEffect(() => {
    if (browseOnly || !auth || authLoading || catalog.status === 'loading') return undefined;
    let active = true;
    setCloudReady(false);
    projectProgressService.connect(user?.uid ?? null, (uid) => new ActiveProjectRepository(uid));
    phase5Mark('projects:hydration:start', { count: progressProjects.length });
    Promise.all(progressProjects.map(async ({ id }) => {
      phase5Mark('projects:progress:start', { projectId: id });
      const progress = await projectProgressService.hydrate(id);
      phase5Mark('projects:progress:end', { projectId: id });
      return progress;
    })).finally(() => {
      phase5Mark('projects:hydration:end', { count: progressProjects.length });
      if (active) { setCloudReady(true); refresh((value) => value + 1); }
    });
    return () => { active = false; };
  }, [authLoading, browseOnly, catalog.status, progressProjects, user?.uid]);

  const progressFor = (projectId) => browseOnly ? anonymousProgress : projectProgressService.get(projectId);
  useLayoutEffect(() => {
    phase5Mark(catalog.status === 'loading' ? 'projects:skeleton:shown' : 'projects:skeleton:removed');
  }, [catalog.status]);
  useLayoutEffect(() => {
    if (!browseOnly) phase5Mark(cloudReady ? 'projects:progress-pending:removed' : 'projects:progress-pending:shown');
  }, [browseOnly, cloudReady]);
  useLayoutEffect(() => {
    if (catalog.status !== 'loading' && !initialProjectId && visible.length) {
      phase5Mark('projects:first-card-committed', { count: visible.length, progressReady: cloudReady });
    }
  }, [catalog.status, cloudReady, initialProjectId, visible.length]);
  useEffect(() => {
    if (!initialProjectId) return undefined;
    if (!browseOnly && !cloudReady) return undefined;
    let active = true;
    setRouteState('loading');
    setContentError('');
    const loadProgress = !browseOnly && user?.uid
      ? projectProgressService.hydrate(initialProjectId)
      : Promise.resolve(progressFor(initialProjectId));
    loadProgress.then((progress) => resolveProjectForRoute(initialProjectId, progress, publicationRepository))
      .then((project) => {
        if (!active) return;
        setSelected(project);
        setScreen('details');
        setRouteState(project ? 'ready' : 'missing');
      })
      .catch(() => {
        if (!active) return;
        setSelected(null);
        setRouteState('error');
      });
    return () => { active = false; };
  }, [browseOnly, cloudReady, initialProjectId, publicationRepository, user?.uid]);

  const openProject = async (candidate) => {
    setContentError('');
    const progress = progressFor(candidate.id);
    let resolved = candidate;
    if (progress.contentVersion != null && progress.contentVersion !== candidate.contentVersion) {
      try { resolved = (await publicationRepository.resumeProject(candidate.id, progress.contentVersion)).project; }
      catch {
        setContentError('This project version is temporarily unavailable. Your saved progress is safe; please try again later.');
        return;
      }
    }
    setSelected(resolved); setScreen('details'); onProjectChange(resolved.id);
  };

  if (!browseOnly && !cloudReady && initialProjectId) return <div className="projects-page"><p className="project-cloud-loading" role="status">Loading your projects…</p></div>;

  if (initialProjectId && routeState === 'loading') return <div className="projects-page"><p className="project-cloud-loading" role="status">Loading project...</p></div>;
  if (initialProjectId && (routeState === 'missing' || routeState === 'error')) return <div className="projects-page"><ErrorState
    title={routeState === 'missing' ? 'Project not found.' : 'This project could not be loaded.'}
    description={routeState === 'missing' ? 'This project does not exist or is no longer available.' : 'Please try again later. Your saved work is unaffected.'}
    kind={routeState === 'missing' ? 'not-found' : 'failure'}
    alert={routeState === 'error'}
    primaryAction={{ label: 'Back to Projects', onClick: () => { setRouteState('idle'); setScreen('catalog'); onProjectChange(null); } }}
  /></div>;

  if (selected && screen === 'details') { const progress = progressFor(selected.id); return <><ProjectDetails project={selected} progress={progress} onStart={() => {
    if (browseOnly) { onRequireAuth('/projects'); return; }
    if (progress.languageId) { setScreen('workspace'); return; }
    setStartDialogOpen(true);
  }} /><ProjectStartDialog open={startDialogOpen} project={selected} onClose={() => setStartDialogOpen(false)} onConfirm={(languageId, displayName) => { projectProgressService.resetForLanguage(selected.id, languageId, displayName, selected.contentVersion ?? null); setStartDialogOpen(false); setScreen('workspace'); }} /></>; }
  if (selected && screen === 'workspace') {
    return <Suspense fallback={<div className="projects-page"><p className="project-cloud-loading" role="status">Loading project workspace…</p></div>}>
      <ProjectWorkspace project={selected} tier={tier} onProgress={() => refresh((value) => value + 1)} />
    </Suspense>;
  }

  return <div className="projects-page">
    <section className="project-filters" aria-label="Project filters">
      <label>Language<select value={filters.language} onChange={(event) => setFilters((current) => ({ ...current, language: event.target.value }))}><option value="all">All languages</option>{languages.map((language) => <option key={language} value={language}>{getProjectRuntime(language).displayName}</option>)}</select></label>
      <label>Category<select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label>Difficulty<select value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}><option value="all">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
    </section>
    <section className="project-catalog" aria-labelledby="project-catalog-title" aria-busy={catalog.status === 'loading'}>
      <div><h2 id="project-catalog-title">{projectResultsHeading(filters.difficulty)}</h2><p>{catalog.status === 'loading' ? 'Loading projects…' : `${visible.length} ${visible.length === 1 ? 'project' : 'projects'}`}</p></div>
      {contentError ? <ErrorState title="Some projects could not be loaded." description={contentError} variant="compact" alert /> : null}
      {catalog.status === 'loading' ? <div className="project-grid project-grid-loading" role="status" aria-label="Loading projects">{Array.from({ length: 6 }, (_, index) => <div className="project-card project-card-skeleton" aria-hidden="true" key={index}><span /><div><span /><span /><span /></div></div>)}</div> : visible.length ? <div className="project-grid">{visible.map((project) => <ProjectCard key={project.id} project={project} progress={project.comingSoon ? null : cloudReady ? progressFor(project.id) : null} progressPending={!project.comingSoon && !browseOnly && !cloudReady} onOpen={(next) => void openProject(next)} />)}</div> : <p className="project-empty">No projects match these filters yet.</p>}
    </section>
  </div>;
}
