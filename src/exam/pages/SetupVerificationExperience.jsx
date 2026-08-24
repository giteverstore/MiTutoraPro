import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { EventBus } from '../engine/EventBus';
import { createExamConfig } from '../engine/ExamConfig';
import { VisionManager } from '../vision/VisionManager';
import { EnvironmentCheck } from '../components/EnvironmentCheck/EnvironmentCheck';
import { VerificationSummary } from '../components/VerificationSummary/VerificationSummary';
import { VISION_VERIFICATION_STATUS } from '../models/VisionResult';
import { useSettings } from '../../settings/useSettings';
import { useApplicationTheme } from '../../theme/useApplicationTheme';

export function SetupVerificationExperience({ onExit }) {
  const settings = useSettings();
  const { theme } = useApplicationTheme();
  const config = useMemo(() => createExamConfig(), []);
  const eventBusRef = useRef(null);
  const managerRef = useRef(null);
  const destroyTimerRef = useRef(null);
  if (!eventBusRef.current) eventBusRef.current = new EventBus();
  if (!managerRef.current) managerRef.current = new VisionManager({ eventBus: eventBusRef.current, config });
  const [vision, setVision] = useState(managerRef.current.getSnapshot());
  const [manualReport, setManualReport] = useState(null);

  useEffect(() => managerRef.current.subscribe(setVision), []);
  useEffect(() => {
    if (destroyTimerRef.current) globalThis.clearTimeout(destroyTimerRef.current);
    managerRef.current.start();
    return () => managerRef.current.stop();
  }, []);
  useEffect(() => () => {
    destroyTimerRef.current = globalThis.setTimeout(() => {
      managerRef.current.destroy();
      eventBusRef.current.clear();
    }, 0);
  }, []);
  useEffect(() => {
    if (vision.status === VISION_VERIFICATION_STATUS.VERIFIED) managerRef.current.stop();
  }, [vision.status]);

  const attachVideo = useCallback((element) => managerRef.current.attachVideoElement(element), []);
  const reconnectCamera = useCallback(() => managerRef.current.reconnectCamera(), []);
  const emitEvent = useCallback((event) => eventBusRef.current.emit(event), []);

  return (
    <div className="exam-experience" data-theme={theme} data-reduced-motion={settings.appearance.reducedMotion}>
      <div className="exam-page exam-environment-page">
        <header className="exam-page-header"><button className="button button--ghost" type="button" onClick={onExit}>Back to certificates</button><div className="exam-brand"><ShieldCheck /><span>Test My Setup</span></div></header>
        <main className="exam-environment-main exam-vision-main">
          <div className="exam-intro"><span>Pre-exam system check</span><h1>Test your certification setup</h1><p>Verify your browser, camera, lighting, background, connectivity, and audio before booking or attempting a certification exam.</p></div>
          {vision.status === VISION_VERIFICATION_STATUS.VERIFIED || manualReport ? (
            <VerificationSummary summary={vision.summary ?? manualReport} title="Your setup is ready" action={<div className="setup-report-actions">{manualReport ? <button className="button button--secondary" type="button" onClick={() => { setManualReport(null); managerRef.current.reset(); managerRef.current.start(); }}>Test again</button> : null}<button className="button button--primary" type="button" onClick={onExit}>Done</button></div>} />
          ) : (
            <><EnvironmentCheck vision={vision} config={config} onAttachVideo={attachVideo} onReconnectCamera={reconnectCamera} onEmit={emitEvent} />{vision.remainingMs === 0 ? <button className="button button--secondary setup-view-report" type="button" onClick={() => { const report = managerRef.current.createReport(); managerRef.current.stop(); setManualReport(report); }}>View environment report</button> : null}</>
          )}
        </main>
      </div>
    </div>
  );
}
