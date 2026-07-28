import { TriangleAlert } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function WarningBlock({ title, content }) {
  return (
    <aside className="card content-section warning-card" role="alert">
      <span className="warning-icon"><TriangleAlert size={ICON_SIZE.md} /></span>
      <div>
        <strong>{title}</strong>
        <p>{content}</p>
      </div>
    </aside>
  );
}
