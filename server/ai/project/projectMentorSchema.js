import { AIServiceError } from '../AIServiceError.js';

const optionSchema = { type: 'object', additionalProperties: false, required: ['id', 'label', 'intent'], properties: { id: { type: 'string' }, label: { type: 'string' }, intent: { type: 'string' } } };
export const PROJECT_QUESTION_SCHEMA = Object.freeze({ name: 'ycoders_project_questions', strict: true, schema: { type: 'object', additionalProperties: false, required: ['operation', 'questions'], properties: { operation: { type: 'string', enum: ['project-questions'] }, questions: { type: 'array', minItems: 3, maxItems: 6, items: optionSchema } } } });
export const PROJECT_ANSWER_SCHEMA = Object.freeze({ name: 'ycoders_project_answer', strict: true, schema: { type: 'object', additionalProperties: false, required: ['operation', 'answer', 'followUps'], properties: { operation: { type: 'string', enum: ['project-answer'] }, answer: { type: 'string' }, followUps: { type: 'array', maxItems: 5, items: optionSchema } } } });

function invalid(reason, { path, rule = 'type', topLevelField } = {}, cause) {
  const error = new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502, cause });
  error.validationReason = reason;
  error.validationDiagnostic = Object.freeze({
    validationReason: reason,
    ...(path ? { validationPath: path } : {}),
    validationRule: rule,
    ...(topLevelField ? { topLevelField } : {}),
  });
  throw error;
}

function cleanOption(value, limit, reason, path, topLevelField) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) invalid(reason, { path, rule: typeof value === 'string' && value.length > limit ? 'maxLength' : 'type', topLevelField });
  return value.trim();
}

function options(value, min, max, field) {
  const prefix = field === 'followUps' ? 'followup' : 'question';
  if (value === undefined) invalid(`${field.toLowerCase()}-missing`, { path: field, rule: 'required', topLevelField: field });
  if (!Array.isArray(value)) invalid(`${field.toLowerCase()}-not-array`, { path: field, topLevelField: field });
  if (value.length < min) invalid(`${field.toLowerCase()}-too-few`, { path: field, rule: 'required', topLevelField: field });
  if (value.length > max) invalid(`${field.toLowerCase()}-too-many`, { path: field, rule: 'maxItems', topLevelField: field });
  const ids = new Set();
  return value.map((item, index) => {
    const reason = `${prefix}-invalid`;
    const option = {
      id: cleanOption(item?.id, 80, reason, `${field}.${index}.id`, field),
      label: cleanOption(item?.label, 240, reason, `${field}.${index}.label`, field),
      intent: cleanOption(item?.intent, 120, reason, `${field}.${index}.intent`, field),
    };
    if (ids.has(option.id)) invalid(`duplicate-${prefix}-id`, { path: `${field}.${index}.id`, rule: 'enum', topLevelField: field });
    ids.add(option.id);
    return Object.freeze(option);
  });
}

export function validateProjectMentorResponse(raw, operation) {
  let value;
  try { value = JSON.parse(raw); }
  catch (cause) { invalid('assistant-text-not-json', {}, cause); }
  if (value?.operation !== operation) invalid('operation-mismatch', { path: 'operation', rule: 'enum', topLevelField: 'operation' });
  if (operation === 'project-questions') return Object.freeze({ operation, questions: Object.freeze(options(value.questions, 3, 6, 'questions')) });
  if (typeof value.answer !== 'string') invalid('answer-missing', { path: 'answer', rule: 'required', topLevelField: 'answer' });
  if (!value.answer.trim()) invalid('answer-empty', { path: 'answer', rule: 'minLength', topLevelField: 'answer' });
  if (value.answer.length > 5_000) invalid('answer-too-long', { path: 'answer', rule: 'maxLength', topLevelField: 'answer' });
  return Object.freeze({ operation, answer: value.answer.trim(), followUps: Object.freeze(options(value.followUps, 0, 5, 'followUps')) });
}
