const LIMITS = { summary: 600, sections: 4, sectionTitle: 120, sectionBody: 4000, references: 6, concepts: 5, issues: 5, nextStep: 1000 };
const bases = new Set(['runtime', 'static', 'mixed']);
const steps = new Set(['inspect', 'experiment', 'edit', 'run', 'none']);
const text = (value, limit, optional = false) => typeof value === 'string' && value.length <= limit && (optional || value.trim());
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const reference = (item, explanationRequired = true) => object(item) && Number.isInteger(item.startLine) && Number.isInteger(item.endLine) && item.startLine >= 1 && item.endLine >= item.startLine && (!explanationRequired || text(item.explanation, 1000));

export function validateAITutorResponse(value) {
  if (!object(value) || value.schemaVersion !== '1' || value.policyVersion !== 'ai-tutor-v1') return false;
  if (!['explain-selection', 'explain-full-code'].includes(value.operation) || !text(value.summary, LIMITS.summary)) return false;
  if (!object(value.evidence) || !bases.has(value.evidence.basis) || (value.evidence.note != null && !text(value.evidence.note, 500, true))) return false;
  if (!Array.isArray(value.sections) || value.sections.length > LIMITS.sections || value.sections.some((item) => !object(item) || !text(item.title, LIMITS.sectionTitle) || !text(item.body, LIMITS.sectionBody))) return false;
  if (!Array.isArray(value.codeReferences) || value.codeReferences.length > LIMITS.references || value.codeReferences.some((item) => !reference(item))) return false;
  if (!Array.isArray(value.concepts) || value.concepts.length > LIMITS.concepts || value.concepts.some((item) => !object(item) || !text(item.name, 120) || !text(item.explanation, 1500))) return false;
  if (!Array.isArray(value.issues) || value.issues.length > LIMITS.issues || value.issues.some((item) => !object(item) || !text(item.title, 160) || !text(item.explanation, 2000) || !Number.isInteger(item.hintLevel) || item.hintLevel < 1 || item.hintLevel > 5 || (item.codeReference != null && !reference(item.codeReference, false)))) return false;
  if (!object(value.nextStep) || !steps.has(value.nextStep.kind) || !text(value.nextStep.text, LIMITS.nextStep, value.nextStep.kind === 'none')) return false;
  return true;
}
