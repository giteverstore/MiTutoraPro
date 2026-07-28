import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { CourseCard } from './CourseCard';

export function CourseSection({ section, courses, onContinue, onViewAll }) {
  return (
    <section className="dashboard-section" id={section.id} aria-labelledby={`${section.id}-title`}>
      <header className="dashboard-section-header">
        <div>
          <span className="eyebrow">{section.eyebrow}</span>
          <h2 id={`${section.id}-title`}>{section.title}</h2>
          <p>{section.description}</p>
        </div>
        <button className="button button--ghost" type="button" onClick={() => onViewAll(section.id)}>
          View all <ArrowRight size={ICON_SIZE.sm} />
        </button>
      </header>
      <div className="course-card-grid">
        {courses.map((course) => (
          <CourseCard course={course} onContinue={onContinue} key={course.id} />
        ))}
      </div>
    </section>
  );
}

