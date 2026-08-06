export const CAMERA_PERMISSION = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  REQUESTING: 'REQUESTING',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
});

export const CAMERA_CONNECTION = Object.freeze({
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
});

export class CameraStatus {
  constructor({
    permission = CAMERA_PERMISSION.UNKNOWN,
    connection = CAMERA_CONNECTION.IDLE,
    streamActive = false,
    resolution = null,
    deviceId = null,
    error = null,
    status = connection,
    lastUpdated = Date.now(),
    message,
    severity,
    quality,
  } = {}) {
    const connected = connection === CAMERA_CONNECTION.CONNECTED && streamActive;
    this.permission = permission;
    this.connection = connection;
    this.streamActive = streamActive;
    this.resolution = resolution ? Object.freeze({ ...resolution }) : null;
    this.deviceId = deviceId;
    this.error = error;
    this.status = status;
    this.lastUpdated = lastUpdated;
    this.message = message ?? (connected ? 'Camera connected and streaming.' : error ?? 'Waiting for camera connection.');
    this.severity = severity ?? (connected ? DETECTOR_SEVERITY.SUCCESS : error ? DETECTOR_SEVERITY.ERROR : DETECTOR_SEVERITY.PENDING);
    this.quality = Math.max(0, Math.min(100, Math.round(quality ?? (connected ? 100 : 0))));
    Object.freeze(this);
  }
}
import { DETECTOR_SEVERITY } from './DetectorStatus.js';
