const DIRECT_ANSWER_PATTERNS = Object.freeze([
  /\b(?:just\s+)?give me (?:the\s+)?(?:answer|solution|complete code|full code)\b/iu,
  /\bshow me (?:the\s+)?(?:complete|full|finished|fixed) (?:answer|solution|code|program)\b/iu,
  /\bsolve it for me\b/iu,
  /\btell me exactly what to write\b/iu,
  /\bstop (?:giving|with) (?:me\s+)?hints\b/iu,
  /\bi (?:do not|don't) want (?:a\s+)?hint\b/iu,
]);
const CONVERSATIONAL_GLUE = /^(?:hi|hello|hey|thanks|thank you|got it|okay|ok)[!.\s]*$/iu;
export function requestsDirectAnswer(value) {
  const message = typeof value === 'string' ? value.trim() : '';
  return message.length > 0 && DIRECT_ANSWER_PATTERNS.some((pattern) => pattern.test(message));
}
export function isConversationalGlue(value) {
  return typeof value === 'string' && CONVERSATIONAL_GLUE.test(value.trim());
}
export function canHonorDirectAnswer(context) {
  // The shared endpoint serves lessons and practice. Its legacy/default trusted
  // policy is "unknown"; protected challenge/certification policies remain denied.
  return context?.directAnswerRequested === true && ['lesson', 'practice', 'unknown'].includes(context?.assessment?.activityType);
}
