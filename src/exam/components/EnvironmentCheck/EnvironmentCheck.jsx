import { useCallback, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { CameraPreview } from '../CameraPreview/CameraPreview';
import { EnvironmentChecklist } from '../EnvironmentChecklist/EnvironmentChecklist';
import { VerificationCountdown } from '../VerificationCountdown/VerificationCountdown';
import { DeveloperSimulator } from '../DeveloperSimulator/DeveloperSimulator';

export function EnvironmentCheck({ vision, config, onAttachVideo, onReconnectCamera, onEmit }) {
  const [fullscreenError, setFullscreenError] = useState('');
  const attachVideo = useCallback((element) => onAttachVideo(element), [onAttachVideo]);
  const enableFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFullscreenError('Fullscreen could not be started. Allow fullscreen access and try again.');
    }
  };

  return (
    <section className="vision-verification" aria-labelledby="environment-check-title">
      <div className="vision-preview-column">
        <div className="exam-card-heading"><span>System readiness</span><h2 id="environment-check-title">Verify your exam environment</h2><p>Remain visible in a well-lit, focused, fullscreen environment while the verification completes.</p></div>
        <CameraPreview camera={vision.camera} onAttach={attachVideo} onReconnect={onReconnectCamera} />
        {!vision.browser.fullscreen && config.browser.fullscreenRequired ? <button className="button button--secondary vision-fullscreen-button" type="button" onClick={enableFullscreen}><Maximize2 /> Enable fullscreen</button> : null}
        {fullscreenError ? <p className="exam-check-error" role="alert">{fullscreenError}</p> : null}
        <VerificationCountdown vision={vision} durationMs={config.vision.verificationDurationMs} stabilityDurationMs={config.vision.stabilityDurationMs} />
      </div>
      <EnvironmentChecklist vision={vision} />
      {import.meta.env.DEV ? <DeveloperSimulator mode="vision" vision={vision} onEmit={onEmit} /> : null}
    </section>
  );
}
