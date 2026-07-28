import { ArrowRight, Clock3, Play } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

export function ContinueLearningCard({ course, onContinue }) {
  return (
    <section className="continue-learning-card" aria-labelledby="continue-title">
      <div className="continue-course-mark"><Play size={ICON_SIZE.xl} fill="currentColor" /></div>
      <div className="continue-course-copy">
        <span className="eyebrow">Continue learning</span>
        <h2 id="continue-title">{course.name}</h2>
        <p>Next: Variables, values, and your first reusable Python program.</p>
        <div className="continue-meta">
          <span><Clock3 size={ICON_SIZE.sm} /> 12 min lesson</span>
          <span>{course.progress}% complete</span>
        </div>
        <div className="continue-progress"><span style={{ width: `${course.progress}%` }} /></div>
      </div>
      <button className="button continue-button" type="button" onClick={() => onContinue(course)}>
        Resume lesson <ArrowRight size={ICON_SIZE.base} />
      </button>
    </section>
  );
}

