export const VAD_RUNTIME_STATE = Object.freeze({ UNINITIALIZED: 'UNINITIALIZED', INITIALIZING: 'INITIALIZING', READY: 'READY', FAILED: 'FAILED', RECOVERING: 'RECOVERING' });
function vadError(code, message, cause) { return Object.freeze({ code, message, cause }); }
function asVadError(error, code, message) { return error?.code ? error : vadError(code, `${message}${error?.message ? ` ${error.message}` : ''}`, error); }
export class VadInferenceService {
  constructor({ audioService, config, modelUrl = null, sessionFactory, runtimeLoader = () => import('./SileroVadRuntime.js'), fetcher = (...args) => globalThis.fetch(...args), cryptoObject = globalThis.crypto, scheduler = globalThis, clock = () => Date.now() }) {
    this.audioService = audioService; this.config = config; this.modelUrl = modelUrl; this.sessionFactory = sessionFactory; this.runtimeLoader = runtimeLoader; this.fetcher = fetcher === globalThis.fetch ? (...args) => globalThis.fetch(...args) : fetcher; this.crypto = cryptoObject; this.scheduler = scheduler; this.clock = clock;
    this.ort = null; this.session = null; this.stateTensor = null; this.sampleRateTensor = null; this.input = []; this.listeners = new Set(); this.statusListeners = new Set(); this.unsubscribeFrames = null; this.initializationPromise = null; this.active = false; this.runtimeState = VAD_RUNTIME_STATE.UNINITIALIZED; this.lastInference = null; this.lastLatency = null; this.recoveryAttempts = 0; this.healthTimer = null; this.queue = Promise.resolve(); this.modelChecksum = null; this.modelDiagnostics = {};
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  subscribeStatus(listener) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  notify(state, data = {}) { this.runtimeState = state; this.statusListeners.forEach((listener) => listener(Object.freeze({ state, ...data, diagnostics: this.getDiagnostics() }))); }
  getDiagnostics() { return Object.freeze({ vadLoaded: Boolean(this.session), onnxLoaded: Boolean(this.ort), modelVersion: this.config.modelVersion, modelChecksum: this.modelChecksum, latency: this.lastLatency, lastInference: this.lastInference, recoveryAttempts: this.recoveryAttempts, ...this.modelDiagnostics }); }
  async initialize() { if (this.session) return; if (this.initializationPromise) return this.initializationPromise; this.notify(VAD_RUNTIME_STATE.INITIALIZING); this.initializationPromise = this.withRetry(() => this.createSession()); try { await this.initializationPromise; this.notify(VAD_RUNTIME_STATE.READY); } catch (error) { const failure = asVadError(error, 'VAD_INITIALIZATION_FAILED', 'Voice activity model initialization failed.'); this.notify(VAD_RUNTIME_STATE.FAILED, { error: failure }); throw failure; } finally { this.initializationPromise = null; } }
  async createSession() {
    let runtime;
    try { runtime = await this.runtimeLoader(); }
    catch (error) { throw asVadError(error, 'ONNX_RUNTIME_LOAD_FAILED', 'ONNX Runtime assets could not be loaded.'); }
    this.ort = runtime.sileroVadRuntime?.ort ?? runtime.ort; const modelUrl = this.modelUrl ?? runtime.sileroVadRuntime?.modelUrl ?? runtime.modelUrl;
    this.modelDiagnostics = { modelUrl, wasmUrl: runtime.sileroVadRuntime?.wasmUrl, wasmModuleUrl: runtime.sileroVadRuntime?.wasmModuleUrl, onnxRuntimeInitialized: Boolean(this.ort?.InferenceSession) };
    if (!this.ort?.InferenceSession || !this.ort?.Tensor) throw vadError('ONNX_UNAVAILABLE', 'ONNX Runtime could not initialize in this browser.');
    this.ort.env.wasm.numThreads = this.config.wasmThreads;
    let modelData = modelUrl;
    if (!this.sessionFactory) {
      const controller = new AbortController(); const timeout = this.scheduler.setTimeout(() => controller.abort(), this.config.modelLoadTimeout);
      try { const response = await this.fetcher(modelUrl, { signal: controller.signal }); this.modelDiagnostics = { ...this.modelDiagnostics, fetchStatus: response.status, responseHeaders: Object.fromEntries(response.headers), contentType: response.headers.get('content-type') || '', downloadedBytes: Number(response.headers.get('content-length')) || null }; if (!response.ok) throw vadError('MODEL_DOWNLOAD_FAILED', `Voice model download failed with status ${response.status}.`); modelData = await response.arrayBuffer(); this.modelDiagnostics = { ...this.modelDiagnostics, downloadedBytes: modelData.byteLength }; }
      catch (error) { throw asVadError(error, 'MODEL_DOWNLOAD_FAILED', 'Voice model download failed.'); }
      finally { this.scheduler.clearTimeout(timeout); }
      this.modelChecksum = await this.checksum(modelData);
      if (this.config.modelChecksum && this.modelChecksum !== this.config.modelChecksum) throw vadError('MODEL_CHECKSUM_FAILED', 'Voice model integrity verification failed.');
    }
    try { this.session = this.sessionFactory ? await this.sessionFactory(modelData, this.ort) : await this.ort.InferenceSession.create(modelData, { executionProviders: ['wasm'] }); }
    catch (error) { throw asVadError(error, 'MODEL_SESSION_FAILED', 'The voice model could not create an ONNX inference session.'); }
    if (!this.session?.run) throw vadError('MODEL_INITIALIZATION_FAILED', 'Voice model session did not initialize.');
    this.resetModelState();
    try { await this.verifyFirstInference(); }
    catch (error) { throw asVadError(error, 'MODEL_FIRST_INFERENCE_FAILED', 'The voice model loaded but failed its readiness inference.'); }
    this.modelDiagnostics = { ...this.modelDiagnostics, sessionInitialized: true, firstInference: true };
  }
  async verifyFirstInference() { const input = new this.ort.Tensor('float32', new Float32Array(this.config.frameSamples), [1, this.config.frameSamples]); let output; try { output = await this.session.run({ input, state: this.stateTensor, sr: this.sampleRateTensor }); if (!output.stateN?.data || output.stateN.data.length !== 256 || !output.output?.data || !Number.isFinite(Number(output.output.data[0]))) throw vadError('INVALID_OUTPUT_SHAPE', 'Voice model readiness inference returned invalid output.'); } finally { input.dispose?.(); Object.values(output ?? {}).forEach((tensor) => tensor?.dispose?.()); this.resetModelState(); } }
  async checksum(buffer) { if (!this.crypto?.subtle) throw vadError('CHECKSUM_UNAVAILABLE', 'Model verification is unavailable in this browser.'); const digest = await this.crypto.subtle.digest('SHA-256', buffer); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''); }
  async withRetry(operation) { let lastError; for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) { try { return await operation(); } catch (error) { lastError = error; await this.releaseSession(); if (attempt < this.config.maxRetries) await new Promise((resolve) => this.scheduler.setTimeout(resolve, this.config.retryDelay * this.config.backoffFactor ** attempt)); } } throw lastError; }
  resetModelState() { this.stateTensor?.dispose?.(); this.sampleRateTensor?.dispose?.(); this.stateTensor = new this.ort.Tensor('float32', new Float32Array(256), [2, 1, 128]); this.sampleRateTensor = new this.ort.Tensor('int64', [16000n]); }
  async start() { if (this.active) return; this.active = true; await this.initialize(); if (!this.active) return; this.unsubscribeFrames = this.audioService.subscribeFrames((frame, sampleRate) => this.acceptAudio(frame, sampleRate)); if (!this.healthTimer) this.healthTimer = this.scheduler.setInterval(() => this.checkHealth(), this.config.healthCheckInterval); }
  acceptAudio(frame, nativeRate) { if (!(frame instanceof Float32Array) || !Number.isFinite(nativeRate) || nativeRate < this.config.sampleRate) return; const ratio = nativeRate / this.config.sampleRate; for (let index = 0; index < frame.length; index += ratio) this.input.push(frame[Math.floor(index)]); while (this.input.length >= this.config.frameSamples) { const vadFrame = new Float32Array(this.input.splice(0, this.config.frameSamples)); this.queue = this.queue.then(() => this.infer(vadFrame)).catch((error) => this.handleInferenceFailure(error)); } }
  async infer(frame) {
    if (!this.active || !this.session) return; if (frame.length !== this.config.frameSamples) throw vadError('INVALID_INPUT_SHAPE', `Voice model expected ${this.config.frameSamples} samples.`);
    const startedAt = this.clock(); const input = new this.ort.Tensor('float32', frame, [1, this.config.frameSamples]);
    try {
      const output = await this.session.run({ input, state: this.stateTensor, sr: this.sampleRateTensor });
      if (!output.stateN?.data || output.stateN.data.length !== 256 || !output.output?.data || output.output.data.length < 1) throw vadError('INVALID_OUTPUT_SHAPE', 'Voice model returned an unexpected output shape.');
      this.stateTensor.dispose?.(); this.stateTensor = output.stateN; const speechProbability = Number(output.output.data[0]); if (!Number.isFinite(speechProbability)) throw vadError('INVALID_INFERENCE_OUTPUT', 'Voice model returned an invalid probability.');
      let squares = 0; let peak = 0; let crossings = 0; let clipped = 0;
      for (let index = 0; index < frame.length; index += 1) { const value = frame[index]; squares += value * value; peak = Math.max(peak, Math.abs(value)); if (Math.abs(value) >= this.config.saturatedLevel) clipped += 1; if (index > 0 && Math.sign(value) !== Math.sign(frame[index - 1])) crossings += 1; }
      const rms = Math.sqrt(squares / frame.length); const zeroCrossingRate = crossings / Math.max(1, frame.length - 1); const crestFactor = peak / Math.max(rms, Number.EPSILON); const clippingRatio = clipped / frame.length;
      const noiseProbability = Math.max(0, Math.min(1, (1 - speechProbability) * (rms / this.config.noiseEnergyReference))); this.lastInference = this.clock(); this.lastLatency = this.lastInference - startedAt;
      const result = Object.freeze({ speechProbability, noiseProbability, confidence: Math.max(speechProbability, noiseProbability, 1 - speechProbability - noiseProbability), rms, peak, zeroCrossingRate, crestFactor, clippingRatio, timestamp: this.lastInference, latency: this.lastLatency, modelVersion: this.config.modelVersion, featureVersion: this.config.featureVersion }); this.listeners.forEach((listener) => listener(result));
    } finally { input.dispose?.(); }
  }
  async handleInferenceFailure(error) { this.notify(VAD_RUNTIME_STATE.RECOVERING, { error: vadError('VAD_INFERENCE_FAILED', 'Voice analysis stopped responding. Recovering…', error) }); await this.recover(); }
  async recover() { if (!this.active) return; this.recoveryAttempts += 1; await this.releaseSession(); try { await this.initialize(); this.notify(VAD_RUNTIME_STATE.READY, { recovered: true }); } catch (error) { this.notify(VAD_RUNTIME_STATE.FAILED, { error }); } }
  checkHealth() { if (!this.active || !this.session) return; if (this.lastInference && this.clock() - this.lastInference > this.config.staleInferenceTimeout) this.handleInferenceFailure(vadError('VAD_STALE', 'Voice analysis has stopped receiving audio frames.')); }
  stop() { this.active = false; this.unsubscribeFrames?.(); this.unsubscribeFrames = null; this.input = []; if (this.healthTimer) this.scheduler.clearInterval(this.healthTimer); this.healthTimer = null; }
  pause() { this.stop(); return this.audioService.pause(); }
  async resume() { await this.audioService.resume(); return this.start(); }
  reset() { this.input = []; this.queue = Promise.resolve(); if (this.session) this.resetModelState(); }
  async releaseSession() { this.stateTensor?.dispose?.(); this.sampleRateTensor?.dispose?.(); await this.session?.release?.(); this.session = null; this.stateTensor = null; this.sampleRateTensor = null; }
  async destroy() { this.stop(); await this.releaseSession(); this.listeners.clear(); this.statusListeners.clear(); this.ort = null; }
}
