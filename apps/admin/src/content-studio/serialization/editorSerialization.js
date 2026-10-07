import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES } from '../../../../../shared/content/index.js';
import { createDraftId } from '../blocks/blockDefinitions.js';

export function createEmptyEditorDocument() {
  return { documentId: createDraftId(), contentId: 'structured-document-draft', title: 'Untitled structured document', contentType: CONTENT_TYPES.COURSE, locale: 'en', schemaVersion: CONTENT_SCHEMA_VERSION, version: 1, supportedLanguages: ['python', 'java', 'cpp'], blocks: [] };
}

export function serializeEditorDocument(document) {
  return {
    contentId: document.contentId,
    contentType: document.contentType,
    schemaVersion: document.schemaVersion,
    version: document.version,
    status: 'draft',
    locale: document.locale,
    metadata: { draftDocumentId: document.documentId, editor: 'structured-document-v1' },
    content: { title: document.title, supportedLanguages: [...document.supportedLanguages], blocks: structuredClone(document.blocks) },
  };
}

export const stringifyEditorDocument = (document) => `${JSON.stringify(serializeEditorDocument(document), null, 2)}\n`;
