import { CONTENT_ERROR_CODES, ContentError } from '../utils/ContentError';

export function requireMetadata(metadata, contentType, id) {
  if (metadata) return metadata;
  throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, `${contentType} metadata could not be found.`, {
    details: { id },
  });
}

export function requirePublished(metadata, contentType) {
  if (metadata.published) return metadata;
  throw new ContentError(CONTENT_ERROR_CODES.unpublished, `${contentType} is not currently published.`, {
    details: { id: metadata.id },
  });
}

export async function getNormalizedMetadata(repository, id, createModel, contentType, includeUnpublished = false) {
  const metadata = createModel(requireMetadata(await repository.getMetadata(id), contentType, id));
  return includeUnpublished ? metadata : requirePublished(metadata, contentType);
}

export async function listNormalizedMetadata(repository, createModel, { publishedOnly = true, query } = {}) {
  const descriptor = query ?? (publishedOnly ? { filters: [{ field: 'published', value: true }] } : undefined);
  return (await repository.listMetadata(descriptor)).map(createModel);
}
