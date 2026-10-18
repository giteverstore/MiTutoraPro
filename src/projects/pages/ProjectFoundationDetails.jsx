import { ArrowRight, Clock3, Code2, Layers3, Map, Target } from 'lucide-react';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import { useHeroPointerGrid } from '../../components/useHeroPointerGrid';
import { getProjectRuntime } from '../runtime/projectRuntimeRegistry';
import { projectDisplayDifficulty } from '../presentation/projectPresentation';
import '../../styles/hero-pointer-grid.css';

export function ProjectFoundationDetails({ project, progress, onStart }) {
  const { heroRef, onPointerEnter, onPointerMove, onPointerLeave } = useHeroPointerGrid();
  const completed = progress.completedCheckpoints?.length ?? 0;
  const total = project.checkpoints.length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  const difficulty = projectDisplayDifficulty(project.difficulty);
  return <div className="project-details">
    <section className="project-overview-hero hero-pointer-grid-host" ref={heroRef} onPointerEnter={onPointerEnter} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <div className="project-overview-grid hero-pointer-grid" aria-hidden="true" />
      <div className="project-overview-grid-highlight hero-pointer-grid-highlight" aria-hidden="true" />
      <div className="project-overview-layout">
        <div className="project-overview-copy">
          <div className="project-overview-kicker"><span>Project · {project.category}</span>{difficulty ? <DifficultyBadge difficulty={difficulty} /> : null}</div>
          <h1>{project.title}</h1><p>{project.description}</p>
        </div>
        <aside className="project-overview-summary" aria-label="Project summary">
          <div className="project-overview-metrics">
            <div><Layers3 aria-hidden="true" /><strong>{total}</strong><span>Checkpoints</span></div>
            <div><Code2 aria-hidden="true" /><strong>{project.supportedLanguages.length}</strong><span>Languages</span></div>
            <div><Clock3 aria-hidden="true" /><strong>{project.estimatedMinutes} min</strong><span>Duration</span></div>
          </div>
          <div className="project-overview-summary-bottom">
            <div className="project-overview-progress"><div><span>{completed}/{total} checkpoints</span><strong>{percent}% done</strong></div><div role="progressbar" aria-label="Project progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div></div>
            <button className="button button--primary" type="button" onClick={onStart}>{progress.status === 'active' ? 'Continue Project' : progress.status === 'completed' ? 'Review Project' : 'Start Project'} <ArrowRight aria-hidden="true" /></button>
          </div>
        </aside>
      </div>
    </section>
    <div className="project-details-main"><div className="project-language-badges" aria-label="Supported languages">{project.supportedLanguages.map((id) => <span key={id}>{getProjectRuntime(id).displayName}</span>)}</div>
    <div className="project-details-grid"><section><h2>What You’ll Build</h2><p>{project.whatYouWillBuild ?? project.instructions}</p><h2>What You’ll Learn</h2><ul>{project.learningObjectives.map((item) => <li key={item}>{item}</li>)}</ul><h2>Prerequisites</h2>{project.prerequisites.length ? <ul>{project.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Basic familiarity with the selected language.</p>}</section><aside><Map aria-hidden="true" /><h2>Project Roadmap</h2><ol className="project-roadmap">{project.checkpoints.map((checkpoint, index) => <li className={progress.completedCheckpoints?.includes(checkpoint.id) ? 'is-complete' : index === (progress.currentCheckpoint ?? 0) && progress.status !== 'not-started' ? 'is-current' : ''} key={checkpoint.id}><span>{index + 1}</span><div><strong>{checkpoint.title}</strong><small>{checkpoint.objective}</small></div></li>)}</ol><Target aria-hidden="true" /><h3>Skills</h3><div>{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></aside></div></div>
  </div>;
}
