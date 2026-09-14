export const CHALLENGE_TIMEZONE = 'Asia/Kolkata';

export function kolkataDate(value = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: CHALLENGE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value).filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function monthIdentity(value = new Date()) { return kolkataDate(value).slice(0, 7); }

export function shiftMonth(month, amount) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function buildChallengeMonth({ month, today, challengeDates = [], completedDates = [], unlockedDates = [] }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - first.getUTCDay());
  const available = new Set(challengeDates);
  const completed = new Set(completedDates);
  const unlocked = new Set(unlockedDates);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const id = date.toISOString().slice(0, 10);
    const inMonth = id.slice(0, 7) === month;
    let state = 'UNAVAILABLE';
    if (!inMonth) state = 'OUTSIDE_MONTH';
    else if (id > today) state = 'FUTURE';
    else if (id === today && completed.has(id)) state = 'TODAY_COMPLETED';
    else if (id === today && available.has(id)) state = 'TODAY_INCOMPLETE';
    else if (completed.has(id)) state = 'PAST_COMPLETED';
    else if (id < today && unlocked.has(id)) state = 'PAST_UNLOCKED';
    else if (id < today && available.has(id)) state = 'PAST_MISSED';
    const clickable = (id === today && available.has(id)) || (id < today && (completed.has(id) || unlocked.has(id)));
    return { id, day: date.getUTCDate(), state, current: id === today, clickable: inMonth && clickable };
  });
}

export function dailyChallengeCompletionDates(completions) {
  return [...new Set((completions ?? []).filter((item) => item.activityType === 'DAILY_CHALLENGE'
    && item.completionStatus === 'COMPLETED' && /^\d{4}-\d{2}-\d{2}$/.test(item.occurrenceDate ?? ''))
    .map((item) => item.occurrenceDate))];
}

export function hasCompletedDailyChallenge(completions, date) {
  return dailyChallengeCompletionDates(completions).includes(date);
}
