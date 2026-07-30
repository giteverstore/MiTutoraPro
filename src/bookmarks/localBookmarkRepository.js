const STORAGE_PREFIX = 'mi-tutora:bookmarks:v1';

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function parse(value) {
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export function createLocalBookmarkRepository(storage = window.localStorage) {
  return {
    async load(userId) {
      return parse(storage.getItem(storageKey(userId)));
    },
    async save(userId, bookmarks) {
      storage.setItem(storageKey(userId), JSON.stringify(bookmarks));
      return bookmarks;
    },
    async clear(userId) {
      storage.removeItem(storageKey(userId));
    },
  };
}
