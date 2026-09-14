import { useMemo, useState } from 'react';
import { useBookmarks } from './BookmarkContext';
import { LibraryEmptyState } from './LibraryEmptyState';
import { LibraryFilters } from './LibraryFilters';
import { SavedItemCard } from './SavedItemCard';

export function LibraryPage({ onOpenBookmark }) {
  const { bookmarks } = useBookmarks();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const counts = useMemo(() => ({
    all: bookmarks.length,
    course: bookmarks.filter(({ type }) => type === 'course').length,
    practice: bookmarks.filter(({ type }) => type === 'practice').length,
    challenge: bookmarks.filter(({ type }) => type === 'challenge').length,
  }), [bookmarks]);
  const visibleBookmarks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookmarks.filter((bookmark) =>
      (activeTab === 'all' || bookmark.type === activeTab)
      && (!query || `${bookmark.title} ${bookmark.language} ${bookmark.topic}`.toLowerCase().includes(query)));
  }, [activeTab, bookmarks, search]);
  const filtered = activeTab !== 'all' || Boolean(search.trim());

  return (
    <div className="library-page">
      <LibraryFilters
        activeTab={activeTab}
        search={search}
        counts={counts}
        onTabChange={setActiveTab}
        onSearchChange={setSearch}
      />
      <section className="library-saved-items" aria-label="Saved bookmarks">
        {visibleBookmarks.length ? (
          <div className="saved-item-list">
            {visibleBookmarks.map((bookmark) => (
              <SavedItemCard bookmark={bookmark} onOpen={onOpenBookmark} key={bookmark.id} />
            ))}
          </div>
        ) : (
          <LibraryEmptyState
            filtered={filtered}
            onClear={() => { setActiveTab('all'); setSearch(''); }}
          />
        )}
      </section>
    </div>
  );
}
