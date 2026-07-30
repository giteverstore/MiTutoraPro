import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { bookmarkRepository as defaultRepository } from './bookmarkRepository';

const BookmarkContext = createContext(null);

export function BookmarkProvider({ userId, children, repository = defaultRepository }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    repository.load(userId).then((stored) => {
      if (!active) return;
      setBookmarks(Array.isArray(stored) ? stored : []);
      setStatus('ready');
    });
    return () => { active = false; };
  }, [repository, userId]);

  const toggleBookmark = useCallback((bookmark) => {
    setBookmarks((current) => {
      const exists = current.some(({ id }) => id === bookmark.id);
      const next = exists
        ? current.filter(({ id }) => id !== bookmark.id)
        : [{ ...bookmark, savedAt: new Date().toISOString() }, ...current];
      repository.save(userId, next);
      return next;
    });
  }, [repository, userId]);

  const value = useMemo(() => ({
    status,
    bookmarks,
    toggleBookmark,
    isBookmarked: (bookmarkId) => bookmarks.some(({ id }) => id === bookmarkId),
  }), [bookmarks, status, toggleBookmark]);

  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

export function useBookmarks() {
  const context = useContext(BookmarkContext);
  if (!context) throw new Error('useBookmarks must be used inside BookmarkProvider.');
  return context;
}
