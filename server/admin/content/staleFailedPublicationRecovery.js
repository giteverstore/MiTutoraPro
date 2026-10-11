import { ContentPublicationError } from './ContentPublicationError.js';

const preconditionFailed = () => new ContentPublicationError(
  'content/stale-publication-recovery-precondition',
  'The failed publication recovery preconditions no longer match.',
  { status: 409 },
);

export function assertStaleFailedPublicationRecovery({
  contentId, expectedRevision, expectedVersion, expectedActiveRevision,
  draft, pointer, version,
}) {
  const validation = draft?.validationSummary;
  const updatedAt = Date.parse(draft?.updatedAt ?? '');
  const validatedAt = Date.parse(validation?.validatedAt ?? '');
  // Saving a new draft revision clears validationSummary. Legacy summaries have
  // no validatedRevision field, so require validation to postdate that save.
  const validationMatchesRevision = (validation?.validatedRevision == null
    || validation.validatedRevision === expectedRevision)
    && Number.isFinite(updatedAt) && Number.isFinite(validatedAt) && validatedAt >= updatedAt;

  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1
    || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
    || !Number.isSafeInteger(expectedActiveRevision) || expectedActiveRevision < 0
    || draft?.contentId !== contentId
    || draft.contentType !== 'COURSE'
    || draft.draftRevision !== expectedRevision
    || draft.lifecycleState !== 'PUBLISHING'
    || draft.document?.content?.comingSoon !== true
    || validation?.valid !== true
    || !Array.isArray(validation.errors) || validation.errors.length !== 0
    || !Array.isArray(validation.warnings) || validation.warnings.length !== 0
    || !validationMatchesRevision
    || pointer?.contentId !== contentId
    || pointer.contentType !== 'COURSE'
    || pointer.latestVersion !== expectedVersion
    || pointer.activeRevision !== expectedActiveRevision
    || pointer.activeVersion != null
    || pointer.publicationStatus === 'ACTIVE'
    || version?.contentId !== contentId
    || version.contentType !== 'COURSE'
    || version.version !== expectedVersion
    || version.status !== 'FAILED'
    || version.sourceDraftRevision !== expectedRevision) {
    throw preconditionFailed();
  }
}
