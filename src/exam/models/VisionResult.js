export const VISION_VERIFICATION_STATUS = Object.freeze({
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  VERIFYING: 'VERIFYING',
  PAUSED: 'PAUSED',
  VERIFIED: 'VERIFIED',
  ERROR: 'ERROR',
});

export class VisionResult {
  constructor({
    status = VISION_VERIFICATION_STATUS.IDLE,
    camera,
    face,
    lighting,
    background,
    audio,
    browser,
    elapsedMs = 0,
    remainingMs = 0,
    consecutiveValidMs = 0,
    pauseReasons = [],
    verifiedAt = null,
    readinessScore = 0,
    quality = {},
    summary = null,
    health = {},
    minimumReadinessScore = 0,
    detectors = {},
  }) {
    this.status = status;
    this.camera = camera;
    this.face = face;
    this.lighting = lighting;
    this.background = background;
    this.audio = audio;
    this.browser = Object.freeze({ ...browser });
    this.elapsedMs = elapsedMs;
    this.remainingMs = remainingMs;
    this.consecutiveValidMs = consecutiveValidMs;
    this.pauseReasons = Object.freeze([...pauseReasons]);
    this.verifiedAt = verifiedAt;
    this.readinessScore = readinessScore;
    this.quality = Object.freeze({ ...quality });
    this.summary = summary;
    this.health = Object.freeze({ ...health });
    this.minimumReadinessScore = minimumReadinessScore;
    this.detectors = Object.freeze({ ...detectors });
    Object.freeze(this);
  }
}
