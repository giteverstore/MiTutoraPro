import { ArrowRight, BookOpen } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

export function LessonHeader({ moduleName, lessonNumber, title, summary, details = [] }) {
  return (
    <header className="lesson-hero">
      <div className="lesson-breadcrumb">
        <BookOpen size={ICON_SIZE.sm} />
        <span>{moduleName}</span>
        <ArrowRight size={ICON_SIZE.xs} />
        <span>{lessonNumber}</span>
      </div>
      <h1>{title}</h1>
      <p>{summary}</p>
      <div className="lesson-details">
        {details.map((detail) => <span key={detail}>{detail}</span>)}
      </div>
    </header>
  );
}
