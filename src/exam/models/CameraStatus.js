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
  } = {}) {
    this.permission = permission;
    this.connection = connection;
    this.streamActive = streamActive;
    this.resolution = resolution ? Object.freeze({ ...resolution }) : null;
    this.deviceId = deviceId;
    this.error = error;
    Object.freeze(this);
  }
}
