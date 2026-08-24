import { practiceQuestionsPath } from '../../repositories/firestore/paths';
import { BaseContentRepository } from './BaseContentRepository';
import { versionedContentPath } from '../utils/contentPaths';
import { BaseRepository } from '../../repositories/firestore/BaseRepository';
import { contentMetadataConverter } from './contentMetadataConverter';

export class PracticeRepository extends BaseContentRepository {
  constructor(options) {
    super(practiceQuestionsPath(), options);
    this.publications = new BaseRepository('contentPublications', contentMetadataConverter);
  }

  getPublication() { return this.publications.get('practice-python'); }

  loadQuestion(storagePath, version, options) {
    return this.downloadJson(versionedContentPath(storagePath, version), options);
  }
}
