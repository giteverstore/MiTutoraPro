import { CONTENT_ERROR_CODES, ContentError } from '../utils/ContentError';
import { normalizeStoragePath } from '../utils/contentPaths';

export function requireMetadataObject(value, type) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentError(CONTENT_ERROR_CODES.invalidMetadata, `${type} metadata is invalid.`);
  }
  return value;
}

export function requiredString(value, field, type) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new ContentError(CONTENT_ERROR_CODES.invalidMetadata, `${type} metadata requires ${field}.`, {
      details: { field },
    });
  }
  return normalized;
}

export function optionalString(value) {
  return String(value ?? '').trim();
}

export function nonNegativeNumber(value, field, type) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new ContentError(CONTENT_ERROR_CODES.invalidMetadata, `${type} metadata requires a valid ${field}.`, {
      details: { field },
    });
  }
  return normalized;
}

export function positiveVersion(value, type) {
  const normalized = requiredString(value, 'version', type);
  return normalized;
}

export function metadataStoragePath(value, type) {
  try {
    return normalizeStoragePath(requiredString(value, 'storagePath', type));
  } catch (error) {
    if (error instanceof ContentError) throw error;
    throw new ContentError(CONTENT_ERROR_CODES.invalidMetadata, `${type} metadata has an invalid storagePath.`, {
      cause: error,
      details: { field: 'storagePath' },
    });
  }
}
