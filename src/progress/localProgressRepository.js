const STORAGE_PREFIX = 'mi-tutora:learning-progress:v1';

function getStorageKey(userId, courseId) {
  return `${STORAGE_PREFIX}:${userId}:${courseId}`;
}

function safelyParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function createLocalProgressRepository(storage = window.localStorage) {
  return {
    async load(userId, courseId) {
      return safelyParse(storage.getItem(getStorageKey(userId, courseId)));
    },

    async save(userId, courseId, progress) {
      storage.setItem(getStorageKey(userId, courseId), JSON.stringify(progress));
      return progress;
    },

    async clear(userId, courseId) {
      storage.removeItem(getStorageKey(userId, courseId));
    },
  };
}

