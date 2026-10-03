import { ArrowRight, Clock3, Code2 } from 'lucide-react';
import { getProjectRuntime } from '../runtime/projectRuntimeRegistry';

export function ProjectFoundationCard({ project, progress, onOpen }) {
  const completed = progress.completedCheckpoints?.length ?? 0;
  return <article className="project-card"><div className="project-card-icon" aria-hidden="true"><Code2 /></div><div><span>{project.difficulty}</span><h3>{project.title}</h3><p>{project.description}</p><div className="project-card-languages" aria-label="Supported languages">{project.supportedLanguages.map((id) => <small key={id}>{getProjectRuntime(id).displayName}</small>)}</div>{progress.status !== 'not-started' ? <p className="project-card-progress">{completed} / {project.checkpoints.length} checkpoints</p> : null}<footer><small><Clock3 /> {project.estimatedMinutes} min</small><button className="button button--primary" type="button" onClick={() => onOpen(project)}>{progress.status === 'completed' ? 'Review Project' : progress.status === 'active' ? 'Continue Project' : 'Start Project'} <ArrowRight /></button></footer></div></article>;
}
