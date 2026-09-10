const ACTION_VARIANTS = Object.freeze(new Map([
  ...['replace', 'replaces', 'replaced', 'replacing', 'replacement'].map((token) => [token, 'replace']),
  ...['correct', 'corrects', 'corrected', 'correcting', 'correction'].map((token) => [token, 'correct']),
  ...['implement', 'implements', 'implemented', 'implementing', 'implementation'].map((token) => [token, 'implement']),
  ...['solve', 'solves', 'solved', 'solving', 'solution'].map((token) => [token, 'solve']),
  ...['answer', 'answers', 'answered', 'answering'].map((token) => [token, 'answer']),
  ...['complete', 'completes', 'completed', 'completing', 'completion'].map((token) => [token, 'complete']),
  ...['result', 'results', 'resulting'].map((token) => [token, 'result']),
]));

const SOLUTION_ACTIONS = new Set(['replace', 'correct', 'implement', 'solve', 'answer', 'complete']);
const IMPLEMENTATION_ACTIONS = new Set(['replace', 'correct', 'implement', 'solve', 'complete']);
const LEARNER_CODE_TARGETS = Object.freeze([
  ['your', 'code'], ['your', 'program'], ['your', 'implementation'], ['your', 'solution'],
  ['learner', 'code'], ['learner', 'program'], ['learner', 'implementation'],
  ['current', 'code'], ['current', 'program'], ['current', 'implementation'],
  ['code', 'you', 'wrote'], ['program', 'you', 'wrote'],
]);
const EXERCISE_TARGET_TOKENS = new Set(['exercise', 'problem', 'task']);
const IMPLEMENTATION_TARGET_TOKENS = new Set(['code', 'program', 'implementation', 'solution']);
const ANSWER_TARGET_TOKENS = new Set(['answer']);
const RESULT_TARGET_TOKENS = new Set(['answer', 'result', 'output', 'value']);
const FINAL_RESULT_MODIFIERS = new Set(['exact', 'expected', 'final']);

const DECISIVE_LITERAL = String.raw`(?:[-+]?\d+(?:\.\d+)?|true|false|none|null|"[^"\r\n]{1,80}"|'[^'\r\n]{1,80}')`;
const RESULT_DISCLOSURE_PATTERNS = Object.freeze([
  new RegExp(String.raw`\b(?:the\s+)?(?:final|exact|expected)\s+(?:answer|result|output|value)\s*(?:is|equals|should\s+be|:|=)\s*${DECISIVE_LITERAL}`, 'iu'),
  new RegExp(String.raw`\b(?:the\s+)?answer\s+(?:is|equals|should\s+be|:|=)\s*${DECISIVE_LITERAL}`, 'iu'),
  new RegExp(String.raw`\b(?:resulting\s+value|expected\s+output)\s+(?:is|equals|should\s+be|:|=)\s*${DECISIVE_LITERAL}`, 'iu'),
]);
const DECISIVE_CODE_LITERAL = new RegExp(
  String.raw`^\s*(?:return\s+|print\s*\(\s*|System\.out\.println\s*\(\s*|[A-Za-z_]\w*\s*=\s*)${DECISIVE_LITERAL}`,
  'iu',
);
const LITERAL_ONLY = new RegExp(String.raw`^\s*${DECISIVE_LITERAL}\s*[.!]?\s*$`, 'iu');
const PYTHON_CODE_LINE = /^\s*(?:def\s+\w+\s*\(|class\s+\w+|(?:from\s+\S+\s+)?import\s+\S+|if\s+.+:|elif\s+.+:|else\s*:|for\s+.+:|while\s+.+:|try\s*:|except\b.*:|with\s+.+:|return\b|raise\b|print\s*\(|[A-Za-z_]\w*\s*=)/u;
const JAVA_CODE_LINE = /^\s*(?:public|private|protected|static|final|class|interface|enum|record|package|import|return)\b|System\.(?:out|err)\.|;\s*$|[{}]\s*$/u;

function normalizedText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tokensFor(value) {
  const normalized = normalizedText(value);
  return normalized ? normalized.match(/[\p{L}\p{N}]+/gu) ?? [] : [];
}

function includesSequence(tokens, sequence) {
  if (sequence.length > tokens.length) return false;
  for (let index = 0; index <= tokens.length - sequence.length; index += 1) {
    if (sequence.every((token, offset) => tokens[index + offset] === token)) return true;
  }
  return false;
}

function fieldCategoryFor(fields, predicate, fallback = 'multiple-fields') {
  return fields.find(predicate)?.fieldCategory ?? fallback;
}

function codeLikeLines(text, language) {
  const matcher = language === 'java' ? JAVA_CODE_LINE : PYTHON_CODE_LINE;
  return String(text).split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && matcher.test(line));
}

function normalizedCodeLines(text) {
  return new Set(String(text ?? '').split(/\r?\n/u).map((line) => line.trim()).filter(Boolean));
}

function commentAndDocstringBodies(value) {
  const text = String(value ?? '');
  const bodies = [];
  for (const line of text.split(/\r?\n/u)) {
    const lineComment = line.match(/^\s*(?:#|\/\/)\s?(.*)$/u);
    if (lineComment?.[1]) bodies.push(lineComment[1]);
  }
  for (const pattern of [/\/\*([\s\S]*?)\*\//gu, /'''([\s\S]*?)'''/gu, /"""([\s\S]*?)"""/gu]) {
    for (const match of text.matchAll(pattern)) {
      const body = match[1].split(/\r?\n/u).map((line) => line.replace(/^\s*\*\s?/u, '')).join('\n').trim();
      if (body) bodies.push(body);
    }
  }
  return bodies;
}

function extractContextSignals(aggregateText) {
  const tokens = tokensFor(aggregateText);
  const actions = new Set(tokens.map((token) => ACTION_VARIANTS.get(token)).filter(Boolean));
  const learnerCodeTarget = LEARNER_CODE_TARGETS.some((sequence) => includesSequence(tokens, sequence));
  const currentExerciseTarget = tokens.some((token) => EXERCISE_TARGET_TOKENS.has(token));
  const implementationTarget = tokens.some((token) => IMPLEMENTATION_TARGET_TOKENS.has(token));
  const answerTarget = tokens.some((token) => ANSWER_TARGET_TOKENS.has(token));
  const expectedResultTarget = tokens.some((token) => FINAL_RESULT_MODIFIERS.has(token))
    && tokens.some((token) => RESULT_TARGET_TOKENS.has(token));
  const followingPayloadCue = includesSequence(tokens, ['the', 'following']) || tokens.includes('below');
  const solutionAction = [...actions].some((action) => SOLUTION_ACTIONS.has(action));
  const implementationAction = [...actions].some((action) => IMPLEMENTATION_ACTIONS.has(action));
  const resultAction = actions.has('result');
  const solutionIntent = solutionAction && (learnerCodeTarget || currentExerciseTarget || implementationTarget || answerTarget || followingPayloadCue);

  return Object.freeze({
    actions,
    learnerCodeTarget,
    currentExerciseTarget,
    implementationTarget,
    answerTarget,
    expectedResultTarget,
    followingPayloadCue,
    solutionAction,
    implementationAction,
    resultAction,
    solutionIntent,
  });
}

function extractPayloadSignals(fields, context) {
  if (!context || typeof context.code !== 'string' || !['python', 'java'].includes(context.language)) {
    return Object.freeze({ unavailable: true });
  }
  const submittedLines = normalizedCodeLines(context.code);
  const perField = fields.map((field) => {
    const codeLines = codeLikeLines(field.value, context.language);
    const novelCodeLines = codeLines.filter((line) => !submittedLines.has(line));
    const decisiveNovelCodeLines = novelCodeLines.filter((line) => DECISIVE_CODE_LITERAL.test(line));
    const commentBodies = commentAndDocstringBodies(field.value);
    const commentNovelCodeLines = commentBodies
      .flatMap((body) => codeLikeLines(body, context.language))
      .filter((line) => !submittedLines.has(line));
    const decisiveCommentLines = commentNovelCodeLines.filter((line) => DECISIVE_CODE_LITERAL.test(line));
    return Object.freeze({
      ...field,
      novelCodeLines,
      decisiveNovelCodeLines,
      commentNovelCodeLines,
      decisiveCommentLines,
      decisiveResult: RESULT_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(field.value)),
      literalOnly: LITERAL_ONLY.test(field.value),
    });
  });
  return Object.freeze({
    unavailable: false,
    perField: Object.freeze(perField),
    novelImplementation: perField.some((field) => field.novelCodeLines.length > 0),
    decisiveCode: perField.some((field) => field.decisiveNovelCodeLines.length > 0),
    commentImplementation: perField.some((field) => field.commentNovelCodeLines.length > 0),
    decisiveComment: perField.some((field) => field.decisiveCommentLines.length > 0),
    decisiveResult: perField.some((field) => field.decisiveResult),
    exactAnswer: perField.some((field) => field.literalOnly),
  });
}

const deny = (reasonCode, fieldCategory) => Object.freeze({ deny: true, reasonCode, fieldCategory });

function exactAnswerDisclosure(signals, payload) {
  if (payload.decisiveResult) {
    return deny('decisive-result-disclosure', fieldCategoryFor(payload.perField, (field) => field.decisiveResult));
  }
  if ((signals.solutionIntent || signals.answerTarget || signals.expectedResultTarget) && payload.exactAnswer) {
    return deny('cross-field-result-disclosure', 'multiple-fields');
  }
  return null;
}

function resultDisclosure(signals, payload) {
  if ((signals.expectedResultTarget || (signals.resultAction && signals.currentExerciseTarget))
    && (payload.exactAnswer || payload.decisiveCode)) {
    return deny('decisive-result-disclosure', payload.exactAnswer
      ? fieldCategoryFor(payload.perField, (field) => field.literalOnly)
      : fieldCategoryFor(payload.perField, (field) => field.decisiveNovelCodeLines.length > 0));
  }
  return null;
}

function commentDocstringDisclosure(signals, payload) {
  if (payload.decisiveComment || (signals.solutionIntent && payload.commentImplementation)) {
    return deny('comment-solution-disclosure', fieldCategoryFor(
      payload.perField,
      (field) => field.decisiveCommentLines.length > 0 || field.commentNovelCodeLines.length > 0,
    ));
  }
  return null;
}

function solutionImplementationDisclosure(signals, payload) {
  const directedAtLearner = signals.solutionAction && signals.learnerCodeTarget && payload.novelImplementation;
  const directedAtExercise = signals.solutionAction && signals.currentExerciseTarget && payload.decisiveCode;
  const implementationCompletion = signals.implementationAction
    && (signals.implementationTarget || signals.followingPayloadCue)
    && payload.decisiveCode;
  if (directedAtLearner || directedAtExercise || implementationCompletion) {
    return deny('solution-implementation-disclosure', fieldCategoryFor(
      payload.perField,
      (field) => field.novelCodeLines.length > 0,
    ));
  }
  return null;
}

export function inspectStructuredSolutionDisclosure(fields, context) {
  const aggregateText = fields.map((field) => field.value).filter(Boolean).join('\n');
  const signals = extractContextSignals(aggregateText);
  const payload = extractPayloadSignals(fields, context);
  if (payload.unavailable) {
    const containsPotentialPayload = fields.some((field) => /\b(?:return|print|System\.out|answer|output|result)\b/iu.test(field.value));
    return containsPotentialPayload
      ? Object.freeze({ state: 'UNKNOWN', reasonCode: 'solution-context-unavailable', fieldCategory: 'multiple-fields' })
      : Object.freeze({ state: 'ALLOW', reasonCode: 'no-solution-disclosure-signal', fieldCategory: 'none' });
  }

  const result = exactAnswerDisclosure(signals, payload)
    ?? resultDisclosure(signals, payload)
    ?? commentDocstringDisclosure(signals, payload)
    ?? solutionImplementationDisclosure(signals, payload);

  if (result) return Object.freeze({ state: 'DENY', reasonCode: result.reasonCode, fieldCategory: result.fieldCategory });

  // Runtime evidence is itself contextual evidence. Preserve the original R7 protection
  // for a bare decisive novel line without making evidence a prerequisite elsewhere.
  const evidenceDecisiveLine = payload.perField.find((field) => field.fieldCategory === 'evidence'
    && field.decisiveNovelCodeLines.length > 0);
  if (evidenceDecisiveLine) {
    return Object.freeze({ state: 'DENY', reasonCode: 'decisive-solution-line', fieldCategory: 'evidence' });
  }

  return Object.freeze({ state: 'ALLOW', reasonCode: 'no-solution-disclosure-signal', fieldCategory: 'none' });
}
