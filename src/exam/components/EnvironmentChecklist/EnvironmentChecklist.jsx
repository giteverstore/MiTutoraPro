import { CheckCircle2, CircleEllipsis, Clock3, XCircle } from 'lucide-react';
import { CAMERA_CONNECTION } from '../../models/CameraStatus';
import { FACE_STATUS } from '../../detectors/FaceDetector';
import { LIGHTING_STATUS } from '../../detectors/LightingDetector';
import { BACKGROUND_STATUS } from '../../detectors/BackgroundDetector';

function checklistItem(id, label, state, detail, pending = false) {
  return { id, label, state, detail, pending };
}

export function EnvironmentChecklist({ vision }) {
  const items = [
    checklistItem('camera', 'Camera', vision.camera.connection === CAMERA_CONNECTION.CONNECTED && vision.camera.streamActive, vision.camera.streamActive ? 'Connected' : 'Not connected'),
    checklistItem('face', 'Face', vision.face === FACE_STATUS.ONE_FACE, vision.face === FACE_STATUS.ONE_FACE ? 'One person' : vision.face === FACE_STATUS.MULTIPLE_FACES ? 'Multiple people detected' : vision.face === FACE_STATUS.NO_FACE ? 'No face detected' : 'Initializing'),
    checklistItem('lighting', 'Lighting', vision.lighting === LIGHTING_STATUS.GOOD, vision.lighting === LIGHTING_STATUS.GOOD ? 'Good' : vision.lighting === LIGHTING_STATUS.TOO_DARK ? 'Room is too dark' : vision.lighting === LIGHTING_STATUS.TOO_BRIGHT ? 'Room is too bright' : 'Analyzing'),
    checklistItem('background', 'Background', vision.background === BACKGROUND_STATUS.CLEAR, vision.background === BACKGROUND_STATUS.BLOCKED ? 'Environment blocked' : vision.background === BACKGROUND_STATUS.CLEAR ? 'Clear' : 'Checking'),
    checklistItem('browser', 'Browser', vision.browser.compatible && vision.browser.focused, vision.browser.focused ? 'Ready' : 'Return focus to this window'),
    checklistItem('fullscreen', 'Fullscreen', vision.browser.fullscreen, vision.browser.fullscreen ? 'Enabled' : 'Required'),
    checklistItem('microphone', 'Microphone', false, 'Coming soon', true),
  ];

  return (
    <section className="environment-checklist" aria-labelledby="environment-checklist-title">
      <div className="exam-card-heading"><span>Live checks</span><h2 id="environment-checklist-title">Environment checklist</h2></div>
      <ul>{items.map((item) => {
        const Icon = item.pending ? Clock3 : item.state ? CheckCircle2 : item.detail.includes('ing') ? CircleEllipsis : XCircle;
        return <li className={item.pending ? 'is-pending' : item.state ? 'is-ready' : 'is-blocked'} key={item.id}><Icon aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.detail}</small></span></li>;
      })}</ul>
    </section>
  );
}
