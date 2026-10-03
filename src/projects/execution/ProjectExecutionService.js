import { diffProjectFileSnapshots, normalizeProjectFileSnapshot, serializeProjectFiles } from './projectFilesystem.js';

export class ProjectExecutionService {
  constructor(compilerManager) { this.compilerManager = compilerManager; }
  async execute(request) {
    const files = normalizeProjectFileSnapshot(request.files);
    const entrypoint = request.entrypoint;
    if (!files[entrypoint]) throw new TypeError(`Project entrypoint is missing: ${entrypoint}`);
    const result = await this.compilerManager.execute({
      language: request.languageId, source: files[entrypoint].content, filename: entrypoint,
      stdin: request.stdin ?? '', timeoutMs: request.timeoutMs, signal: request.signal,
      instanceId: request.instanceId ?? `project-${request.projectId}`,
      execution: { ...(request.execution ?? {}), projectId: request.projectId, command: request.runCommand, buildCommand: request.buildCommand },
      projectFiles: serializeProjectFiles(files), entrypoint,
    });
    const resultingFiles = result.projectFiles ? normalizeProjectFileSnapshot(result.projectFiles) : files;
    return { ...result, projectFiles: resultingFiles, fileMutations: diffProjectFileSnapshots(files, resultingFiles), filesystemSupported: result.filesystemSupported === true };
  }
}
