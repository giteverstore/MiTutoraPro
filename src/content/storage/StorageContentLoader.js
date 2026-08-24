import { getBytes, ref } from 'firebase/storage';
import { storage } from '../../firebase/storage';
import { ContentCache, contentCache } from '../cache/ContentCache';
import { CONTENT_ERROR_CODES, ContentError, isContentError } from '../utils/ContentError';
import { normalizeStoragePath } from '../utils/contentPaths';
import { isSha256, verifyContentIntegrity } from '../utils/contentIntegrity';
import { CONTENT_LIMITS } from '../validation/contentLimits';

function assertJsonStructure(value, path) {
  if (value === null || typeof value !== 'object') {
    throw new ContentError(CONTENT_ERROR_CODES.malformedJson, 'The downloaded content is not a JSON object or array.', {
      details: { storagePath: path },
    });
  }
  return value;
}

function firebaseErrorDetails(error, storageReference) {
  return {
    storagePath: storageReference.fullPath,
    bucket: storageReference.bucket,
    firebaseCode: error?.code ?? null,
    firebaseMessage: error?.message ?? null,
    httpStatus: error?.status_ ?? error?.status ?? null,
    serverResponse: error?.customData?.serverResponse ?? null,
  };
}

function mapStorageError(error, storageReference) {
  if (isContentError(error)) return error;
  const details = firebaseErrorDetails(error, storageReference);
  if (error?.code === 'storage/object-not-found') {
    return new ContentError(CONTENT_ERROR_CODES.storageObjectMissing, 'The requested content file could not be found.', {
      cause: error,
      details,
    });
  }
  if (error?.code === 'storage/max-download-size-exceeded') {
    return new ContentError(CONTENT_ERROR_CODES.sizeExceeded, 'The requested content is larger than the supported safety limit.', { cause: error, details });
  }
  if (error?.code === 'storage/retry-limit-exceeded' || error?.name === 'AbortError' || /timed?\s*out/i.test(error?.message ?? '')) {
    return new ContentError(CONTENT_ERROR_CODES.networkTimeout, 'The content request timed out. Please retry.', { cause: error, details });
  }
  return new ContentError(CONTENT_ERROR_CODES.downloadFailed, 'The content could not be downloaded. Please try again.', {
    cause: error,
    details,
  });
}

export class StorageContentLoader {
  constructor({
    storageInstance = storage,
    cache = contentCache,
    downloadBytes = getBytes,
  } = {}) {
    if (!(cache instanceof ContentCache)) throw new TypeError('StorageContentLoader requires a ContentCache instance.');
    this.storage = storageInstance;
    this.cache = cache;
    this.downloadBytes = downloadBytes;
  }

  async load(storagePath, { validate, expectedHash, maxBytes = CONTENT_LIMITS.runtime.maxCourseDownloadBytes } = {}) {
    const path = normalizeStoragePath(storagePath);
    const normalizedHash = expectedHash ? String(expectedHash).toLowerCase() : null;
    if (normalizedHash && !isSha256(normalizedHash)) {
      throw new ContentError(CONTENT_ERROR_CODES.integrityFailed, 'The published content integrity information is invalid.', { details: { storagePath: path } });
    }
    const cacheKey = normalizedHash ? `${path}#sha256:${normalizedHash}` : path;
    return this.cache.getOrCreate(cacheKey, async () => {
      const storageReference = ref(this.storage, path);
      let bytes;
      try {
        bytes = await this.downloadBytes(storageReference, maxBytes);
      } catch (error) {
        throw mapStorageError(error, storageReference);
      }

      const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (normalizedHash) {
        await verifyContentIntegrity(byteArray, normalizedHash, path);
      }
      const decodedText = new TextDecoder('utf-8').decode(byteArray);
      let parsed;
      try {
        parsed = JSON.parse(decodedText);
      } catch (error) {
        throw new ContentError(CONTENT_ERROR_CODES.malformedJson, 'The downloaded content contains malformed JSON.', {
          cause: error,
          details: { storagePath: path },
        });
      }
      assertJsonStructure(parsed, path);
      if (validate) {
        try {
          if (validate(parsed) === false) throw new Error('Content validation returned false.');
        } catch (error) {
          throw new ContentError(
            CONTENT_ERROR_CODES.malformedJson,
            'The downloaded content does not have the expected structure.',
            { cause: error, details: { storagePath: path } },
          );
        }
      }
      return parsed;
    });
  }

  invalidate(storagePath) {
    const path = normalizeStoragePath(storagePath);
    return this.cache.invalidateMatching((key) => key === path || key.startsWith(`${path}#sha256:`));
  }

  clearCache() {
    this.cache.clear();
  }
}

export const storageContentLoader = new StorageContentLoader();
