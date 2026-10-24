# AI Tutor server data

AI Tutor state uses the existing `ai-tutor-quota` Firestore database through the server runtime and request-scoped WIF client. Browser clients never receive Firestore paths or credentials.

Collections:

- `aiTutorIncludedUsage`: pseudonymous HMAC owner key, consumed and reserved included-message counts.
- `aiTutorIncludedReservations`: idempotent request reservation state; reservation records carry a seven-day expiry field for operational cleanup.
- `aiTutorConversations`: Course or Project thread metadata keyed by pseudonymous owner, surface, and canonical scope.
- `aiTutorConversations/{thread}/messages`: chronological user/assistant messages with canonical activity and content-version lineage.
- `aiTutorPracticeInteractions`: backend-only structured Practice interaction metadata. It is not exposed by the history API.
- `aiTutorExactCache`: identity-free validated Tutor responses keyed by canonical scope/activity/version, language, normalized exact question, policy version, and response-contract version.

History queries order a thread's message subcollection by `createdAt`; the standard single-field index is sufficient. No broad learner Firestore rules or composite indexes are required because all access is server-mediated.

Conversation messages, Practice interaction metadata, included usage, and exact-cache entries currently have indefinite retention. Included reservation documents include an expiry field but this implementation does not silently delete user history or analytics.
