import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import './completion-celebration.css';

const CelebrationLottiePlayer = lazy(() => import('./CelebrationLottiePlayer.jsx'));
const FALLBACK_DURATION_MS = 6000;
const prefersReducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Decorative only. Completion state and its existing success message remain authoritative.
export function CompletionCelebration({ event, fallbackDuration = FALLBACK_DURATION_MS }) {
  const [visibleEvent, setVisibleEvent] = useState(null);
  const running = useRef(false);
  const fallbackTimer = useRef(null);
  useEffect(() => {
    if (!event || running.current || prefersReducedMotion()) return undefined;
    running.current = true;
    setVisibleEvent(event);
    fallbackTimer.current = window.setTimeout(() => {
      running.current = false;
      setVisibleEvent(null);
    }, fallbackDuration);
    return undefined;
  }, [event, fallbackDuration]);
  useEffect(() => () => window.clearTimeout(fallbackTimer.current), []);
  const finish = () => {
    window.clearTimeout(fallbackTimer.current);
    running.current = false;
    setVisibleEvent(null);
  };
  if (!visibleEvent) return null;
  return <div className="completion-celebration" aria-hidden="true"><Suspense fallback={null}><CelebrationLottiePlayer onComplete={finish} /></Suspense></div>;
}
