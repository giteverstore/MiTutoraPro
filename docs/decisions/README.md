# Architecture Decision Records

ADRs capture decisions that constrain future implementation. They explain why the current architecture exists, not only how it works.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-json-driven-content.md) | Accepted | Course content is JSON-driven |
| [0002](0002-monaco-editor.md) | Accepted | Monaco is the code editor |
| [0003](0003-pyodide-runtime.md) | Accepted | Python executes through Pyodide in a worker |
| [0004](0004-app-shell.md) | Accepted | Product pages share a reusable AppShell |

## Convention

New records use the next four-digit number and include status, context, alternatives, decision, and consequences. Do not rewrite an accepted decision when direction changes; add a superseding ADR and link both records.
