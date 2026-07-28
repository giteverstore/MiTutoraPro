import { CircleAlert } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function UnknownBlock({ type }) {
  return (
    <aside className="card content-section unknown-block" role="status">
      <CircleAlert size={ICON_SIZE.md} />
      <div>
        <strong>Unsupported lesson block</strong>
        <p>The “{type || 'unknown'}” block type is not available in this interface.</p>
      </div>
    </aside>
  );
}
