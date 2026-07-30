const STORAGE_PREFIX = 'mi-tutora:certificates:v1';

function keyFor(userId) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function parse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function createLocalCertificateRepository(storage = window.localStorage) {
  return {
    async load(userId) {
      return parse(storage.getItem(keyFor(userId)));
    },
    async save(userId, certificates) {
      storage.setItem(keyFor(userId), JSON.stringify(certificates));
      return certificates;
    },
    async clear(userId) {
      storage.removeItem(keyFor(userId));
    },
  };
}
