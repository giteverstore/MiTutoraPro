import { useEffect, useRef } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { CAMERA_CONNECTION } from '../../models/CameraStatus';

export function CameraPreview({ camera, onAttach, onReconnect }) {
  const videoRef = useRef(null);
  useEffect(() => {
    onAttach(videoRef.current);
    return () => onAttach(null);
  }, [onAttach]);
  const connected = camera.connection === CAMERA_CONNECTION.CONNECTED && camera.streamActive;

  return (
    <section className={`camera-preview ${connected ? 'is-connected' : 'is-disconnected'}`} aria-label="Camera preview">
      <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
      {!connected ? <div className="camera-preview-empty">
        <CameraOff aria-hidden="true" />
        <strong>{camera.error ?? 'Connecting to your camera…'}</strong>
        <p>Your preview stays on this device and is not uploaded.</p>
        {camera.connection === CAMERA_CONNECTION.DISCONNECTED || camera.connection === CAMERA_CONNECTION.ERROR
          ? <button className="button button--secondary" type="button" onClick={onReconnect}><Camera /> Reconnect camera</button>
          : null}
      </div> : null}
      <div className="camera-preview-badge"><span /> {connected ? 'Camera connected' : 'Camera unavailable'}</div>
      {camera.resolution ? <small>{camera.resolution.width} × {camera.resolution.height}</small> : null}
      <p className="camera-preview-privacy">Your camera feed is processed locally for exam integrity monitoring. Video is not recorded or uploaded.</p>
    </section>
  );
}
