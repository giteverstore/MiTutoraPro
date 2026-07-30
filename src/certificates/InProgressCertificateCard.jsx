import { ArrowRight, Clock3 } from 'lucide-react';

export function InProgressCertificateCard({ course, onContinue }) {
  return (
    <article className="certificate-progress-card">
      <span>{course.language}</span>
      <h3>{course.courseTitle}</h3>
      <p>{course.description}</p>
      <div className="certificate-progress-copy"><span>Course progress</span><strong>{course.progress}%</strong></div>
      <div className="certificate-progress-track" role="progressbar" aria-label={`${course.courseTitle} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={course.progress}><span style={{ width: `${course.progress}%` }} /></div>
      <div className="certificate-progress-footer">
        <span><Clock3 /> Certificate available at 100%</span>
        <button className="button button--secondary" type="button" onClick={() => onContinue(course.courseId)}>Continue <ArrowRight /></button>
      </div>
    </article>
  );
}
