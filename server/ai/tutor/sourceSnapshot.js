import { createHash } from 'node:crypto';

export function createSourceSnapshotHash(source) {
  return createHash('sha256').update(String(source), 'utf8').digest('hex');
}
