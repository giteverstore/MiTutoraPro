# Stylesheet ownership

`design-system/tokens.css` owns global tokens. `design-system/primitives.css` owns reusable controls and cards. `design-system/coherence.css` owns cross-domain consistency rules.

New domain styles belong in `src/styles/<domain>.css` and use that domain's class prefix. `routing.css` is the first extracted domain sheet. The historical `src/styles.css` remains a legacy aggregate while its selectors are migrated in reviewed slices; it must not receive new unrelated domain rules.

Component state should use state/data attributes, not broad element selectors. A domain stylesheet must not target another domain's prefix. Compiler, Practice, learning, certification, settings, and shell prefixes are separate ownership boundaries.
