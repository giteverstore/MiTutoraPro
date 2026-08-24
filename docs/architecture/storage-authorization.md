# Firebase Storage authorization

**Status: CURRENT (repository-managed; production deployment pending)**

The authoritative policy is [`storage.rules`](../../storage.rules), referenced by [`firebase.json`](../../firebase.json). Browser clients may read only active JSON artifacts in the versioned course, Practice, and daily-challenge namespaces. All client writes and unmatched/private/protected paths are denied. Firebase Admin publishers retain server-side write access because Admin SDK operations bypass client rules.

Publishers upload immutable objects with `publicationState=INACTIVE`, verify exact bytes and SHA-256, mark the version ready, then set verified objects to `ACTIVE` immediately before activating Firestore metadata. Rules inspect that object metadata, so merely uploading an inactive object does not expose it.

Storage rules cannot query Firestore. The object marker is the Storage authorization boundary; Firestore remains the discovery/active-version boundary. A crash after object activation but before Firestore activation can leave a readable but undiscoverable verified artifact. Protected tests remain excluded by publisher validation and protected paths are denied.

Existing production objects predate this marker. Before deploying these rules, perform a controlled metadata migration/republish for every active object and verify browser reads in staging. Deploying the rules first would deny legacy reads.

Run `npm run validate:storage-security` to exercise anonymous/authenticated active reads, inactive versions, protected/private paths, traversal attempts, and denied client writes.
