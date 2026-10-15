import { CanonicalPublishedRepository } from '../content/repositories/CanonicalPublishedRepository.js';

const publishedCourses = new CanonicalPublishedRepository({ contentType: 'COURSE' });

const titleCase = (value) => String(value ?? '').replace(/(^|[-_\s])\w/g, (match) => match.toUpperCase());
const duration = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
};

export function mapPublishedCourse(entry) {
  const metadata = entry.metadata ?? {};
  const neutral = metadata.language === 'none';
  const group = neutral ? (metadata.topic || 'Other topics') : titleCase(metadata.language || 'Programming');
  const comingSoon = entry.comingSoon === true;
  return {
    id: entry.contentId,
    title: metadata.title || entry.contentId,
    description: metadata.summary || '',
    level: metadata.difficulty || 'Beginner',
    duration: duration(metadata.estimatedMinutes),
    lessonCount: metadata.lessonCount ?? 0,
    comingSoon,
    available: !comingSoon,
    filter: group,
    kind: neutral ? 'domains' : 'languages',
    publishedVersion: entry.activeVersion,
  };
}

export async function loadActiveCourseCatalog(repository = publishedCourses) {
  const entries = await repository.list();
  return Promise.all(entries.map(async (entry) => {
    // Pointer metadata omits comingSoon, including for already-published versions.
    const { document } = await repository.exact(entry.contentId, entry.activeVersion);
    return mapPublishedCourse({ ...entry, comingSoon: document.content.comingSoon === true });
  }));
}

export async function loadPinnedCourseCatalog(progressRecords, repository = publishedCourses) {
  const records = progressRecords.filter((record) => Number.isSafeInteger(record.contentVersion) && (record.courseId ?? record.id));
  const resolved = await Promise.all(records.map(async (record) => {
    const contentId = record.courseId ?? record.id;
    try {
      const { document } = await repository.exact(contentId, record.contentVersion);
      const course = document.content;
      return mapPublishedCourse({ contentId, activeVersion: document.version, comingSoon: course.comingSoon === true, metadata: {
        title: course.title, summary: course.description, language: course.language,
        topic: course.language === 'none' ? course.tags?.[0] : undefined,
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
