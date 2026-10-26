const MAX_LANGUAGES = 16;
const MAX_SKILLS = 12;

const text = (value, fallback = '') => typeof value === 'string' ? value.slice(0, 500) : fallback;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const stringList = (values, limit) => [...new Set((Array.isArray(values) ? values : [])
  .filter((value) => typeof value === 'string' && value.length <= 80))].slice(0, limit);
const safeArtwork = (value) => typeof value === 'string' && /^\/assets\/[a-z0-9/_.-]+$/i.test(value) ? value : null;

export function projectCatalogSummary(document) {
  const content = document.content;
  const supportedLanguages = stringList(content.supportedLanguages, MAX_LANGUAGES);
  return Object.freeze({
    summaryVersion: 1, title: text(content.title), summary: text(content.summary ?? content.description),
    supportedLanguages, language: supportedLanguages[0] ?? '', category: text(content.category),
    difficulty: text(content.difficulty), estimatedMinutes: Math.max(0, Number(content.estimatedMinutes) || 0),
    artwork: safeArtwork(document.metadata?.migration?.artwork ?? content.artwork),
    comingSoon: content.comingSoon === true, available: content.comingSoon !== true,
    skills: stringList(content.tags, MAX_SKILLS), checkpointCount: count(content.checkpoints?.length),
  });
}

export function courseCatalogSummary(document) {
  const content = document.content;
  const lessonCount = content.modules.reduce((total, module) => total
    + (module.sections?.reduce((sum, section) => sum + section.lessons.length, 0) ?? module.lessons?.length ?? 0), 0);
  const comingSoon = content.comingSoon === true;
  return Object.freeze({
    summaryVersion: 1, title: text(content.title), summary: text(content.summary ?? content.description),
    language: text(content.language), topic: text(content.topic ?? (content.language === 'none' ? content.tags?.[0] : '')),
    difficulty: text(content.difficulty), estimatedMinutes: Math.max(0, Number(content.estimatedMinutes) || 0),
    lessonCount, moduleCount: content.modules.length, comingSoon, available: !comingSoon,
  });
}

export function publicContentSummary(document) {
  if (document.contentType === 'PROJECT') return projectCatalogSummary(document);
  if (document.contentType === 'COURSE') return courseCatalogSummary(document);
  const content = document.content;
  return Object.freeze({
    summaryVersion: 1, title: text(content.title), summary: text(content.summary ?? content.description),
    language: text(content.language), difficulty: text(content.difficulty), topic: text(content.topic),
    category: text(content.category), estimatedMinutes: Math.max(0, Number(content.estimatedMinutes) || 0),
    xp: Math.max(0, Number(content.xp) || 0),
  });
}
