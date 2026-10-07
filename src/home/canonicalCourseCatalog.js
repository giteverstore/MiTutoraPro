import { CanonicalPublishedRepository } from '../content/repositories/CanonicalPublishedRepository.js';

const publishedCourses = new CanonicalPublishedRepository({ contentType: 'COURSE' });

const titleCase = (value) => String(value ?? '').replace(/(^|[-_\s])\w/g, (match) => match.toUpperCase());
const duration = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
};

export function mapPublishedCourse(entry) {
  const metadata = entry.metadata ?? {};
  const language = titleCase(metadata.language || 'Programming');
  return {
    id: entry.contentId,
    title: metadata.title || entry.contentId,
    description: metadata.summary || '',
    level: metadata.difficulty || 'Beginner',
    duration: duration(metadata.estimatedMinutes),
    lessonCount: metadata.lessonCount ?? 0,
    available: true,
    filter: language,
    kind: 'languages',
    publishedVersion: entry.activeVersion,
  };
}

export async function loadActiveCourseCatalog(repository = publishedCourses) {
  return (await repository.list()).map(mapPublishedCourse);
}

export async function loadPinnedCourseCatalog(progressRecords, repository = publishedCourses) {
  const records = progressRecords.filter((record) => Number.isSafeInteger(record.contentVersion) && (record.courseId ?? record.id));
  const resolved = await Promise.all(records.map(async (record) => {
    const contentId = record.courseId ?? record.id;
    try {
      const { document } = await repository.exact(contentId, record.contentVersion);
      const course = document.content;
      return mapPublishedCourse({ contentId, activeVersion: document.version, metadata: {
        title: course.title, summary: course.description, language: course.language,
        difficulty: course.difficulty, estimatedMinutes: course.estimatedMinutes,
        lessonCount: course.modules.flatMap((module) => module.sections?.flatMap((section) => section.lessons) ?? module.lessons ?? []).length,
      } });
    } catch { return null; }
  }));
  return resolved.filter(Boolean);
}

export function mergeCourseCatalog(legacy, published) {
  const activeIds = new Set(published.map((course) => course.id));
  return [...legacy.filter((course) => !activeIds.has(course.id)), ...published];
}
