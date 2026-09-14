import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CoinBalanceBadge } from '../coins/CoinBalanceBadge';
import { buildChallengeMonth, monthIdentity, monthLabel, shiftMonth } from './challengeCalendar';

const STATE_LABELS = { TODAY_INCOMPLETE: 'Daily Challenge available', TODAY_COMPLETED: 'Daily Challenge completed', PAST_COMPLETED: 'Daily Challenge completed', PAST_UNLOCKED: 'Daily Challenge unlocked for recovery', PAST_MISSED: 'Daily Challenge missed', FUTURE: 'future day', UNAVAILABLE: 'no challenge available', OUTSIDE_MONTH: 'outside current month' };

export function DailyChallengeCalendar({ today, challengeDates, completedDates, unlockedDates = [], supportedDate, historyStatus, catalogStatus, onOpenChallenge, onRedeem }) {
  const [month, setMonth] = useState(() => monthIdentity(new Date(`${today}T12:00:00+05:30`)));
  const days = useMemo(() => buildChallengeMonth({ month, today, challengeDates, completedDates, unlockedDates, supportedDate }), [month, today, challengeDates, completedDates, unlockedDates, supportedDate]);
  const formatter = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }), []);
  const loading = historyStatus === 'loading' || catalogStatus === 'loading';
  const error = historyStatus === 'error' || catalogStatus === 'error';
  return <aside className="challenge-calendar-card" aria-labelledby="challenge-calendar-title">
    <header className="challenge-calendar-header"><div><span>Daily Challenge</span><h2 id="challenge-calendar-title">{monthLabel(month)}</h2></div><div className="challenge-calendar-navigation">
      <button type="button" aria-label="Previous month" onClick={() => setMonth((current) => shiftMonth(current, -1))}><ChevronLeft /></button>
      <button type="button" aria-label="Next month" onClick={() => setMonth((current) => shiftMonth(current, 1))}><ChevronRight /></button>
    </div></header>
    {loading ? <div className="challenge-calendar-message" role="status">Loading challenge calendar…</div> : error ? <div className="challenge-calendar-message" role="status">Challenge calendar unavailable.</div> : <>
      <div className="challenge-calendar-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="challenge-calendar-grid" role="grid" aria-label={monthLabel(month)}>{days.map((day) => {
        const label = `${formatter.format(new Date(`${day.id}T00:00:00Z`))}, ${STATE_LABELS[day.state]}`;
        const completed = day.state === 'TODAY_COMPLETED' || day.state === 'PAST_COMPLETED';
        return <button type="button" role="gridcell" key={day.id} className={`challenge-calendar-day is-${day.state.toLowerCase().replaceAll('_', '-')}`} aria-label={label} aria-current={day.current ? 'date' : undefined} disabled={!day.clickable} onClick={day.clickable ? () => onOpenChallenge(day.id) : undefined}><span aria-hidden="true">{completed ? '✓' : day.day}</span></button>;
      })}</div>
    </>}
    {onRedeem ? <footer className="challenge-calendar-redeem"><CoinBalanceBadge /><button type="button" onClick={onRedeem}>Redeem <span aria-hidden="true">→</span></button></footer> : null}
  </aside>;
}
