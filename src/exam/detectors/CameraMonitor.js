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
    this.runId = 0;
    this.permissionGranted = false;
  }

  async start() {
    if (this.status.streamActive) return this.status;
    if (this.startPromise) {
      await this.startPromise;
      return this.status.streamActive ? this.status : this.start();
    }
    const runId = ++this.runId;
    this.startPromise = this.connect(runId);
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async connect(runId) {
    this.publish({ permission: CAMERA_PERMISSION.REQUESTING, connection: CAMERA_CONNECTION.CONNECTING });
    try {
      const stream = await this.cameraService.open();
      if (runId !== this.runId) {
        stream.getTracks().forEach((track) => track.stop());
        if (this.cameraService.stream === stream) this.cameraService.stream = null;
        return this.status;
      }
      this.attachTrack(stream.getVideoTracks()[0]);
      const settings = this.track?.getSettings?.() ?? {};
      this.permissionGranted = true;
      return this.publish({
        permission: CAMERA_PERMISSION.GRANTED,
        connection: CAMERA_CONNECTION.CONNECTED,
        streamActive: true,
        resolution: settings.width && settings.height ? { width: settings.width, height: settings.height } : null,
        deviceId: settings.deviceId ?? null,
      });
    } catch (error) {
      if (runId !== this.runId) return this.status;
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      if (denied) this.permissionGranted = false;
      return this.publish({
        permission: denied ? CAMERA_PERMISSION.DENIED : this.permissionGranted ? CAMERA_PERMISSION.GRANTED : CAMERA_PERMISSION.UNKNOWN,
        connection: denied ? CAMERA_CONNECTION.ERROR : CAMERA_CONNECTION.DISCONNECTED,
        error: denied
          ? 'Camera permission denied. Grant camera access in browser settings and retry.'
          : 'Camera unavailable. Check the connection and retry.',
      });
    }
  }

  stop() {
    this.runId += 1;
    this.detachTrack();
    this.cameraService.stop();
    this.publish({
      permission: this.status.permission,
      connection: CAMERA_CONNECTION.IDLE,
      streamActive: false,
    });
  }

  pause() {
    this.detachTrack();
  }

  resume() {
    if (this.cameraService.stream) this.attachTrack(this.cameraService.stream.getVideoTracks()[0]);
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
        error: 'Camera disconnected. Reconnect it to resume verification.',
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
