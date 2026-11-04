import { Bookmark } from 'lucide-react';
import { useBookmarks } from './BookmarkContext';
import '../styles/components/bookmark-toggle.css';

export function BookmarkToggle({ bookmark, onChange, iconOnly = false, className = '' }) {
  const { isBookmarked, status, toggleBookmark } = useBookmarks();
  const saved = isBookmarked(bookmark.id);
  const loading = status === 'loading';
  const toggle = () => {
    if (loading) return;
    toggleBookmark(bookmark);
    onChange?.(!saved);
  };

  return (
    <button
      className={`bookmark-toggle ${iconOnly ? 'is-icon-only' : ''} ${className}`.trim()}
      type="button"
      onClick={toggle}
      aria-label={saved ? `Remove ${bookmark.title} from Library` : `Save ${bookmark.title} to Library`}
      aria-pressed={saved}
      aria-busy={loading || undefined}
      disabled={loading}
    >
      <Bookmark fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      {!iconOnly ? <span>{saved ? 'Saved' : 'Save'}</span> : null}
    </button>
  );
}
