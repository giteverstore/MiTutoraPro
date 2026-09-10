import { createHash } from 'node:crypto';
import { failVerification } from './ActivityVerificationError.js';

export class AuthoritativeActivityResolver {
  constructor({ loadMetadata, loadContentBytes, loadVerificationDefinition }) {
    if (![loadMetadata, loadContentBytes, loadVerificationDefinition].every((entry) => typeof entry === 'function')) {
      throw new TypeError('AuthoritativeActivityResolver requires metadata, content, and private-test loaders.');
    }
    this.loadMetadata = loadMetadata;
    this.loadContentBytes = loadContentBytes;
    this.loadVerificationDefinition = loadVerificationDefinition;
  }

  async resolve({ activityType, activityId }) {
    const metadata = await this.loadMetadata({ activityType, activityId });
    if (!metadata) return null;
    const contentBytes = await this.loadContentBytes({ activityType, metadata });
    const bytes = Buffer.isBuffer(contentBytes) ? contentBytes : Buffer.from(contentBytes ?? '');
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (metadata.contentHash !== hash) {
      failVerification('activity-verification/content-integrity-failed', 'Authoritative activity integrity validation failed.', { status: 503 });
    }
    const verification = await this.loadVerificationDefinition({ activityType, metadata, contentBytes: bytes });
    return Object.freeze({
      activityType,
      id: metadata.id,
      version: metadata.version,
      language: metadata.language,
      published: metadata.published,
      contentHash: hash,
      verification,
    });
  }
}
