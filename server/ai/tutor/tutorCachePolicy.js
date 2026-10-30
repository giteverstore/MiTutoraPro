import { createHash } from 'node:crypto';
import { RESPONSE_SCHEMA_VERSION, TUTOR_POLICY_VERSION } from './tutorConfig.js';

export function normalizeExactTutorQuestion(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[?!.]+$/u, '').replace(/\(\)/gu, '').replace(/\s+/gu, ' ');
}

export function classifyTutorCacheEligibility(body = {}, scope = {}) {
  const question = String(body.learnerMessage ?? body.question?.label ?? '').trim();
  const code = String(body.code ?? body.context?.currentFile?.content ?? '').trim();
  const selected = String(body.selectedCode ?? body.context?.selectedContent ?? '').trim();
  const compiler = body.compilerEvidence || body.compilerOutput || body.context?.terminal;
  const conversation = body.conversation;
  const direct = /(?:give|show|write|provide)\s+(?:me\s+)?(?:the\s+)?(?:full|complete|entire|exact)?\s*(?:answer|solution|code)/iu.test(question);
  const followUp = /^(?:why|how|what)\s+(?:does|did)\s+(?:that|this)|(?:i still|again|explain that|what about)/iu.test(question);
  const conceptual = /^(?:what\s+(?:is|are|does)|why\s+does|explain\s+(?:the\s+)?(?:concept|meaning))/iu.test(question)
    && !/\b(?:my|this|that|code|error|fail|output|above|selected)\b/iu.test(question);
  const codeDependent = Boolean(code) && !conceptual;
  const eligible = scope.surface !== 'project' && question.length >= 3 && !codeDependent && !selected && !compiler
    && (!Array.isArray(conversation) || conversation.length === 0) && !direct && !followUp;
  return Object.freeze({ eligible, normalizedQuestion: eligible ? normalizeExactTutorQuestion(question) : '', reason: eligible ? 'exact' : 'none' });
}

export function createExactTutorCacheKey({ scope, language = '', normalizedQuestion }) {
  const identity = [scope.surface, scope.scopeId, scope.activityId, scope.contentSource ?? 'admin', typeof scope.contentVersion, scope.contentVersion, language, normalizedQuestion, TUTOR_POLICY_VERSION, RESPONSE_SCHEMA_VERSION].join('\0');
  return createHash('sha256').update(identity).digest('hex');
}
