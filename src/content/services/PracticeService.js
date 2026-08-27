import { createPracticeMetadata } from '../models/practiceMetadata';
import { PracticeRepository } from '../repositories/PracticeRepository';
import { BaseContentService } from './BaseContentService';
import { versionedContentPath } from '../utils/contentPaths';
import { CONTENT_LIMITS } from '../validation/contentLimits';
import { annotatePracticeError } from '../../practice/practiceDiagnostics';

const validateQuestion = (value) => Boolean(value && !Array.isArray(value) && typeof value === 'object'
  && typeof value.id === 'string' && Array.isArray(value.blocks)
  && value.blocks.some((block) => block?.type === 'compiler'));

export class PracticeService extends BaseContentService {
  constructor(repository = new PracticeRepository()) {
    super({ repository, createMetadata: createPracticeMetadata, contentType: 'Practice question', annotateError: annotatePracticeError });
  }

  async getPublication() {
    try {
      return await this.repository.getPublication();
    } catch (error) {
      throw annotatePracticeError(error, 'publication-read');
    }
  }

  getQuestion(questionId, options) {
    return this.loadById(
      questionId,
      (metadata, version, loadOptions) => this.repository.loadQuestion(metadata.storagePath, version, { ...loadOptions, expectedHash: metadata.contentHash, maxBytes: CONTENT_LIMITS.runtime.maxPracticeDownloadBytes }),
      validateQuestion,
      options,
    );
  }

  getQuestionFromMetadata(metadata) {
    return this.loadFromMetadata(
      metadata,
      (item, version, loadOptions) => this.repository.loadQuestion(item.storagePath, version, { ...loadOptions, expectedHash: item.contentHash, maxBytes: CONTENT_LIMITS.runtime.maxPracticeDownloadBytes }),
      validateQuestion,
    );
  }

  invalidateQuestion(metadata) {
    this.invalidateMetadata(metadata.id);
    return this.repository.invalidate(versionedContentPath(metadata.storagePath, metadata.version));
  }
}
