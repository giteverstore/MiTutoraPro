import { Clock3, Layers3, TerminalSquare } from 'lucide-react';
import { ContentTypeBadge } from '../../components/ContentTypeBadge';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import { ProgressCircle } from '../../components/ProgressCircle';
import { projectArtwork, projectDisplayDifficulty } from '../presentation/projectPresentation';
import { projectCardLanguages } from '../presentation/projectCardLanguages';
import '../../styles/components/card-footer.css';

export function ProjectFoundationCard({ project, progress, progressPending = false, onOpen }) {
  const comingSoon = project.comingSoon === true;
  const pending = !comingSoon && (progressPending || !progress);
  const total = project.checkpoints.length;
  const completed = Math.min(total, progress?.completedCheckpoints?.length ?? 0);
  const percentage = progress?.status === 'completed' ? 100 : total ? Math.round((completed / total) * 100) : 0;
  const artwork = projectArtwork(project);
  const difficulty = projectDisplayDifficulty(project.difficulty);
  const languages = comingSoon ? { icons: [], overflow: 0 } : projectCardLanguages(project.supportedLanguages);
  const open = () => { if (!pending && !comingSoon) onOpen(project); };
  return <article
    className={`project-card${pending ? ' is-progress-pending' : ''}${comingSoon ? ' is-coming-soon' : ''}`}
    aria-labelledby={`project-card-title-${project.id}`}
    role={comingSoon ? undefined : 'link'}
    aria-disabled={comingSoon || pending || undefined}
    tabIndex={comingSoon || pending ? undefined : 0}
    onClick={(event) => { if (!event.target.closest('button, a')) open(); }}
    onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button, a')) { event.preventDefault(); open(); } }}
  >
    <header className="project-card-header"><ContentTypeBadge type="Project" />{difficulty ? <DifficultyBadge difficulty={difficulty} /> : null}</header>
    <div className={`project-card-artwork${artwork ? '' : ' is-empty'}`} aria-hidden="true">
      {artwork?.kind === 'image' ? <img src={artwork.src} alt="" loading="lazy" decoding="async" /> : null}
      {artwork?.kind === 'terminal' ? <TerminalSquare /> : null}
    </div>
    <h3 id={`project-card-title-${project.id}`}>{project.title}</h3>
    <footer className="project-card-footer">
      <div className="project-card-divider" aria-hidden="true" />
      {comingSoon ? <span className="card-footer-coming-soon">Coming Soon</span>
        : pending ? <span className="project-card-progress-pending" role="status">Loading progress…</span>
          : <ProgressCircle progress={percentage} label="Project" />}
      {languages.icons.length ? <div className="project-card-languages" aria-label="Supported languages">
        {languages.icons.map(({ id, label, icon }) => <img key={id} src={icon} alt={label} title={label} width="16" height="16" />)}
        {languages.overflow ? <span className="project-card-language-overflow" aria-label={`${languages.overflow} more languages`} title={`${languages.overflow} more languages`}>+{languages.overflow}</span> : null}
      </div> : null}
      {!comingSoon ? <div className="project-card-meta card-footer-meta"><span><Clock3 aria-hidden="true" />{project.estimatedMinutes} min</span><span><Layers3 aria-hidden="true" />{total} checkpoints</span></div> : null}
    </footer>
  </article>;
}
