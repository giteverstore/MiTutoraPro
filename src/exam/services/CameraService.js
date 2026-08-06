export class CameraService {
  constructor({ mediaDevices = globalThis.navigator?.mediaDevices } = {}) {
    this.mediaDevices = mediaDevices;
    this.stream = null;
    this.constraints = null;
  }

  async requestPermission(constraints = {}) {
    if (!this.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not supported by this browser.');
    }
    this.constraints = {
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        ...constraints,
      },
    };
    this.stream = await this.mediaDevices.getUserMedia(this.constraints);
    return this.stream;
  }

  async open(constraints) {
    if (this.isActive()) return this.stream;
    return this.requestPermission(constraints);
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  async reconnect() {
    this.stop();
    return this.open(this.constraints?.video);
  }

  async enumerateDevices() {
    if (!this.mediaDevices?.enumerateDevices) return [];
    const devices = await this.mediaDevices.enumerateDevices();
    return devices.filter(({ kind }) => kind === 'videoinput');
  }

  async switchCamera(deviceId) {
    if (!deviceId) throw new TypeError('A camera device ID is required.');
    this.stop();
    return this.open({ deviceId: { exact: deviceId }, facingMode: undefined });
  }

  isActive() {
    return Boolean(this.stream?.getVideoTracks().some(({ readyState }) => readyState === 'live'));
  }

  destroy() {
    this.stop();
    this.mediaDevices = null;
  }
}
