import { CameraStatus, CAMERA_CONNECTION, CAMERA_PERMISSION } from '../models/CameraStatus.js';
import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';

export class CameraMonitor {
  constructor({ cameraService, eventBus }) {
    this.cameraService = cameraService;
    this.eventBus = eventBus;
    this.status = new CameraStatus();
    this.track = null;
    this.trackHandlers = null;
    this.startPromise = null;
  }

  async start() {
    if (this.status.streamActive) return this.status;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.connect();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async connect() {
    this.publish({ permission: CAMERA_PERMISSION.REQUESTING, connection: CAMERA_CONNECTION.CONNECTING });
    try {
      const stream = await this.cameraService.open();
      this.attachTrack(stream.getVideoTracks()[0]);
      const settings = this.track?.getSettings?.() ?? {};
      return this.publish({
        permission: CAMERA_PERMISSION.GRANTED,
        connection: CAMERA_CONNECTION.CONNECTED,
        streamActive: true,
        resolution: settings.width && settings.height ? { width: settings.width, height: settings.height } : null,
        deviceId: settings.deviceId ?? null,
      });
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      return this.publish({
        permission: denied ? CAMERA_PERMISSION.DENIED : CAMERA_PERMISSION.UNKNOWN,
        connection: denied ? CAMERA_CONNECTION.ERROR : CAMERA_CONNECTION.DISCONNECTED,
        error: denied ? 'Camera permission was denied.' : 'The camera could not be connected.',
      });
    }
  }

  stop() {
    this.detachTrack();
    this.cameraService.stop();
    this.publish({
      permission: this.status.permission,
      connection: CAMERA_CONNECTION.IDLE,
      streamActive: false,
    });
  }

  reset() {
    this.detachTrack();
    this.status = new CameraStatus();
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.stop();
    this.cameraService.destroy();
  }

  attachTrack(track) {
    this.detachTrack();
    this.track = track;
    if (!track) return;
    this.trackHandlers = {
      ended: () => this.publish({
        permission: this.status.permission,
        connection: CAMERA_CONNECTION.DISCONNECTED,
        streamActive: false,
        error: 'The camera was disconnected.',
      }),
      mute: () => this.publish({ ...this.status, streamActive: false }),
      unmute: () => this.publish({
        ...this.status,
        connection: CAMERA_CONNECTION.CONNECTED,
        streamActive: true,
        error: null,
      }),
    };
    Object.entries(this.trackHandlers).forEach(([type, handler]) => track.addEventListener(type, handler));
  }

  detachTrack() {
    if (this.track && this.trackHandlers) {
      Object.entries(this.trackHandlers).forEach(([type, handler]) => this.track.removeEventListener(type, handler));
    }
    this.track = null;
    this.trackHandlers = null;
  }

  publish(next) {
    this.status = new CameraStatus(next);
    this.eventBus.emit(new ExamEvent({
      type: EXAM_EVENT_TYPES.CUSTOM,
      severity: this.status.streamActive ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW,
      metadata: { channel: 'vision', detector: 'camera', status: this.status },
    }));
    return this.status;
  }
}
