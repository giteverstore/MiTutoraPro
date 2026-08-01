import { createPracticeMetadata } from '../models/practiceMetadata';
import { PracticeRepository } from '../repositories/PracticeRepository';
import { BaseContentService } from './BaseContentService';
import { versionedContentPath } from '../utils/contentPaths';

const validateQuestion = (value) => Boolean(value && !Array.isArray(value) && typeof value === 'object'
  && typeof value.id === 'string' && Array.isArray(value.blocks)
  && value.blocks.some((block) => block?.type === 'compiler'));

export class PracticeService extends BaseContentService {
  constructor(repository = new PracticeRepository()) {
    super({ repository, createMetadata: createPracticeMetadata, contentType: 'Practice question' });
  }

  getQuestion(questionId, options) {
    return this.loadById(
      questionId,
      (metadata, version, loadOptions) => this.repository.loadQuestion(metadata.storagePath, version, loadOptions),
      validateQuestion,
      options,
    );
  }

  getQuestionFromMetadata(metadata) {
    return this.loadFromMetadata(
      metadata,
      (item, version, loadOptions) => this.repository.loadQuestion(item.storagePath, version, loadOptions),
      validateQuestion,
    );
  }

  invalidateQuestion(metadata) {
    this.invalidateMetadata(metadata.id);
    return this.repository.invalidate(versionedContentPath(metadata.storagePath, metadata.version));
  }
}
