import { getNormalizedMetadata, listNormalizedMetadata } from './serviceUtils';

export class BaseContentService {
  constructor({ repository, createMetadata, contentType }) {
    if (!repository || !createMetadata || !contentType) {
      throw new TypeError('BaseContentService requires a repository, metadata model, and content type.');
    }
    this.repository = repository;
    this.createMetadata = createMetadata;
    this.contentType = contentType;
  }

  getMetadata(id, { includeUnpublished = false } = {}) {
    return getNormalizedMetadata(
      this.repository,
      id,
      this.createMetadata,
      this.contentType,
      includeUnpublished,
    );
  }

  listMetadata(options) {
    return listNormalizedMetadata(this.repository, this.createMetadata, options);
  }

  resolveVersion(metadata) {
    return metadata.version;
  }

  async loadFromMetadata(metadata, download, validate) {
    const content = await download(metadata, this.resolveVersion(metadata), { validate });
    return Object.freeze({ metadata, content });
  }

  async loadById(id, download, validate, options) {
    const metadata = await this.getMetadata(id, options);
    return this.loadFromMetadata(metadata, download, validate);
  }

  invalidateMetadata(id) {
    return this.repository.invalidateMetadata(id);
  }
}
