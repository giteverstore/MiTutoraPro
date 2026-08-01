import { CourseService } from '../content/services/CourseService';

const LOCAL_METADATA_URL = '/courses/course-metadata.json';
const LOCAL_FALLBACK_ENABLED = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_LOCAL_COURSE_FALLBACK !== 'false';
const courseService = new CourseService();

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

export async function loadCourseMetadata(signal, courseId) {
  throwIfAborted(signal);
  if (!courseId) {
    if (LOCAL_FALLBACK_ENABLED) return loadLocalMetadata(signal);
    throw new Error('A course ID is required to load Firebase course metadata.');
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

export async function loadCourseDocument(metadata, courseId, signal) {
  const selectedId = courseId ?? metadata.defaultCourseId;
  throwIfAborted(signal);

  if (metadata.provider === 'local-fallback') return loadLocalCourse(metadata, selectedId, signal);

  try {
    const { metadata: courseEntry, course } = await courseService.getCourse(selectedId);
    throwIfAborted(signal);
    return { course, courseEntry, provider: 'firebase' };
  } catch (error) {
    if (!LOCAL_FALLBACK_ENABLED) throw error;
    console.warn('[CourseLoader] Firebase course content unavailable; using the development-only local fallback.', error);
    return loadLocalCourse(metadata, selectedId, signal);
  }
}

export function invalidateFirebaseCourse(courseId, metadata) {
  courseService.invalidateCourse(courseId, metadata);
}
