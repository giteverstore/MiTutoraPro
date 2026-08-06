import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../../models/ExamEvent';
import { CameraStatus, CAMERA_CONNECTION, CAMERA_PERMISSION } from '../../models/CameraStatus';
import { FACE_STATUS } from '../../detectors/FaceDetector';
import { LIGHTING_STATUS } from '../../detectors/LightingDetector';
import { BACKGROUND_STATUS } from '../../detectors/BackgroundDetector';

const simulations = [
  ['Tab Switch', EXAM_EVENT_TYPES.TAB_SWITCH, EXAM_SEVERITIES.HIGH],
  ['Fullscreen Exit', EXAM_EVENT_TYPES.FULLSCREEN_EXIT, EXAM_SEVERITIES.HIGH],
  ['Window Blur', EXAM_EVENT_TYPES.WINDOW_BLUR, EXAM_SEVERITIES.MEDIUM],
  ['Copy', EXAM_EVENT_TYPES.COPY, EXAM_SEVERITIES.MEDIUM],
  ['Paste', EXAM_EVENT_TYPES.PASTE, EXAM_SEVERITIES.MEDIUM],
  ['Right Click', EXAM_EVENT_TYPES.RIGHT_CLICK, EXAM_SEVERITIES.LOW],
  ['Warning', EXAM_EVENT_TYPES.WARNING, EXAM_SEVERITIES.MEDIUM],
];

const visionSimulations = [
  ['Face Lost', 'face', FACE_STATUS.NO_FACE],
  ['Multiple Faces', 'face', FACE_STATUS.MULTIPLE_FACES],
  ['Lighting Dark', 'lighting', LIGHTING_STATUS.TOO_DARK],
  ['Lighting Bright', 'lighting', LIGHTING_STATUS.TOO_BRIGHT],
  ['Camera Disconnect', 'camera', new CameraStatus({ permission: CAMERA_PERMISSION.GRANTED, connection: CAMERA_CONNECTION.DISCONNECTED, streamActive: false, error: 'Camera disconnected by simulator.' })],
  ['Background Blocked', 'background', BACKGROUND_STATUS.BLOCKED],
];

export function DeveloperSimulator({ onEmit, mode = 'exam' }) {
  if (!import.meta.env.DEV) return null;
  const controls = mode === 'vision' ? visionSimulations : simulations;
  return (
    <aside className="exam-simulator" aria-label="Developer event simulator">
      <strong>Developer simulator</strong>
      <div>{controls.map(([label, typeOrDetector, severityOrStatus]) => (
        <button type="button" onClick={() => onEmit(new ExamEvent({
          type: mode === 'vision' ? EXAM_EVENT_TYPES.CUSTOM : typeOrDetector,
          severity: mode === 'vision' ? EXAM_SEVERITIES.INFO : severityOrStatus,
          metadata: mode === 'vision'
            ? { source: 'developer-simulator', channel: 'vision', detector: typeOrDetector, status: severityOrStatus, simulated: true }
            : { source: 'developer-simulator', message: `${label} simulated.` },
        }))} key={label}>{label}</button>
      ))}</div>
      <button className="exam-simulator-reset" type="button" onClick={() => onEmit(new ExamEvent({
        type: EXAM_EVENT_TYPES.CUSTOM,
        severity: EXAM_SEVERITIES.INFO,
        metadata: { source: 'developer-simulator', action: 'DEVELOPER_RESET' },
      }))}>Reset</button>
    </aside>
  );
}
