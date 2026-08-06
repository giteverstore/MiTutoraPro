export class IntegrityReport {
  constructor({ score, warningCount, timeline, generatedAt = Date.now() }) {
    this.score = score;
    this.warningCount = warningCount;
    this.timeline = Object.freeze([...timeline].sort(
      (a, b) => (a.timestamp ?? a.startedAt) - (b.timestamp ?? b.startedAt),
    ));
    this.generatedAt = generatedAt;
    Object.freeze(this);
  }
}
