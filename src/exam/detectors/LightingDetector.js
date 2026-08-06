import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const LIGHTING_STATUS = Object.freeze({ INITIALIZING: 'INITIALIZING', ANALYZING: 'ANALYZING', UNKNOWN: 'INITIALIZING', TOO_DARK: 'TOO_DARK', GOOD: 'GOOD', TOO_BRIGHT: 'TOO_BRIGHT' });
const messages = {
  [LIGHTING_STATUS.INITIALIZING]: ['Preparing lighting analysis…', DETECTOR_SEVERITY.PENDING],
  [LIGHTING_STATUS.ANALYZING]: ['Analyzing room lighting…', DETECTOR_SEVERITY.PENDING],
  [LIGHTING_STATUS.TOO_DARK]: ['Lighting is too dark. Face a soft light source.', DETECTOR_SEVERITY.ERROR],
  [LIGHTING_STATUS.GOOD]: ['Lighting is clear and balanced.', DETECTOR_SEVERITY.SUCCESS],
  [LIGHTING_STATUS.TOO_BRIGHT]: ['Lighting is too bright. Reduce glare or direct light.', DETECTOR_SEVERITY.WARNING],
};

export function createLightingStatus(status, quality = status === LIGHTING_STATUS.GOOD ? 100 : 0, brightness = null) {
  const [message, severity] = messages[status];
  return new DetectorStatus({ status, message, severity, quality, details: { brightness } });
}

export class LightingDetector {
  constructor({ eventBus, inferenceService, videoProvider, config, darkThreshold = 55, brightThreshold = 210, idealBrightness = 132, intervalMs = 500 }) {
    this.eventBus = eventBus; this.inferenceService = inferenceService;
    this.videoProvider = videoProvider; this.intervalMs = intervalMs;
    this.config = config ?? { minimumBrightness: darkThreshold, maximumBrightness: brightThreshold, idealBrightnessRange: [idealBrightness - 25, idealBrightness + 25], smoothingWindow: 1 };
    this.status = createLightingStatus(LIGHTING_STATUS.INITIALIZING); this.unsubscribe = null; this.timer = null; this.canvas = null; this.context = null; this.samples = [];
  }
  start() { if (this.unsubscribe || this.timer) return; this.publish(LIGHTING_STATUS.ANALYZING); if (this.inferenceService) this.unsubscribe = this.inferenceService.subscribe((result) => this.handleResult(result)); else { this.canvas = document.createElement('canvas'); this.canvas.width = 64; this.canvas.height = 36; this.context = this.canvas.getContext('2d', { willReadFrequently: true }); this.timer = globalThis.setInterval(() => this.analyzeFrame(), this.intervalMs); } }
  stop() { this.unsubscribe?.(); this.unsubscribe = null; if (this.timer) globalThis.clearInterval(this.timer); this.timer = null; }
  pause() { this.stop(); } resume() { this.start(); }
  reset() { this.stop(); this.samples = []; this.publish(LIGHTING_STATUS.INITIALIZING); }
  destroy() { this.stop(); this.samples = []; }
  getStatus() { return this.status; }
  handleResult({ frame }) {
    if (!frame) return;
    this.samples.push(frame.brightness);
    if (this.samples.length > this.config.smoothingWindow) this.samples.shift();
    const brightness = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    const status = brightness < this.config.minimumBrightness ? LIGHTING_STATUS.TOO_DARK : brightness > this.config.maximumBrightness ? LIGHTING_STATUS.TOO_BRIGHT : LIGHTING_STATUS.GOOD;
    const [idealMin, idealMax] = this.config.idealBrightnessRange;
    const distance = brightness < idealMin ? idealMin - brightness : brightness > idealMax ? brightness - idealMax : 0;
    const quality = Math.max(0, Math.round(100 - distance / Math.max(idealMin, 255 - idealMax) * 100));
    this.publish(status, quality, brightness);
  }
  analyzeFrame() {
    const video = this.videoProvider?.(); if (!this.context || !video || video.readyState < 2) return;
    this.context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height); const pixels = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    let brightness = 0; for (let index = 0; index < pixels.length; index += 4) brightness += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
    this.handleResult({ frame: { brightness: brightness / (pixels.length / 4) } });
  }
  publish(status, quality, brightness) {
    this.status = createLightingStatus(status, quality, brightness);
    this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: status === LIGHTING_STATUS.GOOD ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW, metadata: { channel: 'vision', detector: 'lighting', status: this.status } }));
  }
}
