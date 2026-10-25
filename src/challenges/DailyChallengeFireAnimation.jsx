import { lazy, Suspense } from 'react';
import { Flame } from 'lucide-react';

const DailyChallengeFirePlayer = lazy(() => import('./DailyChallengeFirePlayer.jsx'));
const prefersReducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function DailyChallengeFireAnimation() {
  const reducedMotion = prefersReducedMotion();
  return <div className="challenge-completion-fire" aria-hidden="true">
    {reducedMotion
      ? <Flame className="challenge-completion-fire-fallback" fill="currentColor" />
      : <Suspense fallback={<Flame className="challenge-completion-fire-fallback" fill="currentColor" />}><DailyChallengeFirePlayer /></Suspense>}
  </div>;
}
