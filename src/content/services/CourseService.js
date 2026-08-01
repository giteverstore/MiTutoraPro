import { createCourseMetadata } from '../models/courseMetadata';
import { CourseContentRepository } from '../repositories/CourseContentRepository';
import { courseManifestPath, versionedCourseModulePath } from '../utils/contentPaths';
import { CONTENT_ERROR_CODES, ContentError } from '../utils/ContentError';
import { BaseContentService } from './BaseContentService';

const validateModule = (value) => Boolean(
  value
  && !Array.isArray(value)
  && typeof value === 'object'
  && typeof value.id === 'string'
  && typeof value.title === 'string'
  && Array.isArray(value.lessons),
);
const validateManifest = (value) => Boolean(
  value
  && !Array.isArray(value)
  && typeof value === 'object'
  && typeof value.id === 'string'
  && typeof value.title === 'string'
  && value.navigation
  && Array.isArray(value.moduleFiles),
);

export class CourseService extends BaseContentService {
  constructor(repository = new CourseContentRepository()) {
    super({ repository, createMetadata: createCourseMetadata, contentType: 'Course' });
  }

  async getModule(courseId, moduleNumber, options) {
    const metadata = await this.getMetadata(courseId, options);
    const content = await this.repository.loadModule(metadata.storagePath, this.resolveVersion(metadata), moduleNumber, { validate: validateModule });
    return Object.freeze({ metadata, moduleNumber, content });
  }

  async getCourse(courseId, options) {
    const metadata = await this.getMetadata(courseId, options);
    const [manifest, ...modules] = await Promise.all([
      this.repository.loadManifest(metadata.storagePath, this.resolveVersion(metadata), { validate: validateManifest }),
      ...Array.from({ length: metadata.moduleCount }, (_, index) =>
        this.repository.loadModule(metadata.storagePath, this.resolveVersion(metadata), index + 1, { validate: validateModule })),
    ]);
    const expectedFiles = Array.from({ length: metadata.moduleCount }, (_, index) => `module-${index + 1}.json`);
    if (manifest.id !== metadata.id || JSON.stringify(manifest.moduleFiles) !== JSON.stringify(expectedFiles)) {
      throw new ContentError(
        CONTENT_ERROR_CODES.malformedJson,
        'The course manifest does not match its published metadata.',
        { details: { courseId, storagePath: metadata.storagePath, version: metadata.version } },
      );
    }
    const { moduleFiles: _moduleFiles, modules: _embeddedModules, ...courseFields } = manifest;
    return Object.freeze({
      metadata,
      course: Object.freeze({ ...courseFields, modules: Object.freeze(modules) }),
    });
  }

  invalidateCourse(courseId, metadata) {
    this.repository.invalidateMetadata(courseId);
    if (!metadata) return;
    this.repository.invalidate(courseManifestPath(metadata.storagePath, metadata.version));
    for (let moduleNumber = 1; moduleNumber <= metadata.moduleCount; moduleNumber += 1) {
      this.repository.invalidate(versionedCourseModulePath(metadata.storagePath, metadata.version, moduleNumber));
    }
  }
}
