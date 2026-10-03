export const PROJECT_AI_SELECTION_TYPES = Object.freeze(['guide_text', 'guide_code', 'user_code', 'terminal_output']);
const clip = (value, limit) => { const text = String(value ?? '').trim(); return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`; };
function boundedSource(source, selectedContent, limit = 12_000) {
  const value = String(source ?? ''); if (value.length <= limit) return value;
  const match = selectedContent ? value.indexOf(selectedContent) : -1;
  const center = match >= 0 ? match + Math.floor(selectedContent.length / 2) : 0;
  const start = Math.max(0, Math.min(value.length - limit, center - Math.floor(limit / 2)));
  return `${start ? '/* …earlier content omitted… */\n' : ''}${value.slice(start, start + limit)}${start + limit < value.length ? '\n/* …later content omitted… */' : ''}`;
}
export function createProjectAIContext({ project, checkpoint, languageId, selectionType, selectedContent, guideContext = '', currentFile = null, terminal = null }) {
  if (!PROJECT_AI_SELECTION_TYPES.includes(selectionType)) throw new TypeError('Choose a supported project AI selection type.');
  const selection = clip(selectedContent, 8_000); if (selection.length < 2) throw new TypeError('Select meaningful content before asking AI.');
  const context = { project: { id: project.id, title: project.title, description: clip(project.description, 800), difficulty: project.difficulty, learningObjectives: (project.learningObjectives ?? []).slice(0, 8) }, checkpoint: { id: checkpoint.id, title: checkpoint.title ?? checkpoint.label, objective: clip(checkpoint.objective, 600), requirements: (checkpoint.requirements ?? []).slice(0, 12) }, languageId, selectionType, selectedContent: selection, guideContext: clip(guideContext, 2_000) };
  if (selectionType === 'user_code' && currentFile) context.currentFile = { path: currentFile.path, content: boundedSource(currentFile.content, selection) };
  if (selectionType === 'terminal_output' && terminal) context.terminal = { command: clip(terminal.command, 300), status: clip(terminal.status, 80), stream: terminal.stream === 'stderr' ? 'stderr' : 'stdout', recentOutput: boundedSource(terminal.recentOutput, selection, 6_000), ...(currentFile ? { currentFile: { path: currentFile.path, content: boundedSource(currentFile.content, '', 8_000) } } : {}) };
  return context;
}
