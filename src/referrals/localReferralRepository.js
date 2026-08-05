const STORAGE_PREFIX = 'mi-tutora:referrals:v1';

function keyFor(userId) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function parse(value) {
  try {
    return value ? parseJson(value, import.meta.url) : null;
  } catch {
    return null;
  }
}

export function createLocalReferralRepository(storage = window.localStorage) {
  return {
    async load(userId) {
      return parse(storage.getItem(keyFor(userId)));
    },
    async save(userId, profile) {
      storage.setItem(keyFor(userId), JSON.stringify(profile));
      return profile;
    },
    async clear(userId) {
      storage.removeItem(keyFor(userId));
    },
  };
}
import { parseJson } from '../utils/parseJson';
