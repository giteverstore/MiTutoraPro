# CSS ownership

**Status: CURRENT STRATEGY; LEGACY MIGRATION IN PROGRESS**

Global tokens live in `src/design-system/tokens.css`, shared primitives in `primitives.css`, and cross-domain coherence rules in `coherence.css`. New domain styling belongs under [`src/styles`](../../src/styles/README.md) and uses a domain prefix. `routing.css` is the first extracted sheet.

`src/styles.css` remains the legacy aggregate for multiple domains. Moving all 3,000+ lines at once would create unacceptable cascade risk, so Batch 5 establishes ownership and migrates only new routing styles. Domain-by-domain extraction and visual regression coverage remain required.
