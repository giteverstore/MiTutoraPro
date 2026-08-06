const REQUIRED_METHODS = ['start', 'stop', 'reset', 'getStatus', 'destroy'];

function validateDetector(detector) {
  const missingMethod = REQUIRED_METHODS.find((method) => typeof detector?.[method] !== 'function');
  if (missingMethod) throw new TypeError(`Detector must implement ${missingMethod}().`);
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

  async start(context) {
    await Promise.all([...this.detectors.values()].map((detector) => detector.start(context)));
  }

  stop() {
    this.detectors.forEach((detector) => detector.stop());
  }

  reset() {
    this.detectors.forEach((detector) => detector.reset());
  }

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
