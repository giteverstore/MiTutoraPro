import { BaseRepository } from '../../repositories/firestore/BaseRepository';
import { ContentCache } from '../cache/ContentCache';
import { storageContentLoader } from '../storage/StorageContentLoader';
import { contentMetadataConverter } from './contentMetadataConverter';

const metadataCache = new ContentCache();
const metadataListKeys = new Map();

export class BaseContentRepository {
  constructor(collectionPath, { loader = storageContentLoader, converter = contentMetadataConverter } = {}) {
    this.collectionPath = collectionPath;
    this.metadata = new BaseRepository(collectionPath, converter);
    this.loader = loader;
  }

  getMetadata(id) {
    const cacheKey = `${this.collectionPath}/${id}`;
    return metadataCache.getOrCreate(cacheKey, () => this.metadata.get(id));
  }

  listMetadata(queryDescriptor) {
    const cacheKey = `${this.collectionPath}:list:${JSON.stringify(queryDescriptor ?? {})}`;
    if (!metadataListKeys.has(this.collectionPath)) metadataListKeys.set(this.collectionPath, new Set());
    metadataListKeys.get(this.collectionPath).add(cacheKey);
    return metadataCache.getOrCreate(
      cacheKey,
      () => queryDescriptor ? this.metadata.query(queryDescriptor) : this.metadata.list(),
    );
  }

  downloadJson(storagePath, options) {
    return this.loader.load(storagePath, options);
  }

  invalidate(storagePath) {
    return this.loader.invalidate(storagePath);
  }

  invalidateMetadata(id) {
    const removed = metadataCache.invalidate(`${this.collectionPath}/${id}`);
    for (const cacheKey of metadataListKeys.get(this.collectionPath) ?? []) metadataCache.invalidate(cacheKey);
    metadataListKeys.delete(this.collectionPath);
    return removed;
  }
}
