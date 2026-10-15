import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import './completion-celebration.css';

// A visual acknowledgement only. The verified completion state remains the source of truth.
export function CompletionCelebration({ event, duration = 1800, inline = false }) {
  const [visibleEvent, setVisibleEvent] = useState(null);
  useEffect(() => {
    if (!event) return undefined;
    setVisibleEvent(event);
    const timer = window.setTimeout(() => setVisibleEvent((current) => current === event ? null : current), duration);
    return () => window.clearTimeout(timer);
  }, [event, duration]);
  if (!visibleEvent) return null;
  return <div className={`completion-celebration is-${visibleEvent.variant ?? 'default'}${inline ? ' is-inline' : ''}`} role="status" aria-live="polite">
    <span className="completion-celebration__art" aria-hidden="true"><Sparkles /><CheckCircle2 /><Sparkles /></span>
    <span>{visibleEvent.message}</span>
  </div>;
}
