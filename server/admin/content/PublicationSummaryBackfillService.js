import { publicContentSummary } from './publicContentSummary.js';

const stable = (value) => JSON.stringify(value);

export class PublicationSummaryBackfillService {
  constructor({ store, delivery }) { this.store = store; this.delivery = delivery; }

  async run({ dryRun = true, contentType = null } = {}) {
    const counts = { inspected: 0, missing: 0, changed: 0, unchanged: 0 };
    const pointers = [];
    let cursor = null;
    do {
      const page = await this.store.listPointers({ limit: 25, cursor });
      pointers.push(...page.items.filter((pointer) => !contentType || pointer.contentType === contentType));
      cursor = page.nextCursor;
    } while (cursor);
    for (const pointer of pointers) {
      const versions = await this.store.listVersions(pointer.contentId);
      for (const version of versions.filter(({ status }) => status === 'READY')) {
        counts.inspected += 1;
        if (version.metadataSnapshot?.summaryVersion !== 1) counts.missing += 1;
        const publication = await this.delivery.fetchVersion(pointer.contentId, version.version);
        const summary = publicContentSummary(publication.document);
        if (stable(summary) === stable(version.metadataSnapshot ?? {})) { counts.unchanged += 1; continue; }
        counts.changed += 1;
        if (!dryRun) await this.store.updateVersionSummary(pointer.contentId, version.version, summary);
      }
    }
    return { dryRun, ...counts };
  }
}
