import { callFirebaseFunction } from '../../firebase/functions';

export class CertificationApiRepository {
  call(name, data) { return callFirebaseFunction(name, data); }
  getStatus(courseId) { return this.call('getCertificationStatus', { courseId }); }
  getCandidateExam(examId) { return this.call('getCandidateExam', { examId }); }
  getAttempt(attemptId) { return this.call('getExamAttempt', { attemptId }); }
  createAttempt(data) { return this.call('createExamAttempt', data); }
  beginVerification(attemptId) { return this.call('beginExamVerification', { attemptId }); }
  completeVerification(attemptId, summary) { return this.call('completeExamVerification', { attemptId, summary }); }
  startAttempt(attemptId) { return this.call('startExamAttempt', { attemptId }); }
  acquireLease(attemptId, sessionId) { return this.call('acquireExamLease', { attemptId, sessionId }); }
  heartbeat(attemptId, sessionId, sequence) { return this.call('heartbeatExamAttempt', { attemptId, sessionId, sequence }); }
  saveResponses(payload) { return this.call('saveExamResponses', payload); }
  saveIntegrityEvents(payload) { return this.call('saveIntegrityEvents', payload); }
  submit(payload) { return this.call('submitExamAttempt', payload); }
  abandon(attemptId, sessionId) { return this.call('abandonExamAttempt', { attemptId, sessionId }); }
}
