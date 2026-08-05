import { coursesPath } from '../../repositories/firestore/paths';
import { courseManifestPath, versionedCourseModulePath } from '../utils/contentPaths';
import { BaseContentRepository } from './BaseContentRepository';

export class CourseContentRepository extends BaseContentRepository {
  constructor(options) {
    super(coursesPath(), options);
  }

  loadManifest(storageRoot, version, options) {
    console.log('[TRACE] CourseContentRepository.loadManifest');
    return this.downloadJson(courseManifestPath(storageRoot, version), options);
  }

  loadModule(storageRoot, version, moduleNumber, options) {
    console.log('[TRACE] CourseContentRepository.loadModule');
    return this.downloadJson(versionedCourseModulePath(storageRoot, version, moduleNumber), options);
  }
}
