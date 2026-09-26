import { MySqlExecutionError } from './MySqlExecutionError.js';

const CONTENT_TYPES = new Set(['course', 'practice', 'challenge']);
const CONTENT_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/;

export function validateMySqlContentReference({ contentId, contentType } = {}) {
  if (!CONTENT_TYPES.has(contentType) || !CONTENT_ID.test(String(contentId ?? ''))) {
    throw new MySqlExecutionError('mysql/invalid-content-reference', 'A valid canonical MySQL content reference is required.', { status: 400 });
  }
  return Object.freeze({ contentId, contentType });
}

export class MySqlCanonicalSetupResolver {
  constructor({ contentSource } = {}) { this.contentSource = contentSource; }

  async resolve(reference) {
    const validated = validateMySqlContentReference(reference);
    if (!this.contentSource?.getMySqlExecutionDefinition) {
      throw new MySqlExecutionError('mysql/content-source-unavailable', 'Canonical MySQL exercise content is not configured.', { status: 503 });
    }
    const definition = await this.contentSource.getMySqlExecutionDefinition(validated);
    if (!definition || definition.language !== 'mysql') {
      throw new MySqlExecutionError('mysql/content-not-found', 'The requested MySQL exercise is unavailable.', { status: 404 });
    }
    return Object.freeze({
      setupSql: String(definition.setupSql ?? ''),
      canonicalId: String(definition.canonicalId ?? validated.contentId),
      contentHash: definition.contentHash ? String(definition.contentHash) : null,
    });
  }
}

export const unconfiguredMySqlSetupResolver = new MySqlCanonicalSetupResolver();
