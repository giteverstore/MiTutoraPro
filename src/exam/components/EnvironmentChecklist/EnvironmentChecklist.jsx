import {
  Camera, CheckCircle2, CircleAlert, CircleEllipsis, Lightbulb,
  Maximize2, Mic, Monitor, ScanFace, PanelsTopLeft, Wifi,
} from 'lucide-react';
import { DETECTOR_SEVERITY } from '../../models/DetectorStatus';

const healthDefinitions = [
  ['camera', 'Camera', Camera],
  ['lighting', 'Lighting', Lightbulb],
  ['face', 'Face Detection', ScanFace],
  ['background', 'Background', PanelsTopLeft],
  ['browser', 'Browser', Monitor],
  ['fullscreen', 'Fullscreen', Maximize2],
  ['internet', 'Internet', Wifi],
  ['microphone', 'Microphone', Mic],
];

function StateIcon({ severity }) {
  if (severity === DETECTOR_SEVERITY.SUCCESS) return <CheckCircle2 aria-hidden="true" />;
  if (severity === DETECTOR_SEVERITY.PENDING || severity === DETECTOR_SEVERITY.INFO) return <CircleEllipsis aria-hidden="true" />;
  return <CircleAlert aria-hidden="true" />;
}

export function EnvironmentChecklist({ vision }) {
  return (
    <section className="environment-health" aria-labelledby="environment-checklist-title">
      <header className="environment-health-header">
        <div className="exam-card-heading"><span>Live system health</span><h2 id="environment-checklist-title">Environment health</h2><p>Checks update automatically as your environment changes.</p></div>
        <div className={`readiness-score ${vision.readinessScore >= vision.minimumReadinessScore ? 'is-ready' : ''}`} aria-label={`Readiness score ${vision.readinessScore} out of 100`}>
          <strong>{vision.readinessScore}%</strong><span>{vision.readinessScore >= vision.minimumReadinessScore ? 'Environment ready' : 'Improvement needed'}</span>
        </div>
      </header>
      <div className="environment-health-grid" aria-live="polite" aria-atomic="false">
        {healthDefinitions.map(([id, label, Icon]) => {
          const state = vision.health[id];
          return <article className={`environment-health-item is-${state.severity}`} key={id}>
            <div className="environment-health-icon"><Icon aria-hidden="true" /></div>
            <div><strong>{label}</strong><span>{state.status.replaceAll('_', ' ').toLowerCase()}</span><p>{state.message}</p></div>
            <StateIcon severity={state.severity} />
          </article>;
        })}
      </div>
      <div className="quality-indicators" aria-label="Live camera quality">
        {[['Lighting', vision.quality.lighting], ['Face stability', vision.quality.face], ['Camera stability', vision.quality.camera]].map(([label, quality]) => <div key={label}><span><strong>{label}</strong><em>{quality}%</em></span><div role="meter" aria-label={`${label} ${quality}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={quality}><span style={{ width: `${quality}%` }} /></div></div>)}
      </div>
    </section>
  );
}
