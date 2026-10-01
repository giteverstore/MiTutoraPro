# CSS ownership

**Status: CURRENT ROUTE-OWNED ARCHITECTURE**

Global tokens live in `src/design-system/tokens.css`, shared primitives in `primitives.css`, and cross-domain coherence rules in `coherence.css`. Domain styling belongs under [`src/styles`](../../src/styles/README.md), uses a domain prefix, and is loaded by its route owner where applicable.

The former `src/styles.css` aggregate has been removed. `src/styles/index.css` preserves the shared foundation order, while page, layout, and component sheets provide semantic validation and ownership boundaries. Validation must follow those owners rather than asserting against the removed aggregate.
