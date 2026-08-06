import { Pause, ShieldCheck } from 'lucide-react';
import { VISION_VERIFICATION_STATUS } from '../../models/VisionResult';

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VerificationCountdown({ vision, durationMs, stabilityDurationMs }) {
  const progress = Math.min(100, (vision.elapsedMs / durationMs) * 100);
  const stableProgress = Math.min(100, (vision.consecutiveValidMs / stabilityDurationMs) * 100);
  const paused = vision.status === VISION_VERIFICATION_STATUS.PAUSED;
  return (
    <section className={`verification-countdown ${paused ? 'is-paused' : ''}`} aria-live="polite">
      <div className="verification-time"><span>{paused ? <Pause aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{paused ? 'Verification paused' : 'Verification in progress'}</span><strong>{formatDuration(vision.remainingMs)}</strong></div>
      <div className="verification-progress" role="progressbar" aria-label="Environment verification progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
      {paused ? <p>Resolve: {vision.pauseReasons.join(', ')}. The timer will resume automatically.</p> : <p>Stable environment: {Math.round(stableProgress)}% of the required final 30 seconds.</p>}
    </section>
  );
}
