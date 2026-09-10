export const TUTOR_POLICY_VERSION = 'ai-tutor-v1';
export const RESPONSE_SCHEMA_VERSION = '1';
export const TUTOR_RESPONSE_SCHEMA_VERSION = RESPONSE_SCHEMA_VERSION;

export const TUTOR_REQUEST_TYPES = Object.freeze({
  explainSelection: 'explain-selection',
  explainFullCode: 'explain-full-code',
});

export const TUTOR_REQUEST_LIMITS = Object.freeze({
  totalBytes: 160_000,
  language: 40,
  code: 50_000,
  selectedCode: 20_000,
  compilerOutput: 12_000,
  compilerStatus: 40,
  lessonContext: 2_000,
  evidenceSource: 50_000,
  sourceHash: 64,
});

export const TUTOR_RESPONSE_LIMITS = Object.freeze({
  totalBytes: 64_000,
  summary: 600,
  evidenceNote: 500,
  sectionCount: 4,
  sectionTitle: 120,
  sectionBody: 4_000,
  codeReferenceCount: 6,
  codeReferenceExplanation: 1_000,
  conceptCount: 5,
  conceptName: 120,
  conceptExplanation: 1_500,
  issueCount: 5,
  issueTitle: 160,
  issueExplanation: 2_000,
  nextStepText: 1_000,
});

export const TUTOR_RESPONSE_TOKEN_BUDGETS = Object.freeze({
  simple: 350,
  moderate: 700,
  complex: 1_200,
});

export const DEFAULT_HINT_LEVEL = 1;
export const DEFAULT_ASSESSMENT_POLICY = Object.freeze({
  activityType: 'unknown',
  solutionPolicy: 'hints-only',
});

export const TUTOR_EVIDENCE_BASES = Object.freeze(['runtime', 'static', 'mixed']);
export const TUTOR_NEXT_STEP_KINDS = Object.freeze(['inspect', 'experiment', 'edit', 'run', 'none']);
