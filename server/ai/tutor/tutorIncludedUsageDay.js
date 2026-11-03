export const TUTOR_INCLUDED_USAGE_TIME_ZONE = 'Asia/Kolkata';

export function tutorIncludedUsageDateKey(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TUTOR_INCLUDED_USAGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function currentTutorIncludedUsage(value, now = Date.now()) {
  const dateKey = tutorIncludedUsageDateKey(now);
  if (value?.dateKey !== dateKey) return { dateKey, usedMessages: 0, reservedMessages: 0 };
  return {
    dateKey,
    usedMessages: Math.max(0, Number(value.usedMessages) || 0),
    reservedMessages: Math.max(0, Number(value.reservedMessages) || 0),
  };
}
