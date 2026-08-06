import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';

export const LIGHTING_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  TOO_DARK: 'TOO_DARK',
  GOOD: 'GOOD',
  TOO_BRIGHT: 'TOO_BRIGHT',
});

export class LightingDetector {
  constructor({ eventBus, videoProvider, darkThreshold = 55, brightThreshold = 210, intervalMs = 500 }) {
    this.eventBus = eventBus;
    this.videoProvider = videoProvider;
    this.darkThreshold = darkThreshold;
    this.brightThreshold = brightThreshold;
    this.intervalMs = intervalMs;
    this.status = LIGHTING_STATUS.UNKNOWN;
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
    this.publish(average < this.darkThreshold
      ? LIGHTING_STATUS.TOO_DARK
      : average > this.brightThreshold ? LIGHTING_STATUS.TOO_BRIGHT : LIGHTING_STATUS.GOOD);
  }

  stop() {
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = null;
  }

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

  publish(status) {
    if (this.status === status) return;
    this.status = status;
    this.eventBus.emit(new ExamEvent({
      type: EXAM_EVENT_TYPES.CUSTOM,
      severity: status === LIGHTING_STATUS.GOOD ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW,
      metadata: { channel: 'vision', detector: 'lighting', status },
    }));
  }
}
