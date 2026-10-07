import { randomUUID } from 'node:crypto';
import { ContentPublicationError } from './ContentPublicationError.js';

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const formats = Object.freeze({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' });
const bad = (message) => new ContentPublicationError('content/asset-invalid', message, { status: 400 });

function imageDimensions(bytes, extension) {
  if (extension === 'png') {
    if (bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR') throw bad('The PNG file is invalid.');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (extension === 'webp') {
    if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw bad('The WebP file is invalid.');
    const kind = bytes.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    if (kind === 'VP8L' && bytes[20] === 0x2f) return { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)) };
    if (kind === 'VP8 ' && bytes.toString('hex', 23, 26) === '9d012a') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    throw bad('The WebP image dimensions could not be verified.');
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw bad('The JPEG file is invalid.');
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) throw bad('The JPEG file is invalid.');
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const size = bytes.readUInt16BE(offset + 2);
    if (size < 2 || offset + 2 + size > bytes.length) throw bad('The JPEG file is invalid.');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (size < 7) throw bad('The JPEG file is invalid.');
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + size;
  }
  throw bad('The JPEG image dimensions could not be verified.');
}

export function validateAssetUpload(input) {
  const name = String(input?.name ?? '');
  const match = /^([a-z0-9][a-z0-9._ -]{0,119})\.([a-z]+)$/i.exec(name);
  if (!match) throw bad('Choose a PNG, JPEG, or WebP file with a simple filename.');
  const extension = match[2].toLowerCase();
  const mediaType = formats[extension];
  if (!mediaType || mediaType !== input.mediaType) throw bad('The file extension and media type must match PNG, JPEG, or WebP.');
  const encoded = String(input.data ?? '');
  if (!encoded || encoded.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4 + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw bad('The image must be valid base64 and no larger than 2 MiB.');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) throw bad('Images must be no larger than 2 MiB.');
  const { width, height } = imageDimensions(bytes, extension);
  if (!width || !height || width > 6000 || height > 6000 || width * height > 24_000_000) throw bad('Image dimensions must be at most 6000 pixels per side and 24 megapixels.');
  return { bytes, name: match[0], mediaType, extension: extension === 'jpeg' ? 'jpg' : extension, width, height };
}

export class AdminAssetService {
  constructor(registry, clock = () => new Date()) { this.registry = registry; this.clock = clock; }
  list(options) { return this.registry.list(options); }
  get(id) { return this.registry.get(id); }
  read(asset) { return this.registry.read(asset); }
  async upload(input, actor) {
    const image = validateAssetUpload(input);
    const assetId = `asset-${randomUUID()}`;
    return this.registry.create({ assetId, name: image.name, path: `admin-content-assets/${assetId}.${image.extension}`, mediaType: image.mediaType, size: image.bytes.length, width: image.width, height: image.height, createdAt: this.clock().toISOString(), createdBy: actor.uid, status: 'ACTIVE', source: 'admin-upload' }, image.bytes, actor);
  }
}
