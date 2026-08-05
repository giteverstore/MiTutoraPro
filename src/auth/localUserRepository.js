const PROFILE_KEY = 'mi-tutora:user-profile:v1';
const SESSION_KEY = 'mi-tutora:user-session:v1';

function safelyParse(value) {
  try {
    return value ? parseJson(value, import.meta.url) : null;
  } catch {
    return null;
  }
}

export function createLocalUserRepository(storage = window.localStorage) {
  return {
    async loadCurrentUser() {
      return storage.getItem(SESSION_KEY) === 'active'
        ? safelyParse(storage.getItem(PROFILE_KEY))
        : null;
    },

    async loadProfile() {
      return safelyParse(storage.getItem(PROFILE_KEY));
    },

    async saveCurrentUser(user) {
      storage.setItem(PROFILE_KEY, JSON.stringify(user));
      storage.setItem(SESSION_KEY, 'active');
      return user;
    },

    async clearSession() {
      storage.removeItem(SESSION_KEY);
    },

    async deleteProfile() {
      storage.removeItem(PROFILE_KEY);
      storage.removeItem(SESSION_KEY);
    },
  };
}
import { parseJson } from '../utils/parseJson';
