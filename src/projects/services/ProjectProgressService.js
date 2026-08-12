const key = 'mi-tutora:projects:v1';
export class ProjectProgressService {
  read() { try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; } }
  get(projectId) { return this.read()[projectId] ?? { status: 'not-started', attempts: 0, validationStatus: 'idle', completedAt: null, score: 0 }; }
  update(projectId, partial) { const all = this.read(); const next = { ...this.get(projectId), ...partial }; all[projectId] = next; localStorage.setItem(key, JSON.stringify(all)); return next; }
  start(projectId) { const current = this.get(projectId); return this.update(projectId, { status: current.status === 'completed' ? 'completed' : 'started', startedAt: current.startedAt ?? new Date().toISOString() }); }
  recordValidation(projectId, result, submission) { const current = this.get(projectId); return this.update(projectId, { status: result.passed ? 'completed' : 'started', attempts: current.attempts + 1, validationStatus: result.passed ? 'passed' : 'failed', completedAt: result.passed ? current.completedAt ?? new Date().toISOString() : current.completedAt, score: Math.max(current.score, result.score), submission: result.passed ? submission : current.submission }); }
}
export const projectProgressService = new ProjectProgressService();
