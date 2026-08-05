import { getBytes, getMetadata, ref } from 'firebase/storage';
import { auth } from '../../firebase/firebase';
import { storage } from '../../firebase/storage';
import { ContentCache, contentCache } from '../cache/ContentCache';
import { CONTENT_ERROR_CODES, ContentError, isContentError } from '../utils/ContentError';
import { parseJson } from '../../utils/parseJson';
import { normalizeStoragePath } from '../utils/contentPaths';

const MODULE_FIVE_STORAGE_PATH = 'course-content/python/v1/module-5.json';
const MODULE_FIVE_LOCAL_SHA256 = '35f551648b5d248e033402203e8f09d9e45ae148dc880a72909570b5c59612ef';

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

function logStorageError(error, storageReference) {
  if (!import.meta.env.DEV) return;
  console.error('[StorageContentLoader] Firebase Storage download failed.', {
    ...firebaseErrorDetails(error, storageReference),
    stack: error?.stack ?? null,
    originalError: error,
  });
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
  return new ContentError(CONTENT_ERROR_CODES.downloadFailed, 'The content could not be downloaded. Please try again.', {
    cause: error,
    details,
  });
}

function readTextRange(text, start, length) {
  let value = '';
  const firstIndex = Math.max(0, start);
  const endIndex = Math.min(text.length, firstIndex + length);
  for (let index = firstIndex; index < endIndex; index += 1) value += text[index];
  return value;
}

function findJsonErrorIndex(error, text) {
  const positionMatch = error?.message?.match(/position\s+(\d+)/i);
  if (positionMatch) return Number(positionMatch[1]);

  const locationMatch = error?.message?.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (!locationMatch) return null;
  const targetLine = Number(locationMatch[1]);
  const targetColumn = Number(locationMatch[2]);
  let line = 1;
  let column = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (line === targetLine && column === targetColumn) return index;
    if (text[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return text.length;
}

function logDecodedPayload(storageReference, byteArray, decodedText, remoteSize, getBytesReturnedUint8Array) {
  if (!import.meta.env.DEV) return;
  console.debug('[StorageContentLoader] Decoded JSON payload.', {
    storagePath: storageReference.fullPath,
    bucket: storageReference.bucket,
    getBytesReturnedUint8Array,
    byteLength: byteArray.byteLength,
    remoteFileSize: remoteSize,
    byteLengthMatchesRemoteSize: remoteSize === null ? null : byteArray.byteLength === remoteSize,
    decodedTextLength: decodedText.length,
    first100Characters: readTextRange(decodedText, 0, 100),
    last100Characters: readTextRange(decodedText, Math.max(0, decodedText.length - 100), 100),
    endsWithClosingBrace: decodedText.endsWith('}'),
  });
}

function logJsonParseError(error, storageReference, decodedText) {
  if (!import.meta.env.DEV) return;
  const characterIndex = findJsonErrorIndex(error, decodedText);
  console.error('[StorageContentLoader] JSON.parse failed.', {
    storagePath: storageReference.fullPath,
    characterIndex,
    parserMessage: error?.message ?? null,
    surrounding200Characters: characterIndex === null
      ? null
      : readTextRange(decodedText, characterIndex - 100, 200),
    stack: error?.stack ?? null,
    originalError: error,
  });
}

function bytesToHex(bytes) {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function findFirstDifferingByte(actual, expected) {
  const sharedLength = Math.min(actual.byteLength, expected.byteLength);
  for (let index = 0; index < sharedLength; index += 1) {
    if (actual[index] !== expected[index]) {
      return { offset: index, downloadedByte: actual[index], localByte: expected[index] };
    }
  }
  if (actual.byteLength === expected.byteLength) return null;
  return {
    offset: sharedLength,
    downloadedByte: actual[sharedLength] ?? null,
    localByte: expected[sharedLength] ?? null,
  };
}

function createDiagnosticUrl(content, type) {
  return URL.createObjectURL(new Blob([content], { type }));
}

async function diagnoseDownloadedBytes(path, byteArray) {
  if (!import.meta.env.DEV) return { hashMatches: false, decodedTextUrl: null };

  const byteDownloadUrl = createDiagnosticUrl(byteArray, 'application/json;charset=utf-8');
  const digest = await crypto.subtle.digest('SHA-256', byteArray);
  const sha256 = bytesToHex(new Uint8Array(digest));
  console.info('[StorageContentLoader] Downloaded byte diagnostics.', {
    storagePath: path,
    byteLength: byteArray.byteLength,
    sha256,
    byteDownloadUrl,
  });

  if (path !== MODULE_FIVE_STORAGE_PATH) return { hashMatches: false, decodedTextUrl: null };

  const hashMatches = sha256 === MODULE_FIVE_LOCAL_SHA256;
  if (!hashMatches) {
    try {
      const { default: localText } = await import(
        '../../../firebase-content/course-content/python/v1/module-5.json?raw'
      );
      const localBytes = new TextEncoder().encode(localText);
      console.error('[StorageContentLoader] Module 5 SHA-256 mismatch.', {
        expectedSha256: MODULE_FIVE_LOCAL_SHA256,
        downloadedSha256: sha256,
        firstDifference: findFirstDifferingByte(byteArray, localBytes),
        downloadedByteLength: byteArray.byteLength,
        localByteLength: localBytes.byteLength,
      });
    } catch (error) {
      console.error('[StorageContentLoader] Unable to load the local Module 5 diagnostic reference.', error);
    }
  } else {
    console.info('[StorageContentLoader] Module 5 SHA-256 matches the local file.', {
      sha256,
    });
  }

  return { hashMatches, decodedTextUrl: null };
}

export class StorageContentLoader {
  constructor({
    storageInstance = storage,
    cache = contentCache,
    downloadBytes = getBytes,
    loadMetadata = getMetadata,
  } = {}) {
    if (!(cache instanceof ContentCache)) throw new TypeError('StorageContentLoader requires a ContentCache instance.');
    this.storage = storageInstance;
    this.cache = cache;
    this.downloadBytes = downloadBytes;
    this.loadMetadata = loadMetadata;
  }

  async load(storagePath, { validate } = {}) {
    console.log('[TRACE] StorageContentLoader.load');
    const path = normalizeStoragePath(storagePath);
    return this.cache.getOrCreate(path, async () => {
      const storageReference = ref(this.storage, path);
      let bytes;
      try {
        if (import.meta.env.DEV) {
          console.debug('[StorageContentLoader] Starting Firebase Storage byte download.', {
            currentUser: auth.currentUser,
            uid: auth.currentUser?.uid,
            authReady: auth._isInitialized === true,
            storagePath: storageReference.fullPath,
          });
        }
        bytes = await this.downloadBytes(storageReference);
      } catch (error) {
        logStorageError(error, storageReference);
        throw mapStorageError(error, storageReference);
      }

      const getBytesReturnedUint8Array = bytes instanceof Uint8Array;
      const byteArray = getBytesReturnedUint8Array ? bytes : new Uint8Array(bytes);
      let remoteSize = null;
      if (import.meta.env.DEV) {
        try {
          remoteSize = Number((await this.loadMetadata(storageReference)).size);
        } catch (metadataError) {
          console.warn('[StorageContentLoader] Unable to read Storage metadata for size verification.', {
            storagePath: storageReference.fullPath,
            originalError: metadataError,
          });
        }
      }
      const decodedText = new TextDecoder('utf-8').decode(byteArray);
      let byteDiagnostics = { hashMatches: false };
      try {
        byteDiagnostics = await diagnoseDownloadedBytes(path, byteArray);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[StorageContentLoader] Byte diagnostics failed without interrupting content loading.', error);
        }
      }
      const decodedTextUrl = import.meta.env.DEV && byteDiagnostics.hashMatches
        ? createDiagnosticUrl(decodedText, 'text/plain;charset=utf-8')
        : null;
      logDecodedPayload(
        storageReference,
        byteArray,
        decodedText,
        remoteSize,
        getBytesReturnedUint8Array,
      );

      let parsed;
      try {
        parsed = parseJson(decodedText, import.meta.url);
      } catch (error) {
        if (decodedTextUrl) {
          console.error('[StorageContentLoader] Exact JSON.parse input is available for download.', {
            storagePath: path,
            decodedTextUrl,
          });
        }
        logJsonParseError(error, storageReference, decodedText);
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
    return this.cache.invalidate(normalizeStoragePath(storagePath));
  }

  clearCache() {
    this.cache.clear();
  }
}

export const storageContentLoader = new StorageContentLoader();
