const REQUIRED_METHODS = ['start', 'stop', 'pause', 'resume', 'reset', 'destroy', 'getStatus'];

function validateDetector(detector) {
  const missing = REQUIRED_METHODS.find((method) => typeof detector?.[method] !== 'function');
  if (missing) throw new TypeError(`Detector must implement ${missing}().`);
  return detector;
}

export class DetectorManager {
  constructor(detectors = {}) {
    this.detectors = new Map();
    Object.entries(detectors).forEach(([id, detector]) => this.register(id, detector));
  }

  register(id, detector) {
    if (!id) throw new TypeError('Detector ID is required.');
    if (this.detectors.has(id)) throw new Error(`Detector is already registered: ${id}`);
    this.detectors.set(id, validateDetector(detector));
    return detector;
  }

  unregister(id, { destroy = true } = {}) {
    const detector = this.detectors.get(id);
    if (!detector) return false;
    if (destroy) detector.destroy();
    return this.detectors.delete(id);
  }

  async start(context) {
    await Promise.all([...this.detectors.values()].map((detector) => detector.start(context)));
  }

  stop() { this.detectors.forEach((detector) => detector.stop()); }
  pause() { this.detectors.forEach((detector) => detector.pause()); }
  resume() { this.detectors.forEach((detector) => detector.resume()); }
  reset() { this.detectors.forEach((detector) => detector.reset()); }

  getStatus() {
    return Object.freeze(Object.fromEntries(
      [...this.detectors].map(([id, detector]) => [id, detector.getStatus()]),
    ));
  }

  destroy() {
    this.detectors.forEach((detector) => detector.destroy());
    this.detectors.clear();
  }
}
