import { listNormalizedMetadata, requireMetadata, requirePublished } from './serviceUtils';

export class BaseContentService {
  constructor({ repository, createMetadata, contentType, annotateError = (error) => error }) {
    if (!repository || !createMetadata || !contentType) {
      throw new TypeError('BaseContentService requires a repository, metadata model, and content type.');
    }
    this.repository = repository;
    this.createMetadata = createMetadata;
    this.contentType = contentType;
    this.annotateError = annotateError;
  }

  async getMetadata(id, { includeUnpublished = false } = {}) {
    let sourceMetadata;
    try {
      sourceMetadata = await this.repository.getMetadata(id);
    } catch (error) {
      throw this.annotateError(error, 'metadata-query');
    }
    try {
      const metadata = this.createMetadata(requireMetadata(sourceMetadata, this.contentType, id));
      return includeUnpublished ? metadata : requirePublished(metadata, this.contentType);
    } catch (error) {
      throw this.annotateError(error, 'metadata-normalization');
    }
  }

  listMetadata(options) {
    return listNormalizedMetadata(this.repository, this.createMetadata, options);
  }


  async listMetadataPage({ query }) {
    let page;
    try {
      page = await this.repository.listMetadataPage(query);
    } catch (error) {
      throw this.annotateError(error, 'metadata-query');
    }
    try {
      return Object.freeze({ ...page, items: Object.freeze(page.items.map(this.createMetadata)) });
    } catch (error) {
      throw this.annotateError(error, 'metadata-normalization');
    }
  }

  resolveVersion(metadata) {
    return metadata.version;
  }

  async loadFromMetadata(metadata, download, validate) {
    try {
      const content = await download(metadata, this.resolveVersion(metadata), { validate });
      return Object.freeze({ metadata, content });
    } catch (error) {
      throw this.annotateError(error, 'storage-download');
    }
  }

  async loadById(id, download, validate, options) {
    const metadata = await this.getMetadata(id, options);
    return this.loadFromMetadata(metadata, download, validate);
  }

  invalidateMetadata(id) {
    return this.repository.invalidateMetadata(id);
  }
}
