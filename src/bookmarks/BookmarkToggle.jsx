import { Bookmark } from 'lucide-react';
import { useBookmarks } from './BookmarkContext';

export function BookmarkToggle({ bookmark, onChange, iconOnly = false, className = '' }) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const saved = isBookmarked(bookmark.id);
  const toggle = () => {
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
    >
      <Bookmark fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      {!iconOnly ? <span>{saved ? 'Saved' : 'Save'}</span> : null}
    </button>
  );
}
