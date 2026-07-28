import { Inbox } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

export function EmptyState({ title, description }) {
  return (
    <div className="empty-state" role="status">
      <span><Inbox size={ICON_SIZE.xl} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
