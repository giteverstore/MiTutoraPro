import { Buffer } from 'node:buffer';
import { AIServiceError } from '../AIServiceError.js';
import {
  RESPONSE_SCHEMA_VERSION,
  TUTOR_EVIDENCE_BASES,
  TUTOR_NEXT_STEP_KINDS,
  TUTOR_POLICY_VERSION,
  TUTOR_RESPONSE_LIMITS,
} from './tutorConfig.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

const lineReferenceSchema = (withExplanation) => ({
  type: 'object',
  additionalProperties: false,
  required: withExplanation ? ['startLine', 'endLine', 'explanation'] : ['startLine', 'endLine'],
  properties: {
    startLine: { type: 'integer', minimum: 1 },
    endLine: { type: 'integer', minimum: 1 },
    ...(withExplanation ? { explanation: { type: 'string' } } : {}),
  },
});

export const TUTOR_PROVIDER_RESPONSE_SCHEMA = Object.freeze({
  name: 'mi_tutora_ai_tutor_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'policyVersion', 'operation', 'evidence', 'summary', 'sections', 'codeReferences', 'concepts', 'issues', 'nextStep'],
    properties: {
      schemaVersion: { type: 'string', enum: [RESPONSE_SCHEMA_VERSION] },
      policyVersion: { type: 'string', enum: [TUTOR_POLICY_VERSION] },
      operation: { type: 'string', enum: ['explain-selection', 'explain-full-code'] },
      evidence: {
        type: 'object', additionalProperties: false, required: ['basis', 'note'],
        properties: { basis: { type: 'string', enum: TUTOR_EVIDENCE_BASES }, note: { type: ['string', 'null'] } },
      },
      summary: { type: 'string' },
      sections: {
        type: 'array', maxItems: TUTOR_RESPONSE_LIMITS.sectionCount,
        items: { type: 'object', additionalProperties: false, required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' } } },
      },
      codeReferences: { type: 'array', maxItems: TUTOR_RESPONSE_LIMITS.codeReferenceCount, items: lineReferenceSchema(true) },
      concepts: {
        type: 'array', maxItems: TUTOR_RESPONSE_LIMITS.conceptCount,
        items: { type: 'object', additionalProperties: false, required: ['name', 'explanation'], properties: { name: { type: 'string' }, explanation: { type: 'string' } } },
      },
      issues: {
        type: 'array', maxItems: TUTOR_RESPONSE_LIMITS.issueCount,
        items: {
          type: 'object', additionalProperties: false, required: ['title', 'explanation', 'hintLevel', 'codeReference'],
          properties: {
            title: { type: 'string' }, explanation: { type: 'string' }, hintLevel: { type: 'integer', enum: [1, 2, 3, 4, 5] },
            codeReference: { anyOf: [lineReferenceSchema(false), { type: 'null' }] },
          },
        },
      },
      nextStep: {
        type: 'object', additionalProperties: false, required: ['kind', 'text'],
        properties: { kind: { type: 'string', enum: TUTOR_NEXT_STEP_KINDS }, text: { type: 'string' } },
      },
    },
  },
});

function invalidResponse(cause, validationReason = 'schema-invalid') {
  const error = new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502, cause });
  error.validationReason = validationReason;
  return error;
}

function extractStructuredObject(source) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"' && depth > 0) inString = true;
    else if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
      if (depth > 8) throw invalidResponse(undefined, 'unsafe-object-depth');
    } else if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          const parsed = JSON.parse(source.slice(start, index + 1));
          if (parsed?.schemaVersion != null && parsed?.policyVersion != null) return parsed;
        } catch {
          // Continue with the next non-overlapping top-level candidate.
        }
        start = -1;
      }
    }
  }
  return null;
}

export function parseTutorResponseText(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new AIServiceError('ai/empty-response', 'The AI Tutor returned an empty response.', { status: 502 });
  }
  if (Buffer.byteLength(rawText, 'utf8') > TUTOR_RESPONSE_LIMITS.totalBytes) throw invalidResponse(undefined, 'response-too-large');
  let candidate = rawText.trim();
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidate = fenced[1].trim();
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const firstObject = candidate.indexOf('{');
    const lastObject = candidate.lastIndexOf('}');
    const extracted = extractStructuredObject(candidate);
    if (extracted) return extracted;
    const reason = firstObject < 0 || lastObject <= firstObject
      ? 'malformed-json-no-object'
      : firstObject === 0 && lastObject === candidate.length - 1
        ? 'malformed-json-object-syntax'
        : 'malformed-json-wrapped-object';
    throw invalidResponse(error, reason);
  }
}

function assertSafeTree(value, depth = 0) {
  if (depth > 8) throw invalidResponse(undefined, 'unsafe-object-depth');
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) throw invalidResponse(undefined, 'dangerous-object-key');
    assertSafeTree(value[key], depth + 1);
  }
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse(undefined, 'object-required');
  return value;
}

function string(value, limit, { required = true } = {}) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw invalidResponse(undefined, 'string-required');
  }
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > limit || CONTROL_CHARACTERS.test(normalized)) throw invalidResponse(undefined, 'invalid-string');
  return normalized;
}

function array(value, limit) {
  if (!Array.isArray(value) || value.length > limit) throw invalidResponse(undefined, 'invalid-array');
  return value;
}

function lineReference(value, context, { explanation = true } = {}) {
  const reference = object(value);
  const startLine = Number(reference.startLine);
  const endLine = Number(reference.endLine);
  const totalLines = context.code.split(/\r?\n/).length;
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine || endLine > totalLines) {
    throw invalidResponse(undefined, 'invalid-line-reference');
  }
  return {
    startLine,
    endLine,
    ...(explanation ? { explanation: string(reference.explanation, TUTOR_RESPONSE_LIMITS.codeReferenceExplanation) } : {}),
  };
}

export function validateTutorResponse(rawText, context) {
  const parsed = parseTutorResponseText(rawText);
  assertSafeTree(parsed);
  const response = object(parsed);
  if (response.schemaVersion !== RESPONSE_SCHEMA_VERSION
    || response.policyVersion !== TUTOR_POLICY_VERSION
    || response.operation !== context.operation) throw invalidResponse(undefined, 'version-or-operation-mismatch');

  const evidence = object(response.evidence);
  if (!TUTOR_EVIDENCE_BASES.includes(evidence.basis)) throw invalidResponse(undefined, 'invalid-evidence-basis');
  if (context.evidence.basis === 'static' && evidence.basis === 'runtime') throw invalidResponse(undefined, 'unsupported-runtime-claim');

  const sections = array(response.sections, TUTOR_RESPONSE_LIMITS.sectionCount).map((item) => {
    const section = object(item);
    return {
      title: string(section.title, TUTOR_RESPONSE_LIMITS.sectionTitle),
      body: string(section.body, TUTOR_RESPONSE_LIMITS.sectionBody),
    };
  });
  const codeReferences = array(response.codeReferences, TUTOR_RESPONSE_LIMITS.codeReferenceCount)
    .map((item) => lineReference(item, context));
  const concepts = array(response.concepts, TUTOR_RESPONSE_LIMITS.conceptCount).map((item) => {
    const concept = object(item);
    return {
      name: string(concept.name, TUTOR_RESPONSE_LIMITS.conceptName),
      explanation: string(concept.explanation, TUTOR_RESPONSE_LIMITS.conceptExplanation),
    };
  });
  const issues = array(response.issues, TUTOR_RESPONSE_LIMITS.issueCount).map((item) => {
    const issue = object(item);
    const hintLevel = Number(issue.hintLevel);
    if (!Number.isInteger(hintLevel) || hintLevel < 1 || hintLevel > context.hintLevel) throw invalidResponse(undefined, 'disallowed-hint-level');
    return {
      title: string(issue.title, TUTOR_RESPONSE_LIMITS.issueTitle),
      explanation: string(issue.explanation, TUTOR_RESPONSE_LIMITS.issueExplanation),
      hintLevel,
      ...(issue.codeReference ? { codeReference: lineReference(issue.codeReference, context, { explanation: false }) } : {}),
    };
  });
  const nextStep = object(response.nextStep);
  if (!TUTOR_NEXT_STEP_KINDS.includes(nextStep.kind)) throw invalidResponse(undefined, 'invalid-next-step-kind');

  return Object.freeze({
    schemaVersion: RESPONSE_SCHEMA_VERSION,
    policyVersion: TUTOR_POLICY_VERSION,
    operation: context.operation,
    evidence: Object.freeze({
      basis: evidence.basis,
      ...(evidence.note == null || evidence.note === '' ? {} : { note: string(evidence.note, TUTOR_RESPONSE_LIMITS.evidenceNote) }),
    }),
    summary: string(response.summary, TUTOR_RESPONSE_LIMITS.summary),
    sections: Object.freeze(sections.map(Object.freeze)),
    codeReferences: Object.freeze(codeReferences.map(Object.freeze)),
    concepts: Object.freeze(concepts.map(Object.freeze)),
    issues: Object.freeze(issues.map(Object.freeze)),
    nextStep: Object.freeze({
      kind: nextStep.kind,
      text: string(nextStep.text, TUTOR_RESPONSE_LIMITS.nextStepText, { required: nextStep.kind !== 'none' }),
    }),
  });
}
