import { Buffer } from 'node:buffer';
import { AIServiceError } from '../AIServiceError.js';
import {
  RESPONSE_SCHEMA_VERSION,
  TUTOR_EVIDENCE_BASES,
  TUTOR_NEXT_STEP_KINDS,
  TUTOR_POLICY_VERSION,
  TUTOR_RESPONSE_LIMITS,
} from './tutorConfig.js';
import { isConversationalGlue } from './tutorConversationPolicy.js';

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

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function invalidResponse(cause, validationReason = 'schema-invalid', diagnostic) {
  const error = new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502, cause });
  error.validationReason = validationReason;
  if (diagnostic) error.validationDiagnostic = Object.freeze(diagnostic);
  return error;
}

function requiredField(container, field, path = field) {
  if (!Object.hasOwn(container, field)) {
    throw invalidResponse(undefined, 'schema-required-field', {
      validationPath: path,
      validationRule: 'required',
      missingField: field,
    });
  }
  return container[field];
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

function object(value, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidResponse(undefined, 'object-required', {
      validationPath: path,
      validationRule: 'type',
      expectedType: 'object',
      actualType: valueType(value),
    });
  }
  return value;
}

function string(value, limit, { required = true, path = '$' } = {}) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw invalidResponse(undefined, 'string-required', {
      validationPath: path,
      validationRule: 'type',
      expectedType: 'string',
      actualType: valueType(value),
    });
  }
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > limit || CONTROL_CHARACTERS.test(normalized)) {
    throw invalidResponse(undefined, 'invalid-string', {
      validationPath: path,
      validationRule: !normalized ? 'minLength' : normalized.length > limit ? 'maxLength' : 'controlCharacters',
      expectedType: 'string',
      actualType: 'string',
    });
  }
  return normalized;
}

function array(value, limit, path) {
  if (!Array.isArray(value)) {
    throw invalidResponse(undefined, 'invalid-array', {
      validationPath: path,
      validationRule: 'type',
      expectedType: 'array',
      actualType: valueType(value),
    });
  }
  if (value.length > limit) {
    throw invalidResponse(undefined, 'invalid-array', {
      validationPath: path,
      validationRule: 'maxItems',
      expectedType: 'array',
      actualType: 'array',
    });
  }
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

export function createMinimalTutorEnvelope(summary, context) {
  return Object.freeze({
    schemaVersion: RESPONSE_SCHEMA_VERSION,
    policyVersion: TUTOR_POLICY_VERSION,
    operation: context.operation,
    evidence: Object.freeze({ basis: context.evidence.basis, note: null }),
    summary,
    sections: Object.freeze([]),
    codeReferences: Object.freeze([]),
    concepts: Object.freeze([]),
    issues: Object.freeze([]),
    nextStep: Object.freeze({ kind: 'none', text: '' }),
  });
}

export function normalizeTutorResponseEnvelope(parsed, context) {
  if (!isConversationalGlue(context.learnerMessage)
    || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || typeof parsed.summary !== 'string') return parsed;
  const defaults = createMinimalTutorEnvelope(parsed.summary, context);
  if (Object.keys(parsed).some((field) => !Object.hasOwn(defaults, field))) {
    throw invalidResponse(undefined, 'unknown-top-level-field');
  }
  return Object.freeze(Object.fromEntries(Object.keys(defaults).map((field) => [
    field,
    Object.hasOwn(parsed, field) ? parsed[field] : defaults[field],
  ])));
}

export function validateTutorResponse(rawText, context) {
  const parsed = normalizeTutorResponseEnvelope(parseTutorResponseText(rawText), context);
  assertSafeTree(parsed);
  const response = object(parsed);
  for (const field of TUTOR_PROVIDER_RESPONSE_SCHEMA.schema.required) requiredField(response, field);
  if (response.schemaVersion !== RESPONSE_SCHEMA_VERSION
    || response.policyVersion !== TUTOR_POLICY_VERSION
    || response.operation !== context.operation) throw invalidResponse(undefined, 'version-or-operation-mismatch', {
    validationPath: response.schemaVersion !== RESPONSE_SCHEMA_VERSION ? 'schemaVersion' : response.policyVersion !== TUTOR_POLICY_VERSION ? 'policyVersion' : 'operation',
    validationRule: 'enum',
    expectedType: 'string',
    actualType: valueType(response.schemaVersion !== RESPONSE_SCHEMA_VERSION ? response.schemaVersion : response.policyVersion !== TUTOR_POLICY_VERSION ? response.policyVersion : response.operation),
  });

  const evidence = object(response.evidence, 'evidence');
  requiredField(evidence, 'basis', 'evidence.basis');
  if (!TUTOR_EVIDENCE_BASES.includes(evidence.basis)) throw invalidResponse(undefined, 'invalid-evidence-basis', {
    validationPath: 'evidence.basis', validationRule: 'enum', expectedType: 'string', actualType: valueType(evidence.basis),
  });
  if (context.evidence.basis === 'static' && evidence.basis === 'runtime') throw invalidResponse(undefined, 'unsupported-runtime-claim');

  const sections = array(response.sections, TUTOR_RESPONSE_LIMITS.sectionCount, 'sections').map((item, index) => {
    const section = object(item, `sections.${index}`);
    return {
      title: string(requiredField(section, 'title', `sections.${index}.title`), TUTOR_RESPONSE_LIMITS.sectionTitle, { path: `sections.${index}.title` }),
      body: string(requiredField(section, 'body', `sections.${index}.body`), TUTOR_RESPONSE_LIMITS.sectionBody, { path: `sections.${index}.body` }),
    };
  });
  const codeReferences = array(response.codeReferences, TUTOR_RESPONSE_LIMITS.codeReferenceCount, 'codeReferences')
    .map((item) => lineReference(item, context));
  const concepts = array(response.concepts, TUTOR_RESPONSE_LIMITS.conceptCount, 'concepts').map((item, index) => {
    const concept = object(item, `concepts.${index}`);
    return {
      name: string(requiredField(concept, 'name', `concepts.${index}.name`), TUTOR_RESPONSE_LIMITS.conceptName, { path: `concepts.${index}.name` }),
      explanation: string(requiredField(concept, 'explanation', `concepts.${index}.explanation`), TUTOR_RESPONSE_LIMITS.conceptExplanation, { path: `concepts.${index}.explanation` }),
    };
  });
  const issues = array(response.issues, TUTOR_RESPONSE_LIMITS.issueCount, 'issues').map((item, index) => {
    const issue = object(item, `issues.${index}`);
    const hintLevel = Number(issue.hintLevel);
    if (!Number.isInteger(hintLevel) || hintLevel < 1 || hintLevel > context.hintLevel) throw invalidResponse(undefined, 'disallowed-hint-level');
    return {
      title: string(issue.title, TUTOR_RESPONSE_LIMITS.issueTitle),
      explanation: string(issue.explanation, TUTOR_RESPONSE_LIMITS.issueExplanation),
      hintLevel,
      ...(issue.codeReference ? { codeReference: lineReference(issue.codeReference, context, { explanation: false }) } : {}),
    };
  });
  const nextStep = object(response.nextStep, 'nextStep');
  requiredField(nextStep, 'kind', 'nextStep.kind');
  if (!TUTOR_NEXT_STEP_KINDS.includes(nextStep.kind)) throw invalidResponse(undefined, 'invalid-next-step-kind', {
    validationPath: 'nextStep.kind', validationRule: 'enum', expectedType: 'string', actualType: valueType(nextStep.kind),
  });

  return Object.freeze({
    schemaVersion: RESPONSE_SCHEMA_VERSION,
    policyVersion: TUTOR_POLICY_VERSION,
    operation: context.operation,
    evidence: Object.freeze({
      basis: evidence.basis,
      ...(evidence.note == null || evidence.note === '' ? {} : { note: string(evidence.note, TUTOR_RESPONSE_LIMITS.evidenceNote) }),
    }),
    summary: string(response.summary, TUTOR_RESPONSE_LIMITS.summary, { path: 'summary' }),
    sections: Object.freeze(sections.map(Object.freeze)),
    codeReferences: Object.freeze(codeReferences.map(Object.freeze)),
    concepts: Object.freeze(concepts.map(Object.freeze)),
    issues: Object.freeze(issues.map(Object.freeze)),
    nextStep: Object.freeze({
      kind: nextStep.kind,
      text: string(nextStep.text, TUTOR_RESPONSE_LIMITS.nextStepText, { required: nextStep.kind !== 'none', path: 'nextStep.text' }),
    }),
  });
}
