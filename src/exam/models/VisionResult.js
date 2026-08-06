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
    browser,
    elapsedMs = 0,
    remainingMs = 0,
    consecutiveValidMs = 0,
    pauseReasons = [],
    verifiedAt = null,
  }) {
    this.status = status;
    this.camera = camera;
    this.face = face;
    this.lighting = lighting;
    this.background = background;
    this.browser = Object.freeze({ ...browser });
    this.elapsedMs = elapsedMs;
    this.remainingMs = remainingMs;
    this.consecutiveValidMs = consecutiveValidMs;
    this.pauseReasons = Object.freeze([...pauseReasons]);
    this.verifiedAt = verifiedAt;
    Object.freeze(this);
  }
}
