export const EXAM_SESSION_STATES = Object.freeze({
  IDLE: 'IDLE',
  ENVIRONMENT_CHECK: 'ENVIRONMENT_CHECK',
  READY: 'READY',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
});

const transitions = Object.freeze({
  [EXAM_SESSION_STATES.IDLE]: new Set([EXAM_SESSION_STATES.ENVIRONMENT_CHECK]),
  [EXAM_SESSION_STATES.ENVIRONMENT_CHECK]: new Set([EXAM_SESSION_STATES.READY]),
  [EXAM_SESSION_STATES.READY]: new Set([EXAM_SESSION_STATES.RUNNING]),
  [EXAM_SESSION_STATES.RUNNING]: new Set([EXAM_SESSION_STATES.COMPLETED]),
  [EXAM_SESSION_STATES.COMPLETED]: new Set([EXAM_SESSION_STATES.IDLE]),
});

export class ExamSession {
  constructor({ examId, candidateId, duration }) {
    if (!examId || !candidateId) throw new TypeError('ExamSession requires examId and candidateId.');
    if (!Number.isFinite(duration) || duration <= 0) throw new TypeError('Exam duration must be positive.');
    this.examId = examId;
    this.candidateId = candidateId;
    this.duration = duration;
    this.startTime = null;
    this.endTime = null;
    this.state = EXAM_SESSION_STATES.IDLE;
    this.listeners = new Set();
  }

  transition(nextState, timestamp = Date.now()) {
    if (!transitions[this.state]?.has(nextState)) {
      throw new Error(`Invalid exam session transition: ${this.state} -> ${nextState}`);
    }
    if (nextState === EXAM_SESSION_STATES.RUNNING) this.startTime = timestamp;
    if (nextState === EXAM_SESSION_STATES.COMPLETED) this.endTime = timestamp;
    if (nextState === EXAM_SESSION_STATES.IDLE) {
      this.startTime = null;
      this.endTime = null;
    }
    this.state = nextState;
    this.notify();
    return this.getSnapshot();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return Object.freeze({
      examId: this.examId,
      candidateId: this.candidateId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      state: this.state,
    });
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
