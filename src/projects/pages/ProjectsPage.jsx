import { useMemo, useState } from 'react';
import { projectCatalog } from '../repositories/ProjectCatalog';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectDetails } from './ProjectDetails';
import { ProjectWorkspace } from './ProjectWorkspace';
import { projectProgressService } from '../services/ProjectProgressService';

export const DEFAULT_PROJECT_FILTERS = Object.freeze({ language: 'all', category: 'all', difficulty: 'all' });

export function filterProjects(projects, filters) {
  return projects.filter((project) =>
    (filters.language === 'all' || project.language === filters.language)
    && (filters.category === 'all' || project.category === filters.category)
    && (filters.difficulty === 'all' || project.difficulty.toLowerCase() === filters.difficulty));
}

export function projectResultsHeading(difficulty) {
  return difficulty === 'all' ? 'Projects' : `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} Projects`;
}

export function ProjectsPage() {
  const projects = projectCatalog.getProjects();
  const [filters, setFilters] = useState(DEFAULT_PROJECT_FILTERS);
  const [selected, setSelected] = useState(null);
  const [screen, setScreen] = useState('catalog');
  const [, refresh] = useState(0);
  const visible = useMemo(() => filterProjects(projects, filters), [filters, projects]);
  const languages = useMemo(() => [...new Set(projects.map(({ language }) => language))], [projects]);
  const categories = useMemo(() => [...new Set(projects.map(({ category }) => category))], [projects]);

  if (selected && screen === 'details') return <ProjectDetails project={selected} progress={projectProgressService.get(selected.id)} onBack={() => { setSelected(null); setScreen('catalog'); }} onStart={() => { projectProgressService.start(selected.id); setScreen('workspace'); }} />;
  if (selected && screen === 'workspace') return <ProjectWorkspace project={selected} onBack={() => setScreen('details')} onProgress={() => refresh((value) => value + 1)} />;

  return <div className="projects-page">
    <section className="project-filters" aria-label="Project filters">
      <label>Language<select value={filters.language} onChange={(event) => setFilters((current) => ({ ...current, language: event.target.value }))}><option value="all">All languages</option>{languages.map((language) => <option key={language} value={language}>{language.charAt(0).toUpperCase() + language.slice(1)}</option>)}</select></label>
      <label>Category<select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label>Difficulty<select value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}><option value="all">All difficulties</option><option value="easy">Easy</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
    </section>
    <section className="project-catalog" aria-labelledby="project-catalog-title">
      <div><h2 id="project-catalog-title">{projectResultsHeading(filters.difficulty)}</h2><p>{visible.length} {visible.length === 1 ? 'project' : 'projects'} available</p></div>
      {visible.length ? <div className="project-grid">{visible.map((project) => <ProjectCard key={project.id} project={project} progress={projectProgressService.get(project.id)} onOpen={(next) => { setSelected(next); setScreen('details'); }} />)}</div> : <p className="project-empty">No projects match these filters yet.</p>}
    </section>
  </div>;
}
