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
  const comingSoon = entry.comingSoon === true || metadata.comingSoon === true || metadata.status === 'coming-soon';
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
  return entries.map(mapPublishedCourse);
}

export async function loadPinnedCourseCatalog(progressRecords, repository = publishedCourses, catalogEntries = null) {
  const records = progressRecords.filter((record) => Number.isSafeInteger(record.contentVersion) && (record.courseId ?? record.id));
  const entries = catalogEntries ?? await repository.list();
  const summaries = new Map(entries.map((entry) => {
    const course = entry.contentId ? mapPublishedCourse(entry) : entry;
    return [course.id, course];
  }));
  const resolved = await Promise.all(records.map(async (record) => {
    const contentId = record.courseId ?? record.id;
    const summary = summaries.get(contentId);
    if (summary?.publishedVersion === record.contentVersion) return summary;
    try {
      const exact = await repository.exactSummary(contentId, record.contentVersion);
      return mapPublishedCourse({ contentId, activeVersion: exact.version, metadata: exact.metadata });
    } catch { /* Preserve the pinned route with bounded progress metadata when its summary is unavailable. */ }
    return mapPublishedCourse({
      contentId,
      activeVersion: record.contentVersion,
      metadata: {
        title: record.courseTitle ?? record.title ?? contentId,
        summary: record.courseDescription ?? record.description ?? '',
        language: record.language,
        difficulty: record.difficulty,
        estimatedMinutes: record.estimatedMinutes,
        lessonCount: record.lessonCount,
      },
    });
  }));
  return resolved;
}

export function mergeCourseCatalog(legacy, published) {
  const activeIds = new Set(published.map((course) => course.id));
  return [...legacy.filter((course) => !activeIds.has(course.id)), ...published];
}
