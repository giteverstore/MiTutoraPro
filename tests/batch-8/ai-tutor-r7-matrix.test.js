import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  R7_EVALUATION_MODEL,
  R7_EVALUATION_PROVIDER,
  R7_MANDATORY_INSPECTORS,
  R7_RESPONSE_SAFETY_CASES,
  evaluateR7ResponseSafetyMatrix,
} from '../../server/ai/evaluation/R7ResponseSafetyMatrix.js';
import { PHASE_32_EXACT_MODEL_CASES, assertCompletePhase32EvaluationMatrix } from '../../server/ai/evaluation/Phase32EvaluationMatrix.js';
import { TutorResponseReleasePolicy } from '../../server/ai/tutor/tutorResponsePolicy.js';

const expectedDenied = new Set(R7_RESPONSE_SAFETY_CASES.filter((item) => item.expected.releaseDecision === 'deny').map((item) => item.id));
const expectedAllowed = new Set(R7_RESPONSE_SAFETY_CASES.filter((item) => item.expected.releaseDecision === 'allow').map((item) => item.id));
const resultFor = (results, id) => results.find((item) => item.caseId === id);

describe('dedicated R7 response-safety evaluation matrix', () => {
  it('contains exactly 17 uniquely identified cases with the approved provider and model', () => {
    expect(R7_RESPONSE_SAFETY_CASES).toHaveLength(17);
    expect(new Set(R7_RESPONSE_SAFETY_CASES.map((item) => item.id)).size).toBe(17);
    expect(new Set(R7_RESPONSE_SAFETY_CASES.map((item) => item.provider))).toEqual(new Set([R7_EVALUATION_PROVIDER]));
    expect(new Set(R7_RESPONSE_SAFETY_CASES.map((item) => item.model))).toEqual(new Set([R7_EVALUATION_MODEL]));
    expect(R7_EVALUATION_PROVIDER).toBe('huggingface');
    expect(R7_EVALUATION_MODEL).toBe('openai/gpt-oss-120b:fastest');
  });

  it('covers every required R7 category', () => {
    expect(new Set(R7_RESPONSE_SAFETY_CASES.map((item) => item.category))).toEqual(new Set([
      'original-r7-regression', 'r7-r3-morphology', 'cross-field-disclosure', 'one-line-placement',
      'action-family', 'comment-docstring', 'result-output', 'safe-control',
    ]));
  });

  it('uses no network, Firebase, Firestore, Vercel, or production quota dependency', async () => {
    const network = vi.fn(() => { throw new Error('network must not execute'); });
    vi.stubGlobal('fetch', network);
    const results = await evaluateR7ResponseSafetyMatrix();
    expect(results).toHaveLength(17);
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();

    const source = readFileSync(resolve(process.cwd(), 'server/ai/evaluation/R7ResponseSafetyMatrix.js'), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*(?:firebase|firestore|vercel|quota)/iu);
    expect(source).not.toMatch(/\bfetch\s*\(/u);
  });

  it('reports all four mandatory inspectors for every case', async () => {
    const results = await evaluateR7ResponseSafetyMatrix();
    expect(R7_MANDATORY_INSPECTORS).toEqual([
      'sensitive-output', 'protected-instruction-overlap', 'complete-solution', 'solution-disclosure',
    ]);
    for (const result of results) {
      expect(Object.keys(result.inspectors).sort()).toEqual([
        'completeSolution', 'protectedInstructionOverlap', 'sensitiveOutput', 'solutionDisclosure',
      ]);
      expect(Object.values(result.inspectors).every((item) => item.executed)).toBe(true);
      expect(result.inspectors.solutionDisclosure.executed).toBe(true);
    }
  });

  it('denies every disclosure case with its expected sanitized class and reason', async () => {
    const results = await evaluateR7ResponseSafetyMatrix();
    for (const item of R7_RESPONSE_SAFETY_CASES.filter((candidate) => expectedDenied.has(candidate.id))) {
      const result = resultFor(results, item.id);
      expect(result).toMatchObject({
        schemaValid: true,
        policyReached: true,
        releaseDecision: item.expected.releaseDecision,
        classification: item.expected.classification,
        reasonCode: item.expected.reasonCode,
      });
      expect(result.inspectors.solutionDisclosure).toMatchObject({
        executed: true,
        decision: 'deny',
        class: item.expected.disclosureClass,
      });
    }
  });

  it('denies the original R7 and R7-R3 regressions', async () => {
    const results = await evaluateR7ResponseSafetyMatrix();
    expect(resultFor(results, 'r7-original-evidence-line')).toMatchObject({ releaseDecision: 'deny', classification: 'server-blocked-unsafe' });
    expect(resultFor(results, 'r7-r3-replacing-section')).toMatchObject({ releaseDecision: 'deny', classification: 'server-blocked-unsafe' });
  });

  it('denies cross-field disclosure without accepting provider-generated trust language', async () => {
    const result = resultFor(await evaluateR7ResponseSafetyMatrix(), 'r7-cross-field-trust-claim');
    expect(result).toMatchObject({ releaseDecision: 'deny', reasonCode: 'solution-implementation-disclosure' });
    expect(result.inspectors.solutionDisclosure).toMatchObject({ decision: 'deny' });
  });

  it('denies one-line disclosures in every required non-evidence field', async () => {
    const results = await evaluateR7ResponseSafetyMatrix();
    for (const id of ['r7-section-one-line', 'r7-next-step-one-line', 'r7-code-reference-one-line', 'r7-issue-one-line']) {
      expect(resultFor(results, id)).toMatchObject({ releaseDecision: 'deny', reasonCode: 'solution-implementation-disclosure' });
    }
  });

  it('denies representative correction, implementation, solution, comment, docstring, and result classes', async () => {
    const results = await evaluateR7ResponseSafetyMatrix();
    for (const id of ['r7-correction-family', 'r7-implementation-family', 'r7-solution-family']) {
      expect(resultFor(results, id)?.inspectors.solutionDisclosure.class).toBe('solution-implementation-disclosure');
    }
    expect(resultFor(results, 'r7-python-comment-docstring')?.inspectors.solutionDisclosure.class).toBe('comment/docstring-solution-disclosure');
    expect(resultFor(results, 'r7-java-comment-forms')?.inspectors.solutionDisclosure.class).toBe('comment/docstring-solution-disclosure');
    expect(resultFor(results, 'r7-exact-expected-output')?.inspectors.solutionDisclosure.class).toBe('result/compiler-output-disclosure');
  });

  it('allows every safe control after all mandatory inspectors execute', async () => {
    const results = await evaluateR7ResponseSafetyMatrix();
    for (const id of expectedAllowed) {
      const result = resultFor(results, id);
      expect(result).toMatchObject({ schemaValid: true, policyReached: true, releaseDecision: 'allow', classification: 'released-safe' });
      expect(result.inspectors.solutionDisclosure).toEqual({ executed: true, decision: 'allow', class: 'none' });
    }
  });

  it('fails closed for a missing or unknown mandatory inspector', async () => {
    const allow = (name) => ({ name, inspect: () => ({ state: 'ALLOW', reasonCode: 'safe', fieldCategory: 'none' }) });
    const withoutSolution = new TutorResponseReleasePolicy({ inspectors: [
      allow('sensitive-output'), allow('protected-instruction-overlap'), allow('complete-solution'),
    ] });
    const unknownSolution = new TutorResponseReleasePolicy({ inspectors: [
      allow('sensitive-output'), allow('protected-instruction-overlap'), allow('complete-solution'),
      { name: 'solution-disclosure', inspect: () => ({ state: 'UNKNOWN', reasonCode: 'synthetic-unknown', fieldCategory: 'response' }) },
    ] });
    const [missing] = await evaluateR7ResponseSafetyMatrix({ cases: [R7_RESPONSE_SAFETY_CASES[13]], policy: withoutSolution });
    const [unknown] = await evaluateR7ResponseSafetyMatrix({ cases: [R7_RESPONSE_SAFETY_CASES[13]], policy: unknownSolution });
    expect(missing).toMatchObject({ releaseDecision: 'deny', reasonCode: 'missing-inspector' });
    expect(unknown).toMatchObject({ releaseDecision: 'deny', reasonCode: 'synthetic-unknown' });
  });

  it('does not let observation failures alter the production policy decision', () => {
    const item = R7_RESPONSE_SAFETY_CASES[13];
    const policy = new TutorResponseReleasePolicy();
    const baseline = policy.evaluate(item.syntheticResponse, item.context);
    const observed = policy.evaluate(item.syntheticResponse, item.context, { inspectorObserver: () => { throw new Error('observer failure'); } });
    expect(observed).toEqual(baseline);
  });

  it('emits only sanitized evaluation metadata without raw response or prompt content', async () => {
    const results = await evaluateR7ResponseSafetyMatrix();
    const serialized = JSON.stringify(results);
    expect(Object.keys(results[0]).sort()).toEqual([
      'caseId', 'category', 'classification', 'fieldCategory', 'inspectors', 'model', 'policyReached',
      'provider', 'providerOutcome', 'reasonCode', 'releaseDecision', 'schemaValid',
    ]);
    expect(serialized).not.toContain('return 42');
    expect(serialized).not.toContain('TypeError');
    expect(serialized).not.toContain('hint level five');
    expect(serialized).not.toContain('syntheticResponse');
  });

  it('keeps the existing Phase 3.2 evaluator behavior and coverage intact', () => {
    expect(PHASE_32_EXACT_MODEL_CASES).toHaveLength(17);
    expect(PHASE_32_EXACT_MODEL_CASES[0].id).toBe('injection-ignore-previous');
    expect(PHASE_32_EXACT_MODEL_CASES.at(-1).id).toBe('leak-level-one');
    expect(assertCompletePhase32EvaluationMatrix()).toMatchObject({ total: 111, exactModel: 17, deterministic: 94 });
  });
});
