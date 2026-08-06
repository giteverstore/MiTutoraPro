import { useEffect, useRef } from 'react';
import { Activity, Clock3, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useExam } from '../../hooks/useExam';
import { useIntegrityMonitor } from '../../hooks/useIntegrityMonitor';
import { ActiveViolations } from '../ActiveViolations/ActiveViolations';
import { TimelinePanel } from '../TimelinePanel/TimelinePanel';

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function IntegrityPanel() {
  const monitor = useIntegrityMonitor();
  const { attachVerificationVideo } = useExam();
  const videoRef = useRef(null);
  useEffect(() => {
    attachVerificationVideo(videoRef.current);
    return () => attachVerificationVideo(null);
  }, [attachVerificationVideo]);
  if (!import.meta.env.DEV) return <video className="monitoring-camera-feed" ref={videoRef} muted playsInline aria-hidden="true" />;
  return <aside className="integrity-monitor-panel" aria-label="Development integrity monitor">
    <video className="monitoring-camera-feed" ref={videoRef} muted playsInline aria-hidden="true" />
    <header><div><Activity /><span><strong>Integrity monitor</strong><small>{monitor.status}</small></span></div><span className="monitor-live-indicator">Live</span></header>
    <div className="monitor-metrics"><article><ShieldCheck /><span>Integrity<strong>{monitor.score}</strong></span></article><article><TriangleAlert /><span>Warnings<strong>{monitor.warningCount}</strong></span></article><article><Clock3 /><span>Monitoring<strong>{formatTime(monitor.monitoringTimeMs)}</strong></span></article></div>
    <section className="monitor-section"><h3>Detector status</h3><div className="monitor-detector-grid">{Object.entries(monitor.detectorStatus).map(([id, status]) => <span key={id}><strong>{id}</strong>{status.status}</span>)}</div></section>
    <ActiveViolations violations={monitor.activeViolations} />
    <TimelinePanel timeline={monitor.timeline} />
  </aside>;
}
