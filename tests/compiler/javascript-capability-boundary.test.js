import { describe, expect, it } from 'vitest';
import {
  javascriptCapabilityMessages,
  javascriptCapabilityPolicy,
  lockDownJavaScriptWorker,
} from '../../src/compiler/runtimes/javascript/javascriptCapabilityBoundary.js';
import { JAVASCRIPT_LEARNER_WORKER_ROUTE } from '../../vercel.mjs';
import { JAVASCRIPT_LEARNER_WORKER_CSP } from '../../config/javascriptLearnerWorkerPolicy.mjs';

function fakeWorkerGlobal() {
  return Object.fromEntries([
    ...javascriptCapabilityPolicy.network,
    ...javascriptCapabilityPolicy.nestedExecution,
    ...javascriptCapabilityPolicy.storage,
    ...javascriptCapabilityPolicy.crossContext,
  ].map((name) => [name, () => name]));
}

describe('JavaScript learner capability boundary', () => {
  it('replaces every network, nested-execution, storage, and cross-context capability', () => {
    const workerGlobal = fakeWorkerGlobal();
    const capabilityCount = Object.keys(workerGlobal).length;
    const result = lockDownJavaScriptWorker(workerGlobal);
    expect(result.retained).toEqual([]);
    expect(result.removed).toHaveLength(capabilityCount);
    for (const name of [...javascriptCapabilityPolicy.network, ...javascriptCapabilityPolicy.nestedExecution]) {
      expect(() => workerGlobal[name]()).toThrow(name === 'fetch' || javascriptCapabilityPolicy.network.includes(name)
        ? javascriptCapabilityMessages.network
        : javascriptCapabilityMessages.context);
    }
    for (const name of javascriptCapabilityPolicy.storage) expect(() => workerGlobal[name]()).toThrow(javascriptCapabilityMessages.storage);
    for (const name of javascriptCapabilityPolicy.crossContext) expect(() => workerGlobal[name]()).toThrow(javascriptCapabilityMessages.context);
  });

  it('survives constructor/global reflection because denied properties are immutable', () => {
    const workerGlobal = fakeWorkerGlobal();
    lockDownJavaScriptWorker(workerGlobal);
    const recovered = Function('candidate', 'return candidate') (workerGlobal);
    expect(() => recovered.fetch('/api/compiler/share')).toThrow(javascriptCapabilityMessages.network);
    expect(() => recovered.Worker('data:text/javascript,postMessage(1)')).toThrow(javascriptCapabilityMessages.context);
    expect(() => { recovered.fetch = globalThis.fetch; }).toThrow();
  });

  it('applies a worker-specific network and module-denial CSP in development and production', () => {
    for (const policy of [JAVASCRIPT_LEARNER_WORKER_CSP, JAVASCRIPT_LEARNER_WORKER_ROUTE.headers['Content-Security-Policy']]) {
      expect(policy).toContain("connect-src 'none'");
      expect(policy).toContain("worker-src 'none'");
      expect(policy).toContain("script-src 'unsafe-eval'");
      expect(policy).not.toContain("'self'");
      expect(policy).not.toContain('http:');
      expect(policy).not.toContain('https:');
    }
  });
});
