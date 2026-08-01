import { practiceQuestionsPath } from '../../repositories/firestore/paths';
import { BaseContentRepository } from './BaseContentRepository';
import { versionedContentPath } from '../utils/contentPaths';

export class PracticeRepository extends BaseContentRepository {
  constructor(options) {
    super(practiceQuestionsPath(), options);
  }

  loadQuestion(storagePath, version, options) {
    return this.downloadJson(versionedContentPath(storagePath, version), options);
  }
}
