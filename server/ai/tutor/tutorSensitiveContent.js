import { AIServiceError } from '../AIServiceError.js';

const REDACTED = '[REDACTED]';
const PATTERNS = Object.freeze([
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
  /\b(?:sk-|hf_|gh[pousr]_)[A-Za-z0-9_-]{20,}\b/gu,
  /\bAKIA[0-9A-Z]{16}\b/gu,
  /\bAIza[0-9A-Za-z_-]{20,}\b/gu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/giu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu,
  /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/giu,
  /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"'\r\n]{8,}["']/giu,
]);

function redact(value) {
  let changed = false;
  let text = String(value ?? '');
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (match) => {
      if (/\b(?:YOUR[_-]|EXAMPLE[_-]|REPLACE[_-]?ME|CHANGE[_-]?ME|REDACTED)/iu.test(match)) return match;
      changed = true;
      return REDACTED;
    });
  }
  return { text, changed };
}

export function containsSensitiveContent(value) {
  return redact(value).changed;
}

export class TutorSensitiveContentInspector {
  inspect(context) {
    const code = redact(context.code);
    const selection = redact(context.selectedCode);
    if (code.changed || selection.changed) {
      throw new AIServiceError('ai/sensitive-content', 'Remove credentials or private information before asking the AI Tutor.', { status: 400 });
    }
    const output = redact(context.compilerOutput);
    const lesson = redact(context.lessonContext);
    return Object.freeze({
      ...context,
      compilerOutput: output.text,
      lessonContext: lesson.text,
      sensitiveContentRedacted: output.changed || lesson.changed,
    });
  }
}

export const tutorSensitiveContentInspector = new TutorSensitiveContentInspector();
