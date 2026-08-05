import { coursesPath } from '../../repositories/firestore/paths';
import { courseManifestPath, versionedCourseModulePath } from '../utils/contentPaths';
import { BaseContentRepository } from './BaseContentRepository';

export class CourseContentRepository extends BaseContentRepository {
  constructor(options) {
    super(coursesPath(), options);
  }

  loadManifest(storageRoot, version, options) {
    return this.downloadJson(courseManifestPath(storageRoot, version), options);
  }

  loadModule(storageRoot, version, moduleNumber, options) {
    return this.downloadJson(versionedCourseModulePath(storageRoot, version, moduleNumber), options);
  }
}
