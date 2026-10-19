import { useId } from 'react';
import '../styles/components/progress-circle.css';

export function ProgressCircle({ progress, label }) {
  const maskId = `card-progress-${useId().replaceAll(':', '')}`;
  const percentage = Math.min(100, Math.max(0, Math.round(Number(progress) || 0)));
  const boundary = 100 - percentage;
  const wavePath = percentage === 0
    ? 'M0 100 H100 V100 H0 Z'
    : percentage === 100
      ? 'M0 0 H100 V100 H0 Z'
      : `M0 ${boundary} Q25 ${boundary - 4} 50 ${boundary} T100 ${boundary} V100 H0 Z`;
  return <div className="library-course-progress" role="img" aria-label={`${label} progress ${percentage} percent`}>
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs><clipPath id={maskId}><path d={wavePath} /></clipPath></defs>
      <circle className="library-course-progress-base" cx="50" cy="50" r="48" />
      <g clipPath={`url(#${maskId})`}><circle className="library-course-progress-fill" cx="50" cy="50" r="48" /></g>
      <text className="library-course-progress-value" x="50" y="50">{percentage}%</text>
      <g clipPath={`url(#${maskId})`}><text className="library-course-progress-value is-contrast" x="50" y="50">{percentage}%</text></g>
      <circle className="library-course-progress-border" cx="50" cy="50" r="48" />
    </svg>
  </div>;
}
