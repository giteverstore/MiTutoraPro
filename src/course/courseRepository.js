import { CourseService, resolveLessonModuleNumber } from '../content/services/CourseService';
import { adaptCanonicalCourse, CanonicalPublishedRepository, CanonicalPublishedRepositoryError } from '../content/repositories/CanonicalPublishedRepository.js';

const LOCAL_METADATA_URL = '/courses/course-metadata.json';
const isDevelopmentRuntime = import.meta.env.DEV || import.meta.env.MODE === 'e2e';
const LOCAL_FALLBACK_ENABLED = isDevelopmentRuntime
  && import.meta.env.VITE_ENABLE_LOCAL_COURSE_FALLBACK === 'true';
const LOCAL_CONTENT_PREFERRED = isDevelopmentRuntime
  && import.meta.env.VITE_COURSE_CONTENT_SOURCE === 'local';
const courseService = new CourseService();
const canonicalCourses = new CanonicalPublishedRepository({ contentType: 'COURSE' });

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('The course request was cancelled.', 'AbortError');
}

async function loadLocalJson(url, resourceName, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Unable to load ${resourceName} (${response.status}).`);
  return response.json();
}

async function loadLocalMetadata(signal) {
  const metadata = await loadLocalJson(LOCAL_METADATA_URL, 'course metadata', signal);
  return { ...metadata, provider: 'local-fallback' };
}

export async function loadCourseMetadata(signal, courseId, contentVersion = null) {
  throwIfAborted(signal);
  if (LOCAL_CONTENT_PREFERRED) return loadLocalMetadata(signal);
  if (!courseId) {
    if (LOCAL_FALLBACK_ENABLED) return loadLocalMetadata(signal);
    throw new Error('A course ID is required to load Firebase course metadata.');
  }

  try {
    const published = contentVersion == null ? await canonicalCourses.active(courseId) : await canonicalCourses.exact(courseId, contentVersion);
    const course = adaptCanonicalCourse(published.document);
    // Existing learners retain their pinned version; new visitors cannot start
    // the current active version while it is marked Coming Soon.
    if (contentVersion == null && course.comingSoon) {
      throw new CanonicalPublishedRepositoryError('content/course-coming-soon', 'This course is coming soon.');
    }
    return { defaultCourseId: courseId, courses: [{ id: courseId, version: published.document.version }], provider: 'canonical', canonicalCourse: course };
  } catch (error) {
    if (contentVersion != null || !['content/not-published', 'content/delivery-failed', 'content/catalog-failed'].includes(error?.code)) throw error;
  }

  try {
    const metadata = await courseService.getMetadata(courseId);
    throwIfAborted(signal);
    return { defaultCourseId: metadata.id, courses: [metadata], provider: 'firebase' };
  } catch (error) {
    if (!LOCAL_FALLBACK_ENABLED) throw error;
    console.warn('[CourseLoader] Firebase metadata unavailable; using the development-only local fallback.', error);
    return loadLocalMetadata(signal);
  }
}

async function loadLocalCourse(metadata, selectedId, signal) {
  const localMetadata = metadata.provider === 'local-fallback' ? metadata : await loadLocalMetadata(signal);
  const courseEntry = localMetadata.courses.find((course) => course.id === selectedId);
  if (!courseEntry) throw new Error(`Course "${selectedId}" is not listed in the local fallback metadata.`);
  return {
    course: await loadLocalJson(courseEntry.source, 'course', signal),
    courseEntry,
    provider: 'local-fallback',
  };
}

export async function loadCourseDocument(metadata, courseId, signal, initialLessonId) {
  const selectedId = courseId ?? metadata.defaultCourseId;
  throwIfAborted(signal);

  if (metadata.provider === 'local-fallback') return loadLocalCourse(metadata, selectedId, signal);
  if (metadata.provider === 'canonical') return { course: metadata.canonicalCourse, courseEntry: { id: selectedId, publishedVersion: metadata.canonicalCourse.publishedVersion, version: metadata.canonicalCourse.publishedVersion }, provider: 'canonical' };

  try {
    const { metadata: courseEntry, course, initialModuleNumber } = await courseService.getCourse(
      selectedId,
      { initialLessonId },
    );
    throwIfAborted(signal);
    return { course, courseEntry, initialModuleNumber, provider: 'firebase' };
  } catch (error) {
    if (!LOCAL_FALLBACK_ENABLED) throw error;
    console.warn('[CourseLoader] Firebase course content unavailable; using the development-only local fallback.', error);
    return loadLocalCourse(metadata, selectedId, signal);
  }
}

export function loadCourseModule(courseEntry, moduleNumber) {
  return courseService.getCourseModule(courseEntry, moduleNumber);
}

export function evictCourseModule(courseEntry, moduleNumber) {
  return courseService.evictCourseModule(courseEntry, moduleNumber);
}

export function resolveCourseLessonModuleNumber(lessonId, modulesOrCount) {
  return resolveLessonModuleNumber(lessonId, modulesOrCount);
}

export function invalidateFirebaseCourse(courseId, metadata) {
  courseService.invalidateCourse(courseId, metadata);
}
