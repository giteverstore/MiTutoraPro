const METADATA_URL = '/courses/course-metadata.json';

async function loadLocalJson(url, resourceName, signal) {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Unable to load ${resourceName} (${response.status}).`);
  }

  return response.json();
}

export async function loadCourseMetadata(signal) {
  return loadLocalJson(METADATA_URL, 'course metadata', signal);
}

export async function loadCourseDocument(metadata, courseId, signal) {
  const selectedId = courseId ?? metadata.defaultCourseId;
  const courseEntry = metadata.courses.find((course) => course.id === selectedId);

  if (!courseEntry) {
    throw new Error(`Course "${selectedId}" is not listed in the local metadata.`);
  }

  const course = await loadLocalJson(courseEntry.source, 'course', signal);
  return { course, courseEntry };
}
