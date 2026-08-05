import { BookmarkRepository } from '../repositories/firestore/BookmarkRepository';
import { CertificateRepository } from '../repositories/firestore/CertificateRepository';
import { ProgressRepository } from '../repositories/firestore/ProgressRepository';
import { ReferralRepository } from '../repositories/firestore/ReferralRepository';
import { SettingsRepository } from '../repositories/firestore/SettingsRepository';
import { USER_DATA_ERROR_CODES, UserDataError } from './UserDataError';

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const cacheKey = (...segments) => segments.join(':');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function createProgressData(progress, courseId) {
  const {
    id: _id,
    startedAt: _startedAt,
    lastOpened: _lastOpened,
    updatedAt: _updatedAt,
    ...data
  } = progress ?? {};
  return {
    ...data,
    courseId,
    currentModule: data.currentModule ?? null,
    currentLesson: data.currentLesson ?? null,
    completedLessons: data.completedLessons ?? [],
    completedExercises: data.exerciseCompletion ?? data.completedExercises ?? {},
    completedQuizzes: data.quizScores ?? data.completedQuizzes ?? {},
    completion: data.courseProgress ?? data.completion ?? 0,
  };
}

function friendlyError(error, operation, write = false) {
  if (error instanceof UserDataError) return error;
  const unavailable = ['unavailable', 'deadline-exceeded', 'network-request-failed']
    .some((code) => String(error?.code ?? '').includes(code));
  return new UserDataError(
    unavailable ? USER_DATA_ERROR_CODES.unavailable : write ? USER_DATA_ERROR_CODES.writeFailed : USER_DATA_ERROR_CODES.readFailed,
    unavailable
      ? 'Your data is temporarily unavailable. Please check your connection and try again.'
      : write ? 'Your changes could not be saved. Please try again.' : 'Your data could not be loaded. Please try again.',
    { cause: error, operation },
  );
}

export class UserDataService {
  constructor({ repositoryFactories = {} } = {}) {
    this.cache = new Map();
    this.repositories = new Map();
    this.writeQueues = new Map();
    this.persistedProgressSnapshots = new Map();
    this.activeUserId = null;
    this.repositoryFactories = repositoryFactories;
    this.cacheGeneration = 0;
  }

  async setAuthenticatedUser(uid) {
    const nextUid = uid ? String(uid) : null;
    if (this.activeUserId && this.activeUserId !== nextUid) await this.clearCache();
    this.activeUserId = nextUid;
  }

  async clearCache() {
    this.cacheGeneration += 1;
    this.cache.clear();
    this.repositories.clear();
    this.writeQueues.clear();
    this.persistedProgressSnapshots.clear();
    this.activeUserId = null;
  }

  repository(uid, type, Factory) {
    if (!uid) throw new UserDataError(USER_DATA_ERROR_CODES.unauthenticated, 'Sign in to access your saved data.');
    const key = cacheKey(uid, type);
    const RepositoryFactory = this.repositoryFactories[type] ?? Factory;
    if (!this.repositories.has(key)) this.repositories.set(key, new RepositoryFactory(uid));
    return this.repositories.get(key);
  }

  async read(key, operation) {
    const generation = this.cacheGeneration;
    try {
      const value = await operation();
      if (generation === this.cacheGeneration) this.cache.set(key, clone(value));
      return clone(value);
    } catch (error) {
      if (this.cache.has(key)) return clone(this.cache.get(key));
      throw friendlyError(error, `read:${key}`);
    }
  }

  async write(key, operation) {
    const generation = this.cacheGeneration;
    const previous = this.writeQueues.get(key) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(async () => {
      try {
        const value = await operation();
        if (generation === this.cacheGeneration) this.cache.set(key, clone(value));
        return clone(value);
      } catch (error) {
        throw friendlyError(error, `write:${key}`, true);
      }
    });
    this.writeQueues.set(key, pending);
    pending.then(() => {
      if (this.writeQueues.get(key) === pending) this.writeQueues.delete(key);
    }, () => {
      if (this.writeQueues.get(key) === pending) this.writeQueues.delete(key);
    });
    return pending;
  }

  async loadProgress(uid, courseId) {
    const key = cacheKey(uid, 'progress', courseId);
    const progress = await this.read(
      key,
      () => this.repository(uid, 'progress', ProgressRepository).get(courseId),
    );
    if (progress) {
      this.persistedProgressSnapshots.set(
        key,
        stableSerialize(createProgressData(progress, courseId)),
      );
    } else this.persistedProgressSnapshots.delete(key);
    return progress;
  }

  async saveProgress(uid, courseId, progress) {
    const key = cacheKey(uid, 'progress', courseId);
    const generation = this.cacheGeneration;
    return this.write(key, async () => {
      const existing = this.cache.get(key) ?? await this.repository(uid, 'progress', ProgressRepository).get(courseId);
      const progressData = createProgressData(progress, courseId);
      const serializedProgress = stableSerialize(progressData);
      const persistedSnapshot = this.persistedProgressSnapshots.get(key)
        ?? (existing ? stableSerialize(createProgressData(existing, courseId)) : null);
      if (serializedProgress === persistedSnapshot) return existing;

      const now = new Date().toISOString();
      const document = {
        ...progressData,
        startedAt: existing?.startedAt ?? now,
        lastOpened: now,
        updatedAt: now,
      };
      const saved = await this.repository(uid, 'progress', ProgressRepository).set(courseId, document);
      if (this.cacheGeneration === generation) {
        this.persistedProgressSnapshots.set(key, serializedProgress);
      }
      return saved;
    });
  }

  async clearProgress(uid, courseId) {
    const key = cacheKey(uid, 'progress', courseId);
    await this.write(key, async () => {
      await this.repository(uid, 'progress', ProgressRepository).remove(courseId);
      return null;
    });
    this.cache.delete(key);
    this.persistedProgressSnapshots.delete(key);
  }

  async clearAllProgress(uid) {
    const keyPrefix = cacheKey(uid, 'progress');
    await this.write(cacheKey(keyPrefix, 'all'), () =>
      this.repository(uid, 'progress', ProgressRepository).replaceAll([]));
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) this.cache.delete(key);
    }
    for (const key of this.persistedProgressSnapshots.keys()) {
      if (key.startsWith(keyPrefix)) this.persistedProgressSnapshots.delete(key);
    }
  }

  async loadBookmarks(uid) {
    return this.read(cacheKey(uid, 'bookmarks'), () => this.repository(uid, 'bookmarks', BookmarkRepository).list());
  }

  async saveBookmarks(uid, bookmarks) {
    const key = cacheKey(uid, 'bookmarks');
    return this.write(key, () => this.repository(uid, 'bookmarks', BookmarkRepository).replaceAll(bookmarks));
  }

  async clearBookmarks(uid) {
    return this.saveBookmarks(uid, []);
  }

  async loadSettings(uid) {
    return this.read(cacheKey(uid, 'settings'), () => this.repository(uid, 'settings', SettingsRepository).getPreferences());
  }

  async saveSettings(uid, settings) {
    const key = cacheKey(uid, 'settings');
    return this.write(key, () => this.repository(uid, 'settings', SettingsRepository).setPreferences(settings));
  }

  async loadCertificates(uid) {
    return this.read(cacheKey(uid, 'certificates'), () => this.repository(uid, 'certificates', CertificateRepository).list());
  }

  async saveCertificates(uid, certificates) {
    const key = cacheKey(uid, 'certificates');
    return this.write(key, () => this.repository(uid, 'certificates', CertificateRepository).replaceAll(certificates));
  }

  async clearCertificates(uid) {
    return this.saveCertificates(uid, []);
  }

  async loadReferral(uid) {
    return this.read(cacheKey(uid, 'referral'), () => this.repository(uid, 'referral', ReferralRepository).getProfile());
  }

  async saveReferral(uid, profile) {
    const key = cacheKey(uid, 'referral');
    return this.write(key, () => this.repository(uid, 'referral', ReferralRepository).setProfile(profile));
  }

  async clearReferral(uid) {
    const key = cacheKey(uid, 'referral');
    await this.write(key, async () => {
      await this.repository(uid, 'referral', ReferralRepository).removeProfile();
      return null;
    });
    this.cache.delete(key);
  }
}

export const userDataService = new UserDataService();
