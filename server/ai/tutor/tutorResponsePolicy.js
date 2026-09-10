import { AIServiceError } from '../AIServiceError.js';
import { canReleaseCompleteSolution } from './tutorActivityPolicy.js';
import { containsSensitiveContent } from './tutorSensitiveContent.js';
import { createTutorSystemInstruction } from './tutorPolicy.js';
import { inspectStructuredSolutionDisclosure } from './solutionDisclosureSignals.js';

const DIRECT_SOLUTION_LANGUAGE = /\b(?:here|below)\s+(?:is|are)\s+(?:the\s+)?(?:complete|completed|corrected|full|final|working)\s+(?:solution|code|program)|\b(?:the\s+)?(?:complete|completed|corrected|full|final|working)\s+(?:solution|code|program)\s+(?:is|follows)\b|\breplace\s+(?:your|the)\s+(?:code|program|solution)\s+with\b|\buse\s+the\s+following\s+(?:solution|code|program)\b/iu;
const FENCED_CODE = /```(?:python|py|java)?\s*([\s\S]*?)```/giu;
const PYTHON_CODE_LINE = /^\s*(?:def\s+\w+\s*\(|class\s+\w+|(?:from\s+\S+\s+)?import\s+\S+|if\s+.+:|elif\s+.+:|else\s*:|for\s+.+:|while\s+.+:|try\s*:|except\b.*:|with\s+.+:|return\b|raise\b|print\s*\(|[A-Za-z_]\w*\s*=)/u;
const JAVA_CODE_LINE = /^\s*(?:public|private|protected|static|final|class|interface|enum|record|package|import)\b|System\.(?:out|err)\.|;\s*$|[{}]\s*$/u;

const INSPECTOR_STATE = Object.freeze({ ALLOW: 'ALLOW', DENY: 'DENY', UNKNOWN: 'UNKNOWN' });
const REQUIRED_INSPECTORS = Object.freeze(['sensitive-output', 'protected-instruction-overlap', 'complete-solution', 'solution-disclosure']);
const SERVER_METADATA_PATHS = Object.freeze([
  /^schemaVersion$/u,
  /^policyVersion$/u,
  /^operation$/u,
  /^evidence\.basis$/u,
  /^nextStep\.kind$/u,
]);
const RENDERED_FIELD_CATEGORIES = Object.freeze([
  [/^summary$/u, 'summary'],
  [/^evidence\.note$/u, 'evidence'],
  [/^sections\.\d+\.(?:title|body)$/u, 'section'],
  [/^codeReferences\.\d+\.explanation$/u, 'code-reference'],
  [/^concepts\.\d+\.(?:name|explanation)$/u, 'concept'],
  [/^issues\.\d+\.(?:title|explanation)$/u, 'issue'],
  [/^nextStep\.text$/u, 'next-step'],
]);

const decision = (allowed, reasonCode, fieldCategory, inspector) => Object.freeze({
  allowed, reasonCode, fieldCategory, inspector,
});

const DISCLOSURE_CLASS_BY_REASON = Object.freeze({
  'solution-implementation-disclosure': 'solution-implementation-disclosure',
  'decisive-solution-line': 'solution-implementation-disclosure',
  'decisive-result-disclosure': 'result/compiler-output-disclosure',
  'cross-field-result-disclosure': 'exact-answer-disclosure',
  'comment-solution-disclosure': 'comment/docstring-solution-disclosure',
});

function observeInspector(observer, inspector, state, reasonCode = 'none') {
  if (typeof observer !== 'function') return;
  try {
    observer(Object.freeze({
      inspector,
      executed: true,
      decision: Object.values(INSPECTOR_STATE).includes(state) ? state.toLocaleLowerCase('en-US') : 'unknown',
      class: inspector === 'solution-disclosure' ? DISCLOSURE_CLASS_BY_REASON[reasonCode] ?? 'none' : 'none',
    }));
  } catch {
    // Evaluation-only observation must never alter the production policy decision.
  }
}

function categoryForPath(path) {
  return RENDERED_FIELD_CATEGORIES.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}

function renderedFields(response) {
  const fields = [];
  let unknown = null;
  const visit = (value, path = '') => {
    if (unknown || value == null) return;
    if (typeof value === 'string') {
      if (SERVER_METADATA_PATHS.some((pattern) => pattern.test(path))) return;
      const fieldCategory = categoryForPath(path);
      if (!fieldCategory) {
        unknown = Object.freeze({ fieldCategory: 'unknown' });
        return;
      }
      fields.push(Object.freeze({ value, fieldCategory }));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${index}`));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => visit(item, path ? `${path}.${key}` : key));
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return;
    unknown = Object.freeze({ fieldCategory: 'unknown' });
  };
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return Object.freeze({ fields: Object.freeze([]), unknown: Object.freeze({ fieldCategory: 'unknown' }) });
  }
  visit(response);
  return Object.freeze({ fields: Object.freeze(fields), unknown });
}

function normalizedTokens(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function protectedFragments(context) {
  return createTutorSystemInstruction(context)
    .split(/\r?\n/u)
    .map((line) => normalizedTokens(line))
    .filter((tokens) => tokens.length >= 6 || tokens.join(' ') === 'security and trust boundary');
}

function substantialProtectedOverlap(fieldValue, fragments) {
  const fieldTokens = normalizedTokens(fieldValue);
  if (fieldTokens.length === 0) return false;
  const fieldSet = new Set(fieldTokens);
  return fragments.some((fragment) => {
    const protectedSet = new Set(fragment);
    const overlap = [...protectedSet].filter((token) => fieldSet.has(token)).length;
    const required = protectedSet.size <= 5 ? protectedSet.size : Math.max(8, Math.ceil(protectedSet.size * 0.8));
    return overlap >= required;
  });
}

function codeLikeLines(text, language) {
  const matcher = language === 'java' ? JAVA_CODE_LINE : PYTHON_CODE_LINE;
  return String(text).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && matcher.test(line));
}

function normalizedCodeLines(text) {
  return new Set(String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
}

const sensitiveOutputInspector = Object.freeze({
  name: 'sensitive-output',
  inspect({ fields }) {
    const unsafe = fields.find((field) => containsSensitiveContent(field.value));
    return unsafe
      ? Object.freeze({ state: INSPECTOR_STATE.DENY, reasonCode: 'sensitive-output', fieldCategory: unsafe.fieldCategory })
      : Object.freeze({ state: INSPECTOR_STATE.ALLOW, reasonCode: 'sensitive-output-safe', fieldCategory: 'none' });
  },
});

const protectedInstructionInspector = Object.freeze({
  name: 'protected-instruction-overlap',
  inspect({ fields, context }) {
    // This detects server-owned verbatim/substantial lexical overlap. It intentionally
    // does not claim to detect every semantic paraphrase of protected instructions.
    const fragments = protectedFragments(context);
    const unsafe = fields.find((field) => substantialProtectedOverlap(field.value, fragments));
    if (unsafe) return Object.freeze({ state: INSPECTOR_STATE.DENY, reasonCode: 'protected-instruction-overlap', fieldCategory: unsafe.fieldCategory });
    if (substantialProtectedOverlap(fields.map((field) => field.value).join('\n'), fragments)) {
      return Object.freeze({ state: INSPECTOR_STATE.DENY, reasonCode: 'protected-instruction-overlap', fieldCategory: 'multiple-fields' });
    }
    return Object.freeze({ state: INSPECTOR_STATE.ALLOW, reasonCode: 'protected-instructions-safe', fieldCategory: 'none' });
  },
});

const completeSolutionInspector = Object.freeze({
  name: 'complete-solution',
  inspect({ fields, context }) {
    if (canReleaseCompleteSolution(context.assessment, context.hintLevel)) {
      return Object.freeze({ state: INSPECTOR_STATE.ALLOW, reasonCode: 'trusted-complete-solution-policy', fieldCategory: 'none' });
    }
    const text = fields.map((field) => field.value).filter(Boolean).join('\n');
    const submittedLines = normalizedCodeLines(context.code);
    const allCodeLines = codeLikeLines(text, context.language);
    const novelCodeLines = allCodeLines.filter((line) => !submittedLines.has(line));
    const hasDirectSolutionLanguage = DIRECT_SOLUTION_LANGUAGE.test(text);
    const fencedBlocks = [...text.matchAll(FENCED_CODE)].map((match) => match[1]);
    const hasSolutionShapedFence = fencedBlocks.some((block) => {
      const lines = codeLikeLines(block, context.language);
      const novel = lines.filter((line) => !submittedLines.has(line));
      return novel.length >= 2 || (novel.length >= 1 && /\b(?:def|class|static\s+void\s+main|return)\b/u.test(block));
    });
    const sourceLineCount = Math.max(1, normalizedCodeLines(context.code).size);
    const replacementCoverage = novelCodeLines.length >= Math.max(4, Math.ceil(sourceLineCount * 0.6));
    if (hasSolutionShapedFence || replacementCoverage || (hasDirectSolutionLanguage && novelCodeLines.length > 0)) {
      const field = fields.find((item) => codeLikeLines(item.value, context.language).some((line) => !submittedLines.has(line)));
      return Object.freeze({
        state: INSPECTOR_STATE.DENY,
        reasonCode: hasSolutionShapedFence ? 'solution-shaped-fence' : 'complete-replacement',
        fieldCategory: field?.fieldCategory ?? 'response',
      });
    }
    return Object.freeze({ state: INSPECTOR_STATE.ALLOW, reasonCode: 'no-complete-solution-signal', fieldCategory: 'none' });
  },
});

const solutionDisclosureInspector = Object.freeze({
  name: 'solution-disclosure',
  inspect({ fields, context }) {
    if (canReleaseCompleteSolution(context.assessment, context.hintLevel)) {
      return Object.freeze({ state: INSPECTOR_STATE.ALLOW, reasonCode: 'trusted-complete-solution-policy', fieldCategory: 'none' });
    }

    return inspectStructuredSolutionDisclosure(fields, context);
  },
});

const DEFAULT_INSPECTORS = Object.freeze([
  sensitiveOutputInspector,
  protectedInstructionInspector,
  completeSolutionInspector,
  solutionDisclosureInspector,
]);

export class TutorResponseReleasePolicy {
  constructor({ inspectors = DEFAULT_INSPECTORS } = {}) {
    this.inspectors = Object.freeze([...inspectors]);
  }

  evaluate(response, context, { inspectorObserver } = {}) {
    const fieldResult = renderedFields(response);
    if (fieldResult.unknown) {
      return decision(false, 'unknown-response-field', fieldResult.unknown.fieldCategory, 'response-field-coverage');
    }
    const available = new Map(this.inspectors.map((inspector) => [inspector?.name, inspector]));
    for (const required of REQUIRED_INSPECTORS) {
      if (!available.has(required)) return decision(false, 'missing-inspector', 'response', required);
    }
    for (const inspectorName of REQUIRED_INSPECTORS) {
      const inspector = available.get(inspectorName);
      let result;
      try {
        result = inspector.inspect({ fields: fieldResult.fields, response, context });
      } catch {
        observeInspector(inspectorObserver, inspectorName, INSPECTOR_STATE.UNKNOWN, 'inspector-error');
        return decision(false, 'inspector-error', 'response', inspectorName);
      }
      if (!result || !Object.values(INSPECTOR_STATE).includes(result.state)) {
        observeInspector(inspectorObserver, inspectorName, INSPECTOR_STATE.UNKNOWN, 'inspector-invalid-result');
        return decision(false, 'inspector-invalid-result', 'response', inspectorName);
      }
      observeInspector(inspectorObserver, inspectorName, result.state, result.reasonCode);
      if (result.state === INSPECTOR_STATE.UNKNOWN) {
        return decision(false, result.reasonCode || 'inspector-unknown', result.fieldCategory || 'response', inspectorName);
      }
      if (result.state === INSPECTOR_STATE.DENY) {
        return decision(false, result.reasonCode || 'inspector-denied', result.fieldCategory || 'response', inspectorName);
      }
    }
    return decision(true, 'response-safe', 'none', 'all');
  }

  assertReleasable(response, context) {
    const result = this.evaluate(response, context);
    if (!result.allowed) {
      const error = new AIServiceError(
        'ai/unsafe-response',
        'The AI Tutor response could not be safely shown. Try asking for a conceptual hint.',
        { status: 422 },
      );
      error.releaseReason = result.reasonCode;
      error.releaseDecision = result;
      throw error;
    }
    return response;
  }
}

export const tutorResponseReleasePolicy = new TutorResponseReleasePolicy();
