import { FIRECRACKER_SECURITY_PROFILE } from './JudgePolicy.js';
import { normalizeJudgeRequest, trustedJudgeResult } from './JudgeModels.js';

export class ExecutionReplayGuard {
  #claimed = new Set();
  claim(executionId) {
    if (this.#claimed.has(executionId)) throw Object.assign(new Error('Execution ID was already used.'), { code: 'judge/duplicate-execution' });
    this.#claimed.add(executionId);
  }
}

export class PythonJudge {
  constructor({ registry, controller, replayGuard = new ExecutionReplayGuard() }) {
    if (!registry?.resolve || !controller?.execute) throw new TypeError('PythonJudge requires a protected registry and Firecracker controller.');
    this.registry = registry;
    this.controller = controller;
    this.replayGuard = replayGuard;
    this.securityProfile = FIRECRACKER_SECURITY_PROFILE;
  }

  async judge(value, { signal } = {}) {
    const request = normalizeJudgeRequest(value);
    this.replayGuard.claim(request.executionId);
    const suite = this.registry.resolve(request);
    const result = await this.controller.execute({ request, suite, signal });
    return trustedJudgeResult(request, result);
  }
}

export class PythonJudgeExecutor {
  constructor({ judge, resolveBinding }) {
    if (!judge?.judge || typeof resolveBinding !== 'function') throw new TypeError('PythonJudgeExecutor requires a judge and authoritative binding resolver.');
    this.judge = judge;
    this.resolveBinding = resolveBinding;
    this.securityProfile = judge.securityProfile;
  }

  async execute({ language, sourceCode, verification, signal }) {
    const binding = await this.resolveBinding({ language, verification });
    const result = await this.judge.judge({ ...binding, sourceCode }, { signal });
    return Object.freeze({ passed: result.status === 'PASS' && result.cleanupStatus === 'VERIFIED', testCount: result.testsTotal, trustedResult: result });
  }
}
