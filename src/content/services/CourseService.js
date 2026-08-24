import { createCourseMetadata } from '../models/courseMetadata';
import { CourseContentRepository } from '../repositories/CourseContentRepository';
import { courseManifestPath, versionedCourseModulePath } from '../utils/contentPaths';
import { CONTENT_ERROR_CODES, ContentError } from '../utils/ContentError';
import { BaseContentService } from './BaseContentService';
import { getModuleLessons, resolveLessonModuleNumber } from '../../course/courseStructure.js';
import { CONTENT_LIMITS } from '../validation/contentLimits';

const validateModule = (value) => Boolean(
  value
  && !Array.isArray(value)
  && typeof value === 'object'
  && typeof value.id === 'string'
  && typeof value.title === 'string'
  && (Array.isArray(value.lessons) || Array.isArray(value.sections))
  && getModuleLessons(value).length > 0,
);
const validateManifest = (value) => Boolean(
  value
  && !Array.isArray(value)
  && typeof value === 'object'
  && typeof value.id === 'string'
  && typeof value.title === 'string'
  && value.navigation
  && Array.isArray(value.modules)
  && Array.isArray(value.moduleFiles),
);

function validateManifestAgainstMetadata(manifest, metadata) {
  const expectedFiles = Array.from(
    { length: metadata.moduleCount },
    (_, index) => `module-${index + 1}.json`,
  );
  if (manifest.id !== metadata.id || JSON.stringify(manifest.moduleFiles) !== JSON.stringify(expectedFiles)) {
    throw new ContentError(
      CONTENT_ERROR_CODES.malformedJson,
      'The course manifest does not match its published metadata.',
      { details: { courseId: metadata.id, storagePath: metadata.storagePath, version: metadata.version } },
    );
  }
  const outlineIsValid = manifest.modules.length === metadata.moduleCount
    && manifest.modules.every((module) => validateModule(module))
    && manifest.modules.every((module) =>
      getModuleLessons(module).every((lesson) => Array.isArray(lesson.blocks) && lesson.blocks.length === 0));
  if (!outlineIsValid) {
    throw new ContentError(
      CONTENT_ERROR_CODES.malformedJson,
      'The course manifest does not contain a valid content-free course outline.',
      { details: { courseId: metadata.id, storagePath: metadata.storagePath, version: metadata.version } },
    );
  }
}

export { resolveLessonModuleNumber } from '../../course/courseStructure.js';

export class CourseService extends BaseContentService {
  constructor(repository = new CourseContentRepository()) {
    super({ repository, createMetadata: createCourseMetadata, contentType: 'Course' });
  }

  async getModule(courseId, moduleNumber, options) {
    const metadata = await this.getMetadata(courseId, options);
    const content = await this.getCourseModule(metadata, moduleNumber);
    return Object.freeze({ metadata, moduleNumber, content });
  }

  getCourseModule(metadata, moduleNumber) {
    if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber > metadata.moduleCount) {
      throw new RangeError(`Module number must be between 1 and ${metadata.moduleCount}.`);
    }
    return this.repository.loadModule(
      metadata.storagePath,
      this.resolveVersion(metadata),
      moduleNumber,
      { validate: validateModule, expectedHash: metadata.contentIntegrity?.modules?.[`module-${moduleNumber}.json`], maxBytes: CONTENT_LIMITS.runtime.maxCourseDownloadBytes },
    );
  }

  async getCourse(courseId, { initialLessonId, ...options } = {}) {
    const metadata = await this.getMetadata(courseId, options);
    const manifest = await this.repository.loadManifest(
      metadata.storagePath,
      this.resolveVersion(metadata),
      { validate: validateManifest, expectedHash: metadata.contentIntegrity?.manifest, maxBytes: CONTENT_LIMITS.course.maxManifestBytes },
    );
    validateManifestAgainstMetadata(manifest, metadata);
    const initialModuleNumber = resolveLessonModuleNumber(
      initialLessonId ?? manifest.navigation.defaultLessonId,
      manifest.modules,
    );
    const initialModules = initialModuleNumber
      ? [await this.getCourseModule(metadata, initialModuleNumber)]
      : [];
    const { moduleFiles: _moduleFiles, modules: outlineModules, ...courseFields } = manifest;
    const modules = outlineModules.map((module, index) =>
      index + 1 === initialModuleNumber ? initialModules[0] : module);
    return Object.freeze({
      metadata,
      initialModuleNumber,
      course: Object.freeze({ ...courseFields, modules: Object.freeze(modules) }),
    });
  }

  evictCourseModule(metadata, moduleNumber) {
    return this.repository.invalidate(
      versionedCourseModulePath(metadata.storagePath, metadata.version, moduleNumber),
    );
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
