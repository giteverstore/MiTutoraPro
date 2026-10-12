import { normalizeContent } from '../../../shared/content/normalization.js';

export class PublishedContentDeliveryError extends Error {
  constructor(code, message) { super(message); this.name = 'PublishedContentDeliveryError'; this.code = code; }
}

export function adaptPublishedProject(project, contentVersion = null, metadata = {}) {
  if (!project?.projectId) return project;
  const migration = metadata.migration?.source === 'src/projects/catalog/cliTaskManagerProject.js' ? metadata.migration : null;
  const language = project.supportedLanguages[0];
  const starter = project.starterWorkspaces[language];
  return {
    ...project,
    contentVersion,
    id: project.projectId,
    slug: project.projectId,
    artwork: migration?.artwork,
    whatYouWillBuild: migration?.whatYouWillBuild ?? project.projectFacts?.[0],
    export: migration?.export ?? { repositoryName: project.projectId },
    languageContent: migration?.languageContent ?? {},
    language,
    learningObjectives: project.learningOutcomes,
    skills: project.tags ?? [],
    instructions: project.description,
    requirements: project.learningOutcomes,
    example: { input: '', output: '' },
    starterCode: starter.files.find(({ path }) => path === starter.entrypoint)?.content ?? '',
    template: null,
    languageOverrides: Object.fromEntries(Object.entries(project.starterWorkspaces).map(([languageId, workspace]) => [languageId, { ...(migration?.languageOverrides?.[languageId] ?? {}), entrypoint: workspace.entrypoint, defaultFiles: workspace.files, runtime: workspace.runtimeId }])),
    checkpoints: project.checkpoints.map((checkpoint) => ({ ...checkpoint, id: checkpoint.checkpointId, label: checkpoint.title, objective: checkpoint.summary, executionMode: migration?.checkpointModes?.[checkpoint.checkpointId] ?? 'run_or_terminal', guide: checkpoint.blocks, requirements: checkpoint.tasks.flatMap(({ blocks }) => blocks.filter(({ type }) => type === 'requirements').flatMap(({ items }) => items)) })),
  };
}

export class PublishedContentRepository {
  constructor({ fetcher = (...args) => globalThis.fetch(...args), legacyCatalog = null, endpoint = '/api/admin-content/public' } = {}) {
    this.fetcher = fetcher;
    this.legacyCatalog = legacyCatalog;
    this.endpoint = endpoint;
  }
  async listProjects() {
    const response = await this.fetcher(`${this.endpoint}?contentType=PROJECT`);
    if (!response.ok) throw new PublishedContentDeliveryError('content/catalog-failed', 'Published projects could not be loaded.');
    const payload = await response.json().catch(() => ({}));
    const records = Array.isArray(payload.items) ? payload.items : [];
    return Promise.all(records.map(async ({ contentId }) => { const { document } = await this.fetch(contentId); return adaptPublishedProject(document.content, document.version, document.metadata); }));
  }
  async resolveProject(projectId) {
    const published = await this.fetch(projectId).catch((error) => {
      if (error.code === 'content/not-published') return null;
      throw error;
    });
    if (published) return { source: 'published', contentVersion: published.document.version, document: published.document, project: adaptPublishedProject(published.document.content, published.document.version, published.document.metadata) };
    const legacy = this.legacyCatalog?.getProjectById(projectId) ?? null;
    return legacy ? { source: 'legacy', contentVersion: null, document: null, project: legacy } : null;
  }
  async resumeProject(projectId, contentVersion) {
    if (contentVersion == null) return this.resolveProject(projectId);
    const published = await this.fetch(projectId, contentVersion);
    return { source: 'published', contentVersion: published.document.version, document: published.document, project: adaptPublishedProject(published.document.content, published.document.version, published.document.metadata) };
  }
  async fetch(projectId, version) {
    const suffix = version == null ? '' : `/${encodeURIComponent(version)}`;
    const response = await this.fetcher(`${this.endpoint}/${encodeURIComponent(projectId)}${suffix}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new PublishedContentDeliveryError(payload.error?.code ?? 'content/delivery-failed', payload.error?.message ?? 'Published content could not be loaded.');
    try {
      const document = normalizeContent(payload.document);
      if (document.contentType !== 'PROJECT') throw new Error('Content type mismatch.');
      return { ...payload, document };
    }
    catch { throw new PublishedContentDeliveryError('content/artifact-corrupt', 'Published content could not be safely loaded.'); }
  }
}
