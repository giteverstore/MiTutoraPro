import { Info } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { RichText } from '../RichText';

export function NoteBlock({ title, content, format }) {
  return (
    <aside className="card card--accent content-section note-card">
      <span className="note-icon"><Info size={ICON_SIZE.md} /></span>
      <div>
        <strong>{title}</strong>
        <RichText content={content} format={format} />
      </div>
    </aside>
  );
}
