import { AudioDiagnostics } from '../models/AudioDiagnostics.js';

export const AUDIO_PIPELINE_STATE = Object.freeze({ UNINITIALIZED: 'UNINITIALIZED', REQUESTING_PERMISSION: 'REQUESTING_PERMISSION', PERMISSION_DENIED: 'PERMISSION_DENIED', INITIALIZING_AUDIO_CONTEXT: 'INITIALIZING_AUDIO_CONTEXT', INITIALIZING_VAD: 'INITIALIZING_VAD', READY: 'READY', FAILED: 'FAILED', RECOVERING: 'RECOVERING' });

function browserName(userAgent = '') { if (/Firefox/i.test(userAgent)) return 'Firefox'; if (/Edg/i.test(userAgent)) return 'Edge'; if (/Brave/i.test(userAgent)) return 'Brave'; if (/Chrome/i.test(userAgent)) return 'Chrome'; return 'Unsupported'; }
function actionableError(error) {
  if (['NotAllowedError', 'PermissionDeniedError'].includes(error?.name)) return { code: 'PERMISSION_DENIED', message: 'Microphone permission denied. Grant microphone access.' };
  if (['NotFoundError', 'DevicesNotFoundError'].includes(error?.name)) return { code: 'NO_MICROPHONE', message: 'No microphone found. Connect a microphone.' };
  if (error?.code) return error;
  return { code: 'AUDIO_INITIALIZATION_FAILED', message: error?.message ?? 'Audio initialization failed. Retry the setup check.' };
}

export class AudioService {
  constructor({ mediaDevices = globalThis.navigator?.mediaDevices, permissions = globalThis.navigator?.permissions, userAgent = globalThis.navigator?.userAgent, documentObject = globalThis.document, AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext, scheduler = globalThis, clock = () => Date.now(), development = Boolean(import.meta.env?.DEV) }) {
    this.mediaDevices = mediaDevices; this.permissions = permissions; this.document = documentObject; this.AudioContextClass = AudioContextClass; this.scheduler = scheduler; this.clock = clock; this.development = development;
    this.stream = null; this.context = null; this.analyser = null; this.source = null; this.processor = null; this.silentGain = null; this.openPromise = null; this.frameListeners = new Set(); this.healthListeners = new Set(); this.healthTimer = null; this.config = null; this.active = false; this.recoveryPromise = null;
    this.diagnostics = { browser: browserName(userAgent) }; this.boundDeviceChange = () => this.recover('Microphone devices changed.'); this.boundVisibility = () => { if (!this.document?.hidden) this.ensureContextRunning(); };
  }
  subscribeHealth(listener) { this.healthListeners.add(listener); return () => this.healthListeners.delete(listener); }
  notify(type, data = {}) { const payload = Object.freeze({ type, ...data, diagnostics: this.getDiagnostics() }); this.healthListeners.forEach((listener) => listener(payload)); }
  async open(config) { this.config = config; this.active = true; if (this.isHealthy()) return this.getSession(); if (this.openPromise) return this.openPromise; this.openPromise = this.withRetry(() => this.create(), 'microphone'); try { const session = await this.openPromise; this.attachMonitoring(); return session; } finally { this.openPromise = null; } }
  async create() {
    if (!this.mediaDevices?.getUserMedia || !this.AudioContextClass) throw { code: 'BROWSER_UNSUPPORTED', message: 'Browser unsupported. Use Chrome, Edge, Brave, or Firefox.' };
    const startedAt = this.clock(); this.notify('REQUESTING_PERMISSION');
    try { await this.permissions?.query?.({ name: 'microphone' }); } catch { /* Permissions API is optional. */ }
    let stream;
    try { stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (error) { const friendly = actionableError(error); this.notify(friendly.code === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'FAILED', { error: friendly }); throw friendly; }
    this.notify('INITIALIZING_AUDIO_CONTEXT');
    try {
      await this.closeResources(); this.stream = stream; this.context = new this.AudioContextClass();
      if (this.context.state === 'suspended') await this.context.resume();
      this.analyser = this.context.createAnalyser(); this.analyser.fftSize = this.config.fftSize; this.analyser.smoothingTimeConstant = this.config.analyserSmoothing;
      this.source = this.context.createMediaStreamSource(this.stream); this.source.connect(this.analyser);
      this.processor = this.context.createScriptProcessor(this.config.bufferSize, 1, 1); this.silentGain = this.context.createGain(); this.silentGain.gain.value = 0;
      this.processor.onaudioprocess = (event) => { const frame = new Float32Array(event.inputBuffer.getChannelData(0)); this.frameListeners.forEach((listener) => listener(frame, this.context.sampleRate)); };
      this.source.connect(this.processor); this.processor.connect(this.silentGain); this.silentGain.connect(this.context.destination);
      const track = stream.getAudioTracks()[0]; const settings = track?.getSettings?.() ?? {};
      this.diagnostics = { ...this.diagnostics, sampleRate: this.context.sampleRate, channelCount: settings.channelCount ?? 1, deviceLabel: track?.label ?? '', deviceId: settings.deviceId ?? '', audioContextState: this.context.state, bufferSize: this.config.bufferSize, initializationDuration: this.clock() - startedAt };
      this.context.onstatechange = () => { this.diagnostics.audioContextState = this.context?.state ?? 'closed'; if (this.context?.state === 'suspended') this.ensureContextRunning(); if (this.context?.state === 'closed' && this.active) this.recover('AudioContext closed.'); };
      return this.getSession();
    } catch (error) { stream.getTracks().forEach((track) => track.stop()); const friendly = actionableError(error); this.notify('FAILED', { error: friendly }); throw friendly; }
  }
  async withRetry(operation, phase) { let lastError; for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) { try { return await operation(); } catch (error) { lastError = error; if (error.code === 'PERMISSION_DENIED' || error.code === 'BROWSER_UNSUPPORTED') break; if (attempt < this.config.maxRetries) await new Promise((resolve) => this.scheduler.setTimeout(resolve, this.config.retryDelay * this.config.backoffFactor ** attempt)); } } throw { ...actionableError(lastError), phase }; }
  attachMonitoring() { this.mediaDevices?.addEventListener?.('devicechange', this.boundDeviceChange); this.document?.addEventListener?.('visibilitychange', this.boundVisibility); if (!this.healthTimer) this.healthTimer = this.scheduler.setInterval(() => this.checkHealth(), this.config.healthCheckInterval); }
  detachMonitoring() { this.mediaDevices?.removeEventListener?.('devicechange', this.boundDeviceChange); this.document?.removeEventListener?.('visibilitychange', this.boundVisibility); if (this.healthTimer) this.scheduler.clearInterval(this.healthTimer); this.healthTimer = null; }
  checkHealth() { if (!this.active) return; if (!this.stream?.active || !this.stream.getAudioTracks().some((track) => track.readyState === 'live')) this.recover('Microphone disconnected.'); else if (this.context?.state === 'suspended') this.ensureContextRunning(); else if (this.context?.state === 'closed') this.recover('AudioContext closed.'); else this.notify('HEALTHY'); }
  async ensureContextRunning() { if (!this.active) return; try { if (this.context?.state === 'suspended') await this.context.resume(); if (this.context?.state === 'closed') await this.recover('AudioContext closed.'); this.diagnostics.audioContextState = this.context?.state ?? 'closed'; } catch { this.notify('USER_GESTURE_REQUIRED', { error: { code: 'AUDIO_CONTEXT_SUSPENDED', message: 'AudioContext suspended. Click anywhere to resume audio.' } }); } }
  async recover(reason) { if (!this.active) return null; if (this.recoveryPromise) return this.recoveryPromise; this.diagnostics.recoveryAttempts = (this.diagnostics.recoveryAttempts ?? 0) + 1; this.diagnostics.lastRecovery = this.clock(); this.notify('RECOVERING', { reason }); this.recoveryPromise = Promise.resolve().then(async () => { await this.closeResources(); try { const session = await this.withRetry(() => this.create(), 'recovery'); this.notify('RECOVERED', { session }); return session; } catch (error) { this.notify('FAILED', { error }); throw error; } finally { this.recoveryPromise = null; } }); return this.recoveryPromise; }
  isHealthy() { return Boolean(this.stream?.active && this.context?.state !== 'closed' && this.analyser); }
  getSession() { return { stream: this.stream, context: this.context, analyser: this.analyser }; }
  subscribeFrames(listener) { this.frameListeners.add(listener); return () => this.frameListeners.delete(listener); }
  getDiagnostics() { return this.development ? new AudioDiagnostics(this.diagnostics) : null; }
  updateDiagnostics(partial) { Object.assign(this.diagnostics, partial); }
  async resume() { await this.ensureContextRunning(); return this.getSession(); }
  async pause() { if (this.context?.state === 'running') await this.context.suspend(); }
  async closeResources() { if (this.processor) this.processor.onaudioprocess = null; this.processor?.disconnect?.(); this.silentGain?.disconnect?.(); this.source?.disconnect?.(); this.stream?.getTracks().forEach((track) => track.stop()); if (this.context && this.context.state !== 'closed') await this.context.close?.(); this.stream = null; this.context = null; this.analyser = null; this.source = null; this.processor = null; this.silentGain = null; }
  async stop() { this.active = false; this.detachMonitoring(); await this.closeResources(); }
  async destroy() { await this.stop(); this.frameListeners.clear(); this.healthListeners.clear(); this.mediaDevices = null; this.document = null; }
}
