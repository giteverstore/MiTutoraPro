import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../../models/ExamEvent';
import { CameraStatus, CAMERA_CONNECTION, CAMERA_PERMISSION } from '../../models/CameraStatus';
import { createFaceStatus, FACE_STATUS } from '../../detectors/FaceDetector';
import { createLightingStatus, LIGHTING_STATUS } from '../../detectors/LightingDetector';
import { createBackgroundStatus, BACKGROUND_STATUS } from '../../detectors/BackgroundDetector';
import { createAudioStatus, AUDIO_STATUS } from '../../detectors/AudioDetector';
import { MONITORING_VIOLATIONS } from '../../monitoring/MonitoringSession';

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
  ['Face Lost', 'face', createFaceStatus(FACE_STATUS.NO_FACE)],
  ['Multiple Faces', 'face', createFaceStatus(FACE_STATUS.MULTIPLE_FACES)],
  ['Lighting Dark', 'lighting', createLightingStatus(LIGHTING_STATUS.TOO_DARK)],
  ['Lighting Bright', 'lighting', createLightingStatus(LIGHTING_STATUS.TOO_BRIGHT)],
  ['Camera Disconnect', 'camera', new CameraStatus({ permission: CAMERA_PERMISSION.GRANTED, connection: CAMERA_CONNECTION.DISCONNECTED, streamActive: false, error: 'Camera disconnected by simulator.' })],
  ['Background Good', 'background', createBackgroundStatus(BACKGROUND_STATUS.GOOD)],
  ['Background Needs Attention', 'background', createBackgroundStatus(BACKGROUND_STATUS.NEEDS_ATTENTION)],
  ['Background Unable to Verify', 'background', createBackgroundStatus(BACKGROUND_STATUS.UNABLE_TO_VERIFY)],
  ['Audio Quiet', 'audio', createAudioStatus(AUDIO_STATUS.QUIET)],
  ['Audio Talking', 'audio', createAudioStatus(AUDIO_STATUS.TALKING)],
  ['Audio Noise', 'audio', createAudioStatus(AUDIO_STATUS.LOUD_NOISE)],
  ['Mic Muted', 'audio', createAudioStatus(AUDIO_STATUS.MUTED)],
  ['Mic Disconnected', 'audio', createAudioStatus(AUDIO_STATUS.DISCONNECTED)],
];

const monitoringSimulations = [
  ['Start Face Lost', 'START', MONITORING_VIOLATIONS.FACE_LOST],
  ['Recover Face', 'RECOVER', MONITORING_VIOLATIONS.FACE_LOST],
  ['Start Fullscreen Exit', 'START', MONITORING_VIOLATIONS.FULLSCREEN_EXIT],
  ['Recover Fullscreen', 'RECOVER', MONITORING_VIOLATIONS.FULLSCREEN_EXIT],
  ['Start Browser Blur', 'START', MONITORING_VIOLATIONS.WINDOW_BLUR],
  ['Recover Browser', 'RECOVER', MONITORING_VIOLATIONS.WINDOW_BLUR],
  ['Start Head Pose', 'START', MONITORING_VIOLATIONS.HEAD_POSE],
  ['Recover Head Pose', 'RECOVER', MONITORING_VIOLATIONS.HEAD_POSE],
  ['Start Looking Away', 'START', MONITORING_VIOLATIONS.LOOKING_AWAY],
  ['Recover Looking Away', 'RECOVER', MONITORING_VIOLATIONS.LOOKING_AWAY],
  ['Start Phone Detected', 'START', MONITORING_VIOLATIONS.PHONE_DETECTED],
  ['Recover Phone', 'RECOVER', MONITORING_VIOLATIONS.PHONE_DETECTED],
  ['Start Multiple Faces', 'START', MONITORING_VIOLATIONS.MULTIPLE_FACES],
  ['Recover Multiple Faces', 'RECOVER', MONITORING_VIOLATIONS.MULTIPLE_FACES],
  ['Start Talking', 'START', MONITORING_VIOLATIONS.VOICE_ACTIVITY],
  ['Recover Talking', 'RECOVER', MONITORING_VIOLATIONS.VOICE_ACTIVITY],
  ['Start Audio Noise', 'START', MONITORING_VIOLATIONS.LOUD_AMBIENT_NOISE],
  ['Recover Audio Noise', 'RECOVER', MONITORING_VIOLATIONS.LOUD_AMBIENT_NOISE],
];

export function DeveloperSimulator({ onEmit, mode = 'exam', vision }) {
  if (!import.meta.env.DEV) return null;
  const controls = mode === 'vision' ? visionSimulations : mode === 'monitoring' ? monitoringSimulations : simulations;
  return (
    <aside className="exam-simulator" aria-label="Developer event simulator">
      <strong>Developer simulator</strong>
      {mode === 'vision' && vision ? <dl className="exam-simulator-state">
        <div><dt>Verification</dt><dd>{vision.status}</dd></div>
        <div><dt>Readiness</dt><dd>{vision.readinessScore}%</dd></div>
        <div><dt>Remaining</dt><dd>{Math.ceil(vision.remainingMs / 1000)}s</dd></div>
      </dl> : null}
      {mode === 'vision' && vision ? <div className="exam-simulator-detectors">{Object.entries(vision.health).map(([id, state]) => <span key={id}>{id}: {state.status}</span>)}</div> : null}
      <div>{controls.map(([label, typeOrDetector, severityOrStatus]) => (
        <button type="button" onClick={() => onEmit(new ExamEvent({
          type: mode === 'vision' || mode === 'monitoring' ? EXAM_EVENT_TYPES.CUSTOM : typeOrDetector,
          severity: mode === 'vision' || mode === 'monitoring' ? EXAM_SEVERITIES.INFO : severityOrStatus,
          metadata: mode === 'vision'
            ? { source: 'developer-simulator', channel: 'vision', detector: typeOrDetector, status: severityOrStatus, simulated: true }
            : mode === 'monitoring'
              ? { source: 'developer-simulator', monitoringAction: typeOrDetector, violationType: severityOrStatus }
            : { source: 'developer-simulator', message: `${label} simulated.` },
        }))} aria-pressed={mode === 'vision' && vision?.health[typeOrDetector]?.status === severityOrStatus?.status} key={label}>{label}</button>
      ))}</div>
      <button className="exam-simulator-reset" type="button" onClick={() => onEmit(new ExamEvent({
        type: EXAM_EVENT_TYPES.CUSTOM,
        severity: EXAM_SEVERITIES.INFO,
        metadata: { source: 'developer-simulator', action: 'DEVELOPER_RESET' },
      }))}>{mode === 'monitoring' ? 'Reset Integrity' : 'Reset'}</button>
    </aside>
  );
}
