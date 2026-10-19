import { Clock3, Layers3, TerminalSquare } from 'lucide-react';
import { ContentTypeBadge } from '../../components/ContentTypeBadge';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import { getProjectRuntime } from '../runtime/projectRuntimeRegistry';
import { projectArtwork, projectDisplayDifficulty } from '../presentation/projectPresentation';

export function ProjectFoundationCard({ project, progress, progressPending = false, onOpen }) {
  const comingSoon = project.comingSoon === true;
  const completed = progress?.completedCheckpoints?.length ?? 0;
  const artwork = projectArtwork(project);
  const difficulty = projectDisplayDifficulty(project.difficulty);
  const open = () => { if (!progressPending && !comingSoon) onOpen(project); };
  return <article
    className={`project-card${comingSoon ? ' is-coming-soon' : ''}`}
    aria-labelledby={`project-card-title-${project.id}`}
    role={comingSoon ? undefined : 'link'}
    aria-disabled={comingSoon || progressPending || undefined}
    tabIndex={comingSoon || progressPending ? undefined : 0}
    onClick={(event) => { if (!event.target.closest('button, a')) open(); }}
    onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button, a')) { event.preventDefault(); open(); } }}
  >
    <header className="project-card-header"><ContentTypeBadge type="Project" />{difficulty ? <DifficultyBadge difficulty={difficulty} /> : null}</header>
    <div className={`project-card-artwork${artwork ? '' : ' is-empty'}`} aria-hidden="true">
      {artwork?.kind === 'image' ? <img src={artwork.src} alt="" /> : null}
      {artwork?.kind === 'terminal' ? <TerminalSquare /> : null}
    </div>
    <h3 id={`project-card-title-${project.id}`}>{project.title}</h3>
    <p className="project-card-description">{project.description}</p>
    <div className="project-card-languages" aria-label="Supported languages">{project.supportedLanguages.map((id) => <small key={id}>{getProjectRuntime(id).displayName}</small>)}</div>
    {!comingSoon && (progressPending ? <p className="project-card-progress" role="status">Loading progress…</p>
      : progress.status !== 'not-started' ? <p className="project-card-progress">{completed} / {project.checkpoints.length} checkpoints</p> : null)}
    <footer className="project-card-footer">
      <div className="project-card-divider" aria-hidden="true" />
      {comingSoon ? <span className="project-card-coming-soon">Coming Soon</span> : <>
        <div className="project-card-meta"><span><Clock3 aria-hidden="true" />{project.estimatedMinutes} min</span><span><Layers3 aria-hidden="true" />{project.checkpoints.length} checkpoints</span></div>
        <button className="project-card-action" type="button" onClick={open} disabled={progressPending}>{progressPending ? 'Loading…' : progress.status === 'completed' ? 'Review Project' : progress.status === 'active' ? 'Continue Project' : 'Start Project'}</button>
      </>}
    </footer>
  </article>;
}
