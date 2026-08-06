import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const LIGHTING_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  TOO_DARK: 'TOO_DARK',
  GOOD: 'GOOD',
  TOO_BRIGHT: 'TOO_BRIGHT',
});

const lightingMessages = {
  [LIGHTING_STATUS.UNKNOWN]: ['Analyzing room lighting…', DETECTOR_SEVERITY.PENDING],
  [LIGHTING_STATUS.TOO_DARK]: ['Lighting is too dark. Move to a brighter room or face a light source.', DETECTOR_SEVERITY.ERROR],
  [LIGHTING_STATUS.GOOD]: ['Lighting is clear and balanced.', DETECTOR_SEVERITY.SUCCESS],
  [LIGHTING_STATUS.TOO_BRIGHT]: ['Lighting is too bright. Reduce glare or move away from direct light.', DETECTOR_SEVERITY.WARNING],
};

export function createLightingStatus(status, quality = status === LIGHTING_STATUS.GOOD ? 100 : 0, brightness = null) {
  const [message, severity] = lightingMessages[status];
  return new DetectorStatus({ status, message, severity, quality, details: { brightness } });
}

export class LightingDetector {
  constructor({ eventBus, videoProvider, darkThreshold = 55, brightThreshold = 210, idealBrightness = 132, intervalMs = 500 }) {
    this.eventBus = eventBus;
    this.videoProvider = videoProvider;
    this.darkThreshold = darkThreshold;
    this.brightThreshold = brightThreshold;
    this.idealBrightness = idealBrightness;
    this.intervalMs = intervalMs;
    this.status = createLightingStatus(LIGHTING_STATUS.UNKNOWN);
    this.timer = null;
    this.canvas = null;
    this.context = null;
  }

  start() {
    if (this.timer) return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 36;
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    this.timer = globalThis.setInterval(() => this.analyzeFrame(), this.intervalMs);
  }

  analyzeFrame() {
    const video = this.videoProvider();
    if (!this.context || !video || video.readyState < 2) return;
    this.context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    const pixels = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    let brightness = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      brightness += (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
    }
    const average = brightness / (pixels.length / 4);
    const status = average < this.darkThreshold
      ? LIGHTING_STATUS.TOO_DARK
      : average > this.brightThreshold ? LIGHTING_STATUS.TOO_BRIGHT : LIGHTING_STATUS.GOOD;
    const range = Math.max(this.idealBrightness - this.darkThreshold, this.brightThreshold - this.idealBrightness);
    const quality = Math.max(0, 100 - (Math.abs(average - this.idealBrightness) / range) * 100);
    this.publish(status, quality, average);
  }

  stop() {
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = null;
  }

  pause() { this.stop(); }
  resume() { this.start(); }

  reset() {
    this.stop();
    this.publish(LIGHTING_STATUS.UNKNOWN);
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.stop();
    this.canvas = null;
    this.context = null;
  }

  publish(status, quality, brightness) {
    if (this.status.status === status && quality === undefined) return;
    this.status = createLightingStatus(status, quality, brightness);
    this.eventBus.emit(new ExamEvent({
      type: EXAM_EVENT_TYPES.CUSTOM,
      severity: status === LIGHTING_STATUS.GOOD ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW,
      metadata: { channel: 'vision', detector: 'lighting', status: this.status },
    }));
  }
}
