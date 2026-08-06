export class AudioDiagnostics {
  constructor(data = {}) {
    Object.assign(this, {
      browser: 'Unknown', sampleRate: null, channelCount: null, deviceLabel: '', deviceId: '',
      audioContextState: 'uninitialized', vadLoaded: false, onnxLoaded: false, modelVersion: null,
      modelChecksum: null, latency: null, bufferSize: null, initializationDuration: null,
      lastInference: null, lastRecovery: null, recoveryAttempts: 0,
    }, data);
    Object.freeze(this);
  }
}

