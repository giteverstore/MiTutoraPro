import { BaseRepository } from './BaseRepository';
import { settingsConverter } from './converters';
import { FIRESTORE_DOCUMENT_IDS, userSettingsPath } from './paths';

export class SettingsRepository extends BaseRepository {
  constructor(uid) {
    super(userSettingsPath(uid), settingsConverter);
  }

  getPreferences() {
    return this.get(FIRESTORE_DOCUMENT_IDS.preferences);
  }

  setPreferences(data) {
    return this.set(FIRESTORE_DOCUMENT_IDS.preferences, data);
  }

  updatePreferences(partial) {
    return this.update(FIRESTORE_DOCUMENT_IDS.preferences, partial);
  }
}
