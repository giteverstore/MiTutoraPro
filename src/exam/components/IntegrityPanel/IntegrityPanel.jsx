import { useEffect, useRef } from 'react';
import { Activity, Clock3, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useExam } from '../../hooks/useExam';
import { useIntegrityMonitor } from '../../hooks/useIntegrityMonitor';
import { ActiveViolations } from '../ActiveViolations/ActiveViolations';
import { TimelinePanel } from '../TimelinePanel/TimelinePanel';
import { DeveloperCalibrationPanel } from '../DeveloperCalibrationPanel/DeveloperCalibrationPanel';

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function IntegrityPanel() {
  const monitor = useIntegrityMonitor();
  const { attachVerificationVideo, reconnectCamera, vision, emitEvent } = useExam();
  const videoRef = useRef(null);
  useEffect(() => {
    attachVerificationVideo(videoRef.current);
    return () => attachVerificationVideo(null);
  }, [attachVerificationVideo]);
  const connected = vision.camera.streamActive;
  const cameraPreview = <aside className={`exam-camera-preview ${connected ? 'is-connected' : 'is-disconnected'}`} aria-label="Live camera preview">
    <video className="monitoring-camera-feed" ref={videoRef} muted playsInline aria-label="Your live camera preview" />
    <div className="exam-camera-status"><span />{connected ? 'Camera active' : vision.camera.connection === 'CONNECTING' ? 'Reconnecting…' : 'Camera disconnected'}</div>
    {!connected ? <button className="button button--secondary" type="button" onClick={reconnectCamera}>Reconnect</button> : null}
    <p>Your camera is processed locally. Video is not recorded or uploaded.</p>
  </aside>;
  if (!import.meta.env.DEV) return cameraPreview;
  return <aside className="integrity-monitor-panel" aria-label="Development integrity monitor">
    {cameraPreview}
    <header><div><Activity /><span><strong>Integrity monitor</strong><small>{monitor.status}</small></span></div><span className="monitor-live-indicator">Live</span></header>
    <div className="monitor-metrics"><article><ShieldCheck /><span>Integrity<strong>{monitor.score}</strong></span></article><article><TriangleAlert /><span>Warnings<strong>{monitor.warningCount}</strong></span></article><article><Clock3 /><span>Monitoring<strong>{formatTime(monitor.monitoringTimeMs)}</strong></span></article></div>
    <section className="monitor-section"><h3>Detector status</h3><div className="monitor-detector-grid">{Object.entries(monitor.detectorStatus).map(([id, status]) => <span key={id}><strong>{id}</strong>{status.status}</span>)}</div></section>
    <ActiveViolations violations={monitor.activeViolations} />
    <TimelinePanel timeline={monitor.timeline} />
    <DeveloperCalibrationPanel vision={vision} onTune={(values) => emitEvent({ type: 'CUSTOM', metadata: { action: 'AUDIO_CALIBRATION', values } })} />
  </aside>;
}
